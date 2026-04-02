# Roadmap

Phase roadmap for the current backend and agent rollout.

## 13. Phase Roadmap

### Phase 1 — Foundation [SVC-001] [SVC-002]

- [P1-001] Create monorepo: Rust workspace + `coordinator/` SvelteKit package
- [P1-002] `coordinator/openapi/internal-api.yaml`: all internal message schemas [F013];
           `openapi-typescript` → TS types; Rust `nc-common` types written to match spec
- [P1-003] `nc-common`: `HashType`, `FileRecord`, `TorrentFile`, `ContentType`,
           `RegisterRequest`, `ResultBatch`, `IndexerStats`, `IndexerService` trait,
           `IndexerServer`, `CoordinatorClient` [F013]
- [P1-004] Prisma schema: full DB schema [T001–T018], reset-first local DB rebuild via `db push`
- [P1-005] SvelteKit coordinator skeleton: server setup, config load + filesystem watch [F001]
- [P1-006] `A020` self-registration with (hostname, protocol) UUID dedup [F002] [F030]
- [P1-007] `A021` result ingest + deduplication logic [F005]
- [P1-008] `A004` `GET /api/files` with FTS ranking [F017]
- [P1-009] `A013` `GET /api/stats` live snapshot
- [P1-010] Config push `POST /config-update` to registered indexers [F014]
- [P1-011] Per-indexer config override merge on push [F032]; `A026`/`A027`
- [P1-012] `overlord.toml` auto-generation on first run [F001]
- [P1-013] `W004` stats sampling + `W009` offline detection [F016] [F030]
- [P1-014] Auth stub: `A033`/`A034` return 501; `AUTH_ENABLED` flag; session placeholder [F033]
- [P1-015] `nc-emule` (SVC-002): migrate + refactor kadkad proto/routing/net/dht
- [P1-016] SVC-002 implements `IndexerService` trait; generates + persists stable `indexer_id` [F013] [F030]
- [P1-017] KAD passive keyspace crawl [F020] (`W007` instance)
- [P1-018] KAD active search on `SearchJob` [F004] [F020]
- [P1-019] KAD snoop queue (in-memory + flush `A023` / restore `A024`) [F007] [F015]
- [P1-020] Bundled wordlist cold start [F007]
- [P1-021] `A023`/`A024` snoop queue persistence endpoints in coordinator [F015]
- [P1-022] Snoop entries appended to `T014` [F018]

### Phase 2 — Mainline DHT [SVC-003]

- [P2-001] `nc-mainline` (SVC-003): BEP-5 DHT node (bencode, UDP Kademlia)
- [P2-002] BEP-51 passive crawl [F022] → bulk `raw_hashes` feed via `A021`
- [P2-003] Snoop queue on `get_peers` / `announce_peer` [F007] with flush/restore [F015]
- [P2-004] `W001` enrichment worker: drain `T001`, dispatch `EnrichRequest`,
           retry backoff, dead-hash marking [F012]
- [P2-005] BEP-9 metadata fetch on `EnrichRequest` [F023] (single-file + multi-file)
- [P2-006] `TorrentFile[]` array populated in `FileRecord` for multi-file torrents [F006]
- [P2-007] BT v2 per-file `sha256_root` extraction [F006]
- [P2-008] `T008` (`torrent_contents`) writes on enrichment result [F006]
- [P2-009] `A022` enrich-result endpoint in coordinator [F012]

### Phase 3 — Coordinator Full

- [P3-001] Cross-protocol hash bridge in dedup logic [F005]
- [P3-002] Content-type inference engine [F011]
- [P3-003] `W002` cross-network hash correlation worker [F005-W]
- [P3-004] `W003` torrent content cross-correlation worker [F006]
- [P3-005] `T009` (`torrent_content_correlations`) populated by `W003` [F006]
- [P3-006] Search job lifecycle: active → watching, FTS match on new promotions [F004]
- [P3-007] Fan-out strategy (broadcast/round_robin/least_busy) + routing_log [F030]
- [P3-008] `A002` SSE with `Last-Event-ID` resume [F004]
- [P3-009] `A019` global SSE feed [F003] [F018]
- [P3-010] `A006` Metalink 4 generation [F010]
- [P3-011] `A007`/`A008` torrent content endpoints [F006]
- [P3-012] `A009` trending / `A010` demand / `A011` stats history [F018] [F019] [F016]
- [P3-013] `W005` DHT seeding to all online indexers per protocol [F008] [F030]
- [P3-014] `A025` popular hashes endpoint [F008]
- [P3-015] `W006` ring-buffer pruner: `T014` and `T015` retention
- [P3-016] Weighted result ranking (availability + recency + FTS ts_rank) [F017]

### Phase 4 — Frontend [SVC-001 UI]

- [P4-001] SvelteKit app scaffold inside `coordinator/` package
- [P4-002] Search page: live SSE, watching indicator, sort controls,
           strategy selector, indexer filter [F004] [F017] [F030]
- [P4-003] Browse page: paginated, filterable [F011]
- [P4-004] Dashboard: sparklines [F016], Zeitgeist [F018], Demand Holes [F019],
           per-instance indexer health [F030], live new-file feed
- [P4-005] File Detail: hashes, magnet, metalink [F010], sources, tags,
           torrent info [F006], download dropdown [F031]
- [P4-006] Torrent Detail page [F006]
- [P4-007] Downloads page [F009] [F031]
- [P4-008] Indexers management page: status table, config override editor [F030] [F032]
- [P4-009] Download Clients management page: add/edit/delete/ping [F031]
- [P4-010] Two persistent SSE connections (`A002` + `A019`) with reconnect logic

### Phase 5 — ED2K Servers [SVC-002 extension]

- [P5-001] `nc-emule` ED2K server TCP protocol: login, search, server list exchange [F021]
- [P5-002] `servers.met` parser (binary + plain-text fallback) + auto-update [F021]
- [P5-003] ED2K server connection pool with rotating wordlist/snoop queue [F021]
- [P5-004] ED2K active search wired to `SearchJob` [F004] [F021]

### Phase 6 — Gnutella G2 [SVC-004]

- [P6-001] `nc-gnutella` (SVC-004): G2 hub/leaf client, GWebCache bootstrap [F024]
- [P6-002] Passive `/QH2` receive + `/BH` browse-host [F024]
- [P6-003] Snoop queue on `/Q2` with flush/restore [F007] [F015]
- [P6-004] Active search via `/Q2` [F004]
- [P6-005] DHT seeding via shared file list to hubs [F008]

### Phase 7 — IPFS [SVC-005]

- [P7-001] `nc-ipfs` (SVC-005): libp2p DHT node, PROVIDE listener [F025]
- [P7-002] Pubsub subscription strategy [F026]
- [P7-003] Known directory walker (configurable CID list) [F027]
- [P7-004] Cross-protocol CID correlation intake from coordinator [F028]
- [P7-005] UnixFS metadata fetch for enrichment [F029]
- [P7-006] PROVIDE seeding for popular CIDs [F008]

### Phase 8 — Polish & Hardening

- [P8-001] Frontend polish: keyboard shortcuts, filter persistence
- [P8-002] Magnet link composition endpoint `GET /api/files/:id/magnet`
- [P8-003] Source freshness TTL enforcement [B009]
- [P8-004] File pruning: zero-source files after TTL [B010]
- [P8-005] DB vacuuming after pruning
- [P8-006] Correlation log admin endpoint [B011]
- [P8-007] Load testing: BEP-51 firehose volumes against `A021` ingest pipeline

### Phase 9 — Download Integration [F009] [F031]

- [P9-001] `DownloadManager` implementation: `Aria2Client` + `QBittorrentClient` [F031]
- [P9-002] `A015`–`A018` download job endpoints [F009] [F031]
- [P9-003] `A028`–`A032` download client management endpoints [F031]
- [P9-004] Metalink 4 enhanced with all `T007` sources [F010]
- [P9-005] Submit metalink to aria2 via `aria2.addMetalink` [F009]
- [P9-006] qBittorrent: submit magnet/torrent via Web API [F031]
- [P9-007] `W008`: poll client status → update `T012`, fire SSE events
- [P9-008] Frontend Downloads page (queue, progress, cancel) [F031]
- [P9-009] File Detail: download dropdown with client selection [F031]
- [P9-010] Download Clients management page in UI [F031]

---
