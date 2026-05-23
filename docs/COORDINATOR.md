# Coordinator

Coordinator behavior, data model, API ownership, and coordinator-owned workflows.

## 5. Coordinator (`overlord`) [SVC-001]

**Tech stack:** SvelteKit (Node.js, TypeScript). Prisma ORM against PostgreSQL.

SvelteKit server routes (`+server.ts`) are the REST API. SvelteKit `+page.svelte` files are
the SSR-rendered UI pages. The BFF pattern is native: load functions run server-side and
pass typed data directly to page components — no CORS, no duplication.

The coordinator API below is p2p-overlord's internal coordinator surface. Any
future eMuleBB-compatible `/api/v1` facade must use
`repos/emulebb-tooling/docs/rest/REST-API-OPENAPI.yaml` as the canonical contract
and publish claimed-subset conformance evidence.

**Local validation baseline:** use the direct repo commands instead of wrapper
scripts. For Rust changes, run `cargo fmt --all --check` and
`cargo clippy --workspace --all-targets --all-features -- -D warnings -W clippy::all -W clippy::too_many_arguments -W clippy::type_complexity -W clippy::cognitive_complexity`
from `p2p-overlord-agents`. For coordinator changes, run `npm run
windows:quality` from `p2p-overlord-be/overlord-be-coordinator`; that command
covers Svelte checks, Prisma schema validation, and Prisma client generation.

Single source of truth. Owns the DB, the API, the config, all intelligence layers, and all
download client integrations.

### 5.1 Database Schema [T001–T018]

PostgreSQL, reset-first and rebuilt from `schema.prisma` via Prisma `db push` in the current phase.
SVC-001 is the exclusive writer. Schema compatibility and migration-history preservation are not
goals right now: after coordinator schema edits, reset the local DB and rebuild it from the current
Prisma schema instead of preserving incremental patch chains. Tracked migration history is not part
of the active coordinator package surface in this phase.

**Coordinator DB naming policy:** persisted PostgreSQL object names remain canonical `snake_case`.
Prisma model and field names may stay `PascalCase` / `camelCase`, but they must map explicitly with
`@@map` and `@map`. Raw SQL always targets the `snake_case` database names.

```sql
-- ═══════════════════════════════════════════════════════════
-- [T001] raw_hashes — staging tier, unenriched hashes
-- Fed by: BEP-51, KAD keyspace walk, IPFS PROVIDE, G2 announces
-- Drained by: W001 (enrichment worker)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE raw_hashes (
    hash_type       TEXT NOT NULL,
    hash_value      BYTEA NOT NULL,
    protocol        TEXT NOT NULL,
    first_seen      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt    TIMESTAMPTZ,
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    -- pending | retrying | dead
    status          TEXT NOT NULL DEFAULT 'pending',
    PRIMARY KEY (hash_type, hash_value)
);

-- ═══════════════════════════════════════════════════════════
-- [T002] files — promoted tier, fully enriched records
-- ═══════════════════════════════════════════════════════════
CREATE TABLE files (
    id                       BIGSERIAL PRIMARY KEY,
    size                     BIGINT NOT NULL,
    content_type             TEXT NOT NULL DEFAULT 'unknown',
    content_type_confidence  REAL NOT NULL DEFAULT 0.0,
    first_seen               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    availability             INTEGER NOT NULL DEFAULT 0
);

-- ═══════════════════════════════════════════════════════════
-- [T003] file_hashes — cross-protocol deduplication key [F005]
-- ═══════════════════════════════════════════════════════════
CREATE TABLE file_hashes (
    hash_type   TEXT NOT NULL,
    hash_value  BYTEA NOT NULL,
    file_id     BIGINT NOT NULL REFERENCES files(id),
    PRIMARY KEY (hash_type, hash_value)
);

-- ═══════════════════════════════════════════════════════════
-- [T004] file_names — multiple names per file, per protocol
-- ═══════════════════════════════════════════════════════════
CREATE TABLE file_names (
    file_id     BIGINT NOT NULL REFERENCES files(id),
    name        TEXT NOT NULL,
    protocol    TEXT NOT NULL,
    first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (file_id, name)
);

-- ═══════════════════════════════════════════════════════════
-- [T005] Full-text search — tsvector column on file_names [F017]
-- PostgreSQL GIN index; ts_rank for BM25-equivalent ranking.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE file_names
    ADD COLUMN name_tsv TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('english', name)) STORED;
CREATE INDEX idx_file_names_tsv ON file_names USING GIN(name_tsv);

-- ═══════════════════════════════════════════════════════════
-- [T006] file_tags — flexible metadata (codec, bitrate, resolution, etc.)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE file_tags (
    file_id     BIGINT NOT NULL REFERENCES files(id),
    tag_name    TEXT NOT NULL,
    tag_value   TEXT NOT NULL,
    protocol    TEXT NOT NULL,
    PRIMARY KEY (file_id, tag_name, protocol)
);

-- ═══════════════════════════════════════════════════════════
-- [T007] sources — where to get the file [F005]
-- ═══════════════════════════════════════════════════════════
CREATE TABLE sources (
    file_id     BIGINT NOT NULL REFERENCES files(id),
    protocol    TEXT NOT NULL,
    address     TEXT NOT NULL,
    extra       JSONB,
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (file_id, protocol, address)
);

-- ═══════════════════════════════════════════════════════════
-- [T008] torrent_contents — individual files within multi-file torrents [F006]
-- ═══════════════════════════════════════════════════════════
CREATE TABLE torrent_contents (
    btih            BYTEA NOT NULL,
    btih_v2         BYTEA,
    file_index      INTEGER NOT NULL,
    path            TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    size            BIGINT NOT NULL,
    sha256_root     BYTEA,
    file_id         BIGINT REFERENCES files(id),
    PRIMARY KEY (btih, file_index)
);

-- ═══════════════════════════════════════════════════════════
-- [T009] torrent_content_correlations [F006]
-- ═══════════════════════════════════════════════════════════
CREATE TABLE torrent_content_correlations (
    normalized_name TEXT NOT NULL,
    size            BIGINT NOT NULL,
    file_id         BIGINT NOT NULL REFERENCES files(id),
    torrent_count   INTEGER NOT NULL DEFAULT 1,
    first_seen      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (normalized_name, size)
);

-- ═══════════════════════════════════════════════════════════
-- [T010] search_jobs [F004] [F030]
-- ═══════════════════════════════════════════════════════════
CREATE TABLE search_jobs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query        TEXT NOT NULL,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active_until TIMESTAMPTZ,
    -- active | watching | closed
    status       TEXT NOT NULL DEFAULT 'active',
    result_count INTEGER NOT NULL DEFAULT 0,
    -- broadcast | round_robin | least_busy [F030]
    strategy     TEXT NOT NULL DEFAULT 'broadcast',
    -- NULL = all online indexers; non-NULL = targeted subset [F030]
    indexer_ids  UUID[],
    -- records which indexer instances were contacted [F030]
    routing_log  JSONB
);

-- ═══════════════════════════════════════════════════════════
-- [T011] search_results
-- ═══════════════════════════════════════════════════════════
CREATE TABLE search_results (
    job_id      UUID NOT NULL REFERENCES search_jobs(id),
    file_id     BIGINT NOT NULL REFERENCES files(id),
    found_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    protocol    TEXT NOT NULL,
    indexer_id  UUID NOT NULL,   -- which instance reported this [F030]
    PRIMARY KEY (job_id, file_id)
);

-- ═══════════════════════════════════════════════════════════
-- [T012] download_jobs [F009] [F031]
-- ═══════════════════════════════════════════════════════════
CREATE TABLE download_jobs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id        BIGINT NOT NULL REFERENCES files(id),
    client_id      UUID REFERENCES download_clients(id),  -- [F031] [T018]
    client_gid     TEXT,              -- client-specific download ID (set after submission)
    -- queued | submitted | downloading | complete | error | cancelled
    status         TEXT NOT NULL DEFAULT 'queued',
    progress_bytes BIGINT NOT NULL DEFAULT 0,
    total_bytes    BIGINT,
    started_at     TIMESTAMPTZ,
    finished_at    TIMESTAMPTZ,
    error_msg      TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- [T013] snoop_entries — snoop queue persistence [F007] [F015]
-- Keyed by indexer_id so each instance has its own queue.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE snoop_entries (
    indexer_id  UUID NOT NULL REFERENCES indexer_registry(id),
    query       TEXT NOT NULL,
    hash_type   TEXT,
    hash_value  BYTEA,
    hit_count   INTEGER NOT NULL DEFAULT 1,
    first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (indexer_id, query)
);

-- ═══════════════════════════════════════════════════════════
-- [T014] snoop_log — timestamped query log for trending [F018] and demand [F019]
-- Ring buffer: pruned to last snoop_log_retention_days by W006.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE snoop_log (
    id         BIGSERIAL PRIMARY KEY,
    protocol   TEXT NOT NULL,
    indexer_id UUID NOT NULL,
    query      TEXT NOT NULL,
    logged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- [T015] stats_samples — crawl stats time-series [F016]
-- Sampled every 60s by W004. Ring buffer: 7 days by default.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE stats_samples (
    sampled_at        TIMESTAMPTZ NOT NULL,
    indexer_id        UUID NOT NULL,
    protocol          TEXT NOT NULL,
    peers_connected   INTEGER,
    crawl_rate        REAL,
    snoop_queue_depth INTEGER,
    staging_depth     INTEGER,
    PRIMARY KEY (sampled_at, indexer_id)
);

-- ═══════════════════════════════════════════════════════════
-- [T016] indexer_registry — self-registered indexer instances [F002] [F030]
-- Multiple rows per protocol allowed (one per running instance).
-- Re-registration matches on (hostname, protocol) → updates existing row.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE indexer_registry (
    id               UUID PRIMARY KEY,          -- stable, generated by the indexer [F030]
    protocol         TEXT NOT NULL,
    url              TEXT NOT NULL,
    hostname         TEXT NOT NULL,
    version          TEXT NOT NULL,
    registered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_config_push TIMESTAMPTZ,
    config_override  JSONB,                     -- per-instance config override [F032]
    -- online | offline | degraded
    status           TEXT NOT NULL DEFAULT 'online',
    UNIQUE (hostname, protocol)
);

-- ═══════════════════════════════════════════════════════════
-- [T017] pruning_config — future pruning feature [B009] [B010]
-- Schema defined now; no enforcement until Phase 8.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE pruning_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- Planned keys:
--   source_ttl_days          source not seen in N days → pruned [B009]
--   file_ttl_days            file with zero sources for N days → pruned [B010]
--   dead_hash_max_attempts
--   dead_hash_max_days
--   snoop_log_retention_days default 30
--   stats_retention_days     default 7

-- ═══════════════════════════════════════════════════════════
-- [T018] download_clients — registered download client backends [F031]
-- Managed via A028–A032. Stored in DB, not in overlord.toml.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE download_clients (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name      TEXT NOT NULL,          -- user-friendly label
    -- 'aria2' | 'qbittorrent'
    type      TEXT NOT NULL,
    url       TEXT NOT NULL,          -- API endpoint URL
    secret    TEXT,                   -- RPC secret / API key
    protocols TEXT[] NOT NULL,        -- hash types handled, e.g. ARRAY['btih','btih_v2']
    priority  INTEGER NOT NULL DEFAULT 0,  -- lower number = tried first
    enabled   BOOLEAN NOT NULL DEFAULT true,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indices:**
```sql
CREATE INDEX idx_file_hashes_file_id        ON file_hashes(file_id);
CREATE INDEX idx_file_names_file_id         ON file_names(file_id);
CREATE INDEX idx_file_tags_file_id          ON file_tags(file_id);
CREATE INDEX idx_sources_file_id            ON sources(file_id);
CREATE INDEX idx_sources_last_seen          ON sources(last_seen);
CREATE INDEX idx_files_availability         ON files(availability DESC);
CREATE INDEX idx_files_content_type         ON files(content_type);
CREATE INDEX idx_raw_hashes_status          ON raw_hashes(status, last_attempt);
CREATE INDEX idx_torrent_contents_btih      ON torrent_contents(btih);
CREATE INDEX idx_torrent_contents_norm      ON torrent_contents(normalized_name, size);
CREATE INDEX idx_torrent_contents_file_id   ON torrent_contents(file_id);
CREATE INDEX idx_snoop_log_logged_at        ON snoop_log(logged_at);
CREATE INDEX idx_snoop_log_query            ON snoop_log(query, logged_at);
CREATE INDEX idx_stats_samples_indexer      ON stats_samples(indexer_id, sampled_at);
CREATE INDEX idx_download_jobs_file_id      ON download_jobs(file_id);
CREATE INDEX idx_download_jobs_status       ON download_jobs(status);
CREATE INDEX idx_download_jobs_client       ON download_jobs(client_id);
CREATE INDEX idx_indexer_registry_protocol  ON indexer_registry(protocol, status);
```

### 5.2 Deduplication Logic [F005]

When a `ResultBatch` arrives at `A021`:

1. Collect all hashes from each `FileRecord`
2. Query `T003` — do any hashes already map to a `file_id`?
3. **Hit** → merge: upsert names (`T004`), tags (`T006`), sources (`T007`).
   Update `T002.last_seen`, recalculate `T002.availability`.
4. **Miss** → check promotion criteria (name + size + source, configurable).
   - Met → create `T002` row, insert into `T003/T004/T006/T007`. Infer
     `content_type` via `F011`. If `torrent_files` non-empty → write `T008`,
     enqueue `W003`.
   - Not met → upsert into `T001` staging for `W001` to enrich later.
5. **Cross-protocol bridge**: a record carrying both `ed2k` and `btih` gets both hashes
   in `T003` pointing to the same `file_id`. DB self-heals cross-network duplicates over time.

### 5.3 Content-Type Inference [F011]

Runs at promotion time. Stored in `T002.content_type` + `content_type_confidence`.

| ContentType | Inference Rule |
|---|---|
| `video/hd` | video extension AND (resolution tag ≥ 1080 OR size > 4 GB) |
| `video/sd` | video extension, lower resolution or no resolution tag |
| `audio/lossless` | ext ∈ {flac, ape, wav, aiff, alac} OR codec tag matches |
| `audio/lossy` | ext ∈ {mp3, aac, ogg, opus, m4a} OR codec tag matches |
| `image` | ext ∈ {jpg, jpeg, png, gif, bmp, tiff, webp, raw, psd} |
| `software/windows` | ext ∈ {exe, msi} |
| `software/linux` | ext ∈ {deb, rpm, appimage} |
| `software/macos` | ext ∈ {dmg, pkg} |
| `document` | ext ∈ {pdf, epub, mobi, doc, docx, txt, azw} |
| `game` | size > 1 GB AND multi-file torrent with known game file patterns |
| `archive` | ext ∈ {zip, rar, 7z, tar.*} — catch-all |
| `unknown` | default |

Confidence: 1.0 = extension + tags agree. 0.7 = extension only. 0.5 = tags only. 0.0 = unknown.

### 5.4 Two-Tier Staging — Enrichment & Promotion [F012]

`T001` (`raw_hashes`) is a work queue drained by `W001`:

1. Select `pending`/`retrying` entries, prioritised by `snoop_entries.hit_count`
2. Find online registered indexers for the hash's protocol (`T016`, `status = 'online'`)
3. `POST /enrich` to one of them — round-robin across online instances [F030]
4. On success → `EnrichResult` arrives at `A022` → attempt promotion to `T002`
5. On failure → increment `attempt_count`, set `last_attempt`, apply backoff:
   - Attempt 1 → retry after 1 hour
   - Attempt 2 → retry after 1 day
   - Attempt N → `base_secs × 2^(N-1)`, capped
   - After `dead_hash_max_attempts` failures over `dead_hash_max_days` → `status = dead`
6. Dead entries: tombstones, never re-enqueued, never shown in UI

**Promotion criteria** (all configurable via TOML):
```toml
[coordinator.staging]
require_name   = true
require_size   = true
require_source = true
```

### 5.5 Search Job Lifecycle [F004] [F030]

```
User  POST /api/search  {q, strategy?, indexer_ids?}    [A001]
        │
        ▼
SVC-001 creates T010 row (status=active, active_until=now+60s)
        │
        ├──► Resolve target indexers [F030]:
        │    - broadcast (default): all online instances
        │    - round_robin: one per protocol, rotating
        │    - least_busy: lowest crawl_rate per protocol
        │    - indexer_ids set: only those specific instances
        │    Fan out SearchJob → log to T010.routing_log
        │
        ▼
Results flow in via POST /api/internal/results           [A021]
        │
        ├──► Dedup + store [F005]
        ├──► Increment T010.result_count
        └──► Fire SSE event: file_found → frontend       [A002]

After active_until:
        │
        ▼
T010.status → "watching"
        │
        └──► On every new file promoted to T002:
             FTS match against all watching job queries
             On match → insert T011, fire SSE event [A002]

Job never closes unless explicitly deleted.
Frontend SSE [A002] supports Last-Event-ID resume on reconnect.
```

### 5.6 DHT Participation Seeding [F008]

Coordinator runs `W005` every 10 minutes:
1. Query top-N files by `T002.availability DESC` per protocol
2. `POST /seed-popular` to **all** online indexers of each protocol [F030]
3. Each indexer stores these and serves them to its network:
   - **SVC-002**: calls `PublishKeyReq` to closest KAD nodes for top-N file keywords
   - **SVC-003**: responds positively to `get_peers` for known btih hashes
   - **SVC-004**: includes top files in the shared file list advertised to G2 hubs
   - **SVC-005**: publishes `PROVIDE` records for popular CIDs in the IPFS DHT

### 5.7 Cross-Network Hash Correlation Engine [F005-W]

Background worker `W002`, low priority, runs every 5 minutes.

**Trigger:** newly promoted `file_id`s with only one hash type.

**Algorithm:**
1. Fetch the file's canonical name + size
2. FTS search against `T004` for files with matching normalized name tokens
3. For each candidate: size must match exactly (configurable: `cross_protocol_fuzzy_size`)
4. On match: merge the two `file_id` records — combine all hashes in `T003`, names in
   `T004`, tags in `T006`, sources in `T007`. Lower `file_id` wins.
5. Merges logged to `correlation_log` (append-only) for future admin review [B011]

### 5.8 Torrent Content Cross-Correlation [F006]

Worker `W003`, runs on every `T008` write batch.

**Algorithm:**
1. New torrent enriched → `T008` rows written (one per file in the torrent)
2. For each row: query `T008` by `normalized_name + size`
3. **BT v2 match** (`sha256_root`): exact — confidence = 1.0
4. **BT v1 match** (`normalized_name + size`): high-confidence. Configurable threshold.
5. On confident match:
   - Neither has `file_id` → create new `T002` record, assign to both
   - One has `file_id` → assign same `file_id` to the other
   - Both have different `file_id`s → merge via `W002` logic
   - Upsert `T009` (increment `torrent_count`)

**Surface:** `A007` (`GET /api/files/:id/in-torrents`), `A008` (`GET /api/torrents/:btih/contents`)

### 5.9 Trending Feed [F018] & Demand Holes [F019]

Both built on `T014` (`snoop_log`), maintained by ring-buffer pruner `W006`.

**Trending [F018]:** `GET /api/trending?window=1h|6h|24h|7d` [A009]
```sql
SELECT query, COUNT(*) as hits
FROM snoop_log
WHERE logged_at > NOW() - INTERVAL '1 hour'
GROUP BY query ORDER BY hits DESC LIMIT 50;
```
Frontend widget: **"P2P Zeitgeist"** — pushed via `A019` SSE event `trending_update` every 60s.

**Demand Holes [F019]:** `GET /api/demand?min_queries=50&max_results=5` [A010]
Files the network wants but we haven't indexed yet. High-demand entries auto-prioritised
in `W001` enrichment queue [B015].

### 5.10 Stats Time-Series [F016]

Worker `W004` polls `GET /stats` from all online registered indexers every 60 seconds and
writes to `T015` [F030]. Consecutive poll failures feed into `W009` offline detection.
Pruner `W006` removes rows older than `stats_retention_days` (default 7).

`GET /api/stats/history?protocol=mainline&window=24h` [A011]

### 5.11 Metalink Generation [F010]

`GET /api/files/:id/metalink` [A006] returns Metalink 4 (RFC 5854) XML synthesized from
`T003` (hashes) + `T007` (sources). Used by the download client integration [F031] and
downloadable directly from the frontend File Detail page.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<metalink xmlns="urn:ietf:params:xml:ns:metalink">
  <file name="ubuntu-22.04-desktop-amd64.iso">
    <size>1475723264</size>
    <hash type="ed2k">a1b2c3d4e5f6...</hash>
    <hash type="sha-1">d4e5f6a7b8c9...</hash>
    <url>ed2k://|file|ubuntu-22.04...|1475723264|A1B2C3...|/</url>
    <url>magnet:?xt=urn:btih:D4E5F6...&amp;dn=ubuntu-22.04</url>
  </file>
</metalink>
```

### 5.12 Download Client Management [F031]

The coordinator maintains a `DownloadManager` that routes download requests to the correct
backend based on the file's available hash types and the user's selection.

**DownloadClient interface (TypeScript):**
```typescript
interface DownloadClient {
  id:        string;
  name:      string;
  type:      'aria2' | 'qbittorrent';
  protocols: string[];

  ping():                      Promise<boolean>;
  add(req: DownloadRequest):   Promise<string>;   // returns client_gid
  status(gid: string):         Promise<DownloadStatus>;
  pause(gid: string):          Promise<void>;
  resume(gid: string):         Promise<void>;
  cancel(gid: string):         Promise<void>;
}
```

**Routing logic:**
1. File has hashes → determine eligible protocol types
2. Filter `T018` by matching protocol, `enabled = true`, order by `priority ASC`
3. **User-initiated**: present dropdown of eligible clients; default = lowest priority number
4. **Automated** (W001 demand boost, etc.): use highest-priority eligible client
5. If selected client is unreachable (`ping()` fails): record `error_msg` in `T012`;
   fail gracefully for manual; try next by priority for automated

**Implementations:**
- `Aria2Client`: JSON-RPC `aria2.addMetalink`, `aria2.tellStatus`, `aria2.pause`, `aria2.remove`
- `QBittorrentClient`: Web API `POST /api/torrents/add`, `GET /api/torrents/info`, `POST /api/torrents/pause`

### 5.13 Indexer Offline Detection [F030]

Worker `W009`, runs every 60 seconds:
1. Query `T016` for rows where `last_seen < NOW() - INTERVAL 'N seconds'`
   (N = `indexer_offline_threshold_secs`, default 300)
2. Set `status = 'offline'` for any that were previously `online`
3. Stop routing search jobs and enrichment requests to offline instances
4. When an offline indexer re-registers (`A020`): set `status = 'online'` immediately,
   push current merged config [F032]

### 5.14 Public REST API

```
# ─── Search [F004] ──────────────────────────────────────────────
[A001] POST /api/search
         body: {q: string, strategy?: "broadcast"|"round_robin"|"least_busy",
                indexer_ids?: uuid[]}   [F030]
         → {job_id: uuid, status: "active", routed_to: uuid[]}

[A002] GET  /api/search/:id/stream       SSE (supports Last-Event-ID resume)
         → event: file_found    {file_id, name, size, content_type, protocols[], sources}
         → event: phase_change  {job_id, new_status: "watching"}
         → event: heartbeat     {result_count}   (every 5s while active)

[A003] GET  /api/search/:id              → job status, result_count, active_until, routing_log

# ─── Browse & inspect ───────────────────────────────────────────
[A004] GET  /api/files                   ?q=&protocol=&content_type=&sort=availability
                                         &page=&limit=
         → paginated results; FTS-ranked when q set [F017]

[A005] GET  /api/files/:id               → full record (hashes, names, tags, sources,
                                           content_type, torrent file list if any)

[A006] GET  /api/files/:id/metalink      → Metalink 4 XML [F010]

[A007] GET  /api/files/:id/in-torrents   → list of btih hashes containing this file [F006]

[A008] GET  /api/torrents/:btih/contents → all files within a specific torrent [F006]

# ─── Network intelligence ───────────────────────────────────────
[A009] GET  /api/trending                ?window=1h|6h|24h|7d  [F018]
         → [{query, hits, first_seen, last_seen}, ...]

[A010] GET  /api/demand                  ?min_queries=50&max_results=5  [F019]
         → [{query, query_count, results_in_db}, ...]

[A011] GET  /api/stats/history           ?protocol=&window=  [F016]
         → [{sampled_at, indexer_id, peers, crawl_rate, snoop_depth}, ...]

# ─── System ─────────────────────────────────────────────────────
[A012] GET  /api/status                  → coordinator uptime, DB size, file count

[A013] GET  /api/stats                   → live per-indexer IndexerStats snapshot [F030]

[A014] GET  /api/indexers                → all registered instances, status, last_seen [F030]

# ─── Indexer management [F030] [F032] ───────────────────────────
[A026] GET    /api/indexers/:id          → indexer detail + config_override

[A027] PATCH  /api/indexers/:id/config   body: {config_override: object}
         → stores in T016.config_override; immediately pushes merged config [F032]

# ─── Download clients [F031] ────────────────────────────────────
[A028] GET    /api/download-clients      → all configured clients + live ping status

[A029] POST   /api/download-clients      {name, type, url, secret?, protocols[], priority?}
         → {id: uuid}

[A030] PUT    /api/download-clients/:id  {name?, url?, secret?, protocols?, priority?, enabled?}

[A031] DELETE /api/download-clients/:id

[A032] GET    /api/download-clients/:id/ping   → {reachable: bool, latency_ms: number}

# ─── Downloads [F009] [F031] ────────────────────────────────────
[A015] POST   /api/download              {file_id, client_id?}
         → {job_id}  — client_id optional; omit to use highest-priority eligible client

[A016] GET    /api/downloads             → all jobs with status
[A017] GET    /api/downloads/:id         → job detail + progress
[A018] DELETE /api/downloads/:id         → cancel

# ─── SSE global feed [F003] [F018] ──────────────────────────────
[A019] GET  /api/feed                    SSE (always open)
         → event: new_file        {file_id, name, size, content_type, protocol}
         → event: stats_update    {IndexerStats[]}                    (every 30s)
         → event: trending_update {[{query, hits}]}                   (every 60s) [F018]
         → event: indexer_up      {id, protocol, hostname, url, version}  [F030]
         → event: indexer_down    {id, protocol, hostname}                [F030]

# ─── Internal (indexer → coordinator) ───────────────────────────
[A020] POST /api/internal/register       RegisterRequest
         → {id: uuid}  — returns existing UUID if (hostname, protocol) known [F030]

[A021] POST /api/internal/results        ResultBatch
[A022] POST /api/internal/enrich-result  EnrichResult
[A023] POST /api/internal/snoop-flush    {indexer_id, entries: SnoopEntry[]}  [F015]
[A024] GET  /api/internal/snoop-restore/:indexer_id  → SnoopEntry[]          [F015]
[A025] GET  /api/internal/popular-hashes ?protocol=&limit=  → PopularHash[]  [F008]

# ─── Auth stub [F033] ────────────────────────────────────────────
[A033] POST /api/auth/login              → 501 Not Implemented
[A034] POST /api/auth/logout             → 501 Not Implemented
```

### 5.15 Config Push to Indexers [F014] [F032]

Filesystem watch (`chokidar`) on `overlord.toml`:
1. Reload changed sections
2. For each online indexer in `T016`:
   - Merge global config section for that protocol + `T016.config_override` for that instance
   - `POST /config-update` with merged `ConfigUpdate`
   - Update `T016.last_config_push`

When `A027` stores a per-indexer override: same merge-and-push fires immediately for that
one instance only.

### 5.16 Auth Stub [F033]

Session infrastructure is fully defined from day one but not enforced:
- `A033` and `A034` exist and return `501 Not Implemented`
- A `session` cookie placeholder is set to `guest` on all requests
- All protected route guards check `session.role === 'admin'` — this check is bypassed via
  a single `AUTH_ENABLED=false` env flag (always passes when false)
- Enabling real auth: set `AUTH_ENABLED=true`, implement `A033` against a local bcrypt
  password store — all route guards are already wired

---
