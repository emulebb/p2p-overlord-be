# Architecture

Core system intent, workspace layout, shared contracts, and service topology.

## 1. Vision

`p2p-overlord` is a microservices-based indexer that passively and actively harvests file
metadata from multiple P2P networks simultaneously, feeds everything into a unified
PostgreSQL database, and exposes a single REST API + live frontend for search, browse,
download management, and node orchestration.

**Core principles:**
- **[F001]** Coordinator owns everything: DB, config, public API, job dispatch
- **[F002]** Indexers own nothing: stateless, protocol-specialist daemons — only need coordinator URL
- **[F003]** Always crawling: passive crawl runs 24/7 regardless of user activity
- **[F004]** Active search on demand: user queries trigger targeted searches on all networks
- **[F005]** Cross-protocol deduplication: same file found on 4 networks = 1 record, 4 source sets
- **[F006]** Cross-torrent content correlation: same file in N different torrents = 1 canonical record
- **[F007]** Network intelligence: snoop other nodes' queries to learn what the network wants now
- **[F008]** DHT participation: indexers serve popular data back into their networks, becoming
  high-value nodes that attract more traffic and more snooped queries
- **[F030]** Multi-indexer fan-out: multiple indexer instances per protocol on different machines;
  coordinator fans out search jobs to all; configurable strategy (broadcast / round_robin / least_busy)
- **[F031]** Download client abstraction: multiple download clients (aria2, qBittorrent, …) per
  protocol; routing by hash type + user selection with priority-based fallback
- **[F032]** Per-indexer config overrides: coordinator stores per-instance JSONB override merged
  on top of global config on every push
- **[F033]** Auth stub: login/logout endpoints exist from day one (return 501); session
  infrastructure fully defined — enabling real auth is a one-day job
- Designed for one machine now, built to scale horizontally later

**Phase 9 note:** Downloading uses external download clients [F031] controlled via their
respective APIs. The coordinator generates Metalink 4 (RFC 5854) [F010] files combining all
known hashes and sources and hands them to the selected client. aria2 [F009] is the first
supported backend; qBittorrent and others follow the same `DownloadClient` interface.

**Naming policy:** concrete implementation names use two stable prefixes across the
workspace and on GitHub:
- `overlord-be-*` for backend/core services
- `overlord-agent-*` for protocol agents and their shared Rust support crates

**Repo layout policy:** backend services live under `overlord-be/`, while all Rust agents live
together under an `overlord-agents/` subfolder.

---

## 2. Workspace Layout

```
p2p-overlord/
├── overlord-be/
│   └── overlord-be-coordinator/    # SVC-001: SvelteKit/Node.js coordinator + UI
│       ├── package.json
│       ├── svelte.config.js
│       ├── prisma/
│       │   └── schema.prisma       # PostgreSQL schema definition for reset + Prisma db push
│       ├── openapi/
│       │   └── internal-api.yaml   # Rust ↔ TS wire contract [F013]
│       └── src/
│           ├── lib/
│           │   ├── server/         # server-only: DB, indexer clients, download manager
│           │   └── shared/         # types generated from internal-api.yaml
│           └── routes/             # SvelteKit file-based routing (pages + API endpoints)
├── docs/                       # canonical backend/spec docs
│   └── README.md               # curated docs landing page
├── overlord-agents/            # Rust agents repo contents
│   ├── Cargo.toml              # workspace root (Rust agents only)
│   ├── docs/                   # canonical agents/protocol docs
│   ├── overlord.toml.example   # annotated reference config
│   └── crates/
│       ├── overlord-agent-common/   # shared Rust types, traits, HTTP client/server helpers
│       ├── overlord-agent-emule/    # SVC-002: KAD + ED2K indexer
│       ├── overlord-agent-mainline/ # SVC-003: BitTorrent DHT indexer
│       ├── overlord-agent-gnutella/ # SVC-004: Gnutella G2 indexer
│       └── overlord-agent-ipfs/     # SVC-005: IPFS indexer
```

**No separate frontend package.** The SvelteKit app inside
`overlord-be/overlord-be-coordinator/`
is the frontend.
It SSR-renders pages on the Node.js coordinator process and connects back to its own API
routes. No cross-origin concerns; no separate deployment artifact.

**Note on kadkad:** The existing `kadkad` codebase is the starting point and spiritual
predecessor of `overlord-agent-emule`. Its wire protocol codec, routing table, obfuscation layer,
and DHT traversal logic inform the redesign, but nothing is copied or imported directly.
`overlord-agent-emule` [SVC-002] is its own implementation.

---

## 3. Service Overview

| ID | Package | Tech | REST port | P2P ports | Role |
|---|---|---|---|---|---|
| SVC-001 | `overlord-be-coordinator` | SvelteKit / Node.js | 13300 | — | Brain: DB, API, BFF, SSR UI, download management |
| SVC-002 | `overlord-agent-emule` | Rust | 13301 | 41000 UDP (KAD), 41001 TCP (ED2K) | KAD + ED2K indexer |
| SVC-003 | `overlord-agent-mainline` | Rust | 13302 | 41002 UDP+TCP (BT DHT) | BitTorrent DHT indexer |
| SVC-004 | `overlord-agent-gnutella` | Rust | 13303 | 41003 TCP (G2) | Gnutella 2 indexer |
| SVC-005 | `overlord-agent-ipfs` | Rust | 13304 | 41004 TCP (libp2p) | IPFS indexer |

All ports are configurable via the central TOML. The values above are defaults.

### Communication Model

```
Browser   ──SSR / REST / SSE──────────────────────────────► SVC-001 :13300
                                                                │
SVC-001 ──POST /search──────────────────────────────────────► SVC-00x :1330x (all instances) [F030]
SVC-001 ──POST /enrich──────────────────────────────────────► SVC-00x :1330x
SVC-001 ──POST /config-update───────────────────────────────► SVC-00x :1330x [F032]
SVC-001 ──POST /seed-popular────────────────────────────────► SVC-00x :1330x

SVC-00x ──POST /api/internal/results────────────────────────► SVC-001 :13300
SVC-00x ──POST /api/internal/enrich-result──────────────────► SVC-001 :13300
SVC-00x ──POST /api/internal/register───────────────────────► SVC-001 :13300
SVC-00x ──POST /api/internal/snoop-flush────────────────────► SVC-001 :13300
SVC-00x ──GET  /api/internal/snoop-restore──────────────────► SVC-001 :13300
SVC-00x ──GET  /api/internal/popular-hashes─────────────────► SVC-001 :13300

SVC-001 ──JSON-RPC──────────────────────────────────────────► aria2        [F009] [F031]
SVC-001 ──HTTP API──────────────────────────────────────────► qBittorrent  [F031]
```

Indexers only ever need to know the coordinator URL (`OVERLORD_COORDINATOR_URL`).
Multiple instances of the same indexer service can register simultaneously [F030].

---

## 4. overlord-agent-common — Shared Types & Traits

Library crate shared by all Rust indexer services. Contains types, the `IndexerService`
trait, and HTTP helpers so each indexer binary is ~50 lines of glue code.

**Type contract with the coordinator [F013]:** `overlord-be/overlord-be-coordinator/openapi/internal-api.yaml` is
the canonical schema for all coordinator ↔ indexer wire messages. The Rust types in
`overlord-agent-common` are kept in sync with this spec. TypeScript types inside the coordinator are
generated via `openapi-typescript`. CI verifies both sides match the spec.

### 4.1 Core Types

```rust
/// All supported P2P protocols
pub enum Protocol {
    Kad2,           // [SVC-002]
    Ed2kServer,     // [SVC-002]
    MainlineDht,    // [SVC-003]
    GnutellaG2,     // [SVC-004]
    Ipfs,           // [SVC-005]
}

/// Hash types across all protocols — the cross-protocol dedup key [F005]
pub enum HashType {
    Ed2k([u8; 16]),        // eMule / KAD (MD4)
    Btih([u8; 20]),        // BitTorrent info_hash v1 (SHA-1)
    BtihV2([u8; 32]),      // BitTorrent info_hash v2 (SHA-256, BEP-52)
    Sha1([u8; 20]),        // Gnutella / TTH root
    Cid(String),           // IPFS CIDv0 / CIDv1
    Sha256([u8; 32]),      // IPFS modern / per-file BT v2 merkle root [F006]
}

/// Content-type taxonomy [F011] — inferred at promotion time from tags + file extension
pub enum ContentType {
    VideoHd,          // resolution >= 1080p or size > 4 GB
    VideoSd,          // video, lower quality or untagged
    AudioLossless,    // flac, ape, wav, aiff, alac
    AudioLossy,       // mp3, aac, ogg, opus, m4a
    Image,
    SoftwareWindows,
    SoftwareLinux,
    SoftwareMacos,
    Document,         // pdf, epub, mobi, doc, txt
    Archive,          // zip, rar, 7z, tar.* — catch-all
    Game,
    Unknown,
}

/// A file record as reported by an indexer
pub struct FileRecord {
    pub hashes:        Vec<HashType>,
    pub names:         Vec<String>,
    pub size:          Option<u64>,
    pub content_type:  Option<ContentType>,
    pub tags:          Vec<(String, TagValue)>,
    pub sources:       Vec<Source>,
    /// For multi-file torrents: individual files inside this torrent [F006].
    pub torrent_files: Vec<TorrentFile>,
}

pub struct Source {
    pub protocol: Protocol,
    pub address:  String,            // "ip:port" or multiaddr
    pub extra:    serde_json::Value,
}

/// One file within a multi-file torrent [F006]
pub struct TorrentFile {
    pub path:        String,
    pub size:        u64,
    pub file_index:  u32,
    pub sha256_root: Option<[u8; 32]>,
}

pub enum TagValue {
    Str(String),
    U64(u64),
    F64(f64),
    Bytes(Vec<u8>),
}
```

### 4.2 Coordinator ↔ Indexer Messages

```rust
/// Coordinator → Indexer: dispatch an active search [F004]
pub struct SearchJob {
    pub job_id:       Uuid,
    pub query:        String,
    pub callback_url: String,
}

/// Coordinator → Indexer: fetch metadata for a known hash [F012]
pub struct EnrichRequest {
    pub hash_type:    HashType,
    pub hash_value:   Vec<u8>,
    pub callback_url: String,
}

/// Coordinator → Indexer: seed popular hashes for DHT participation [F008]
pub struct SeedPopularRequest {
    pub hashes: Vec<PopularHash>,
}

pub struct PopularHash {
    pub hash:           HashType,
    pub canonical_name: String,
    pub size:           u64,
    pub source_count:   u32,
}

/// Indexer → Coordinator: batch of results [F003] [F004]
pub struct ResultBatch {
    pub job_id:     Option<Uuid>,   // None = passive crawl, Some = active search
    pub indexer_id: Uuid,           // identifies the reporting instance [F030]
    pub protocol:   Protocol,
    pub files:      Vec<FileRecord>,
}

/// Indexer → Coordinator: result of an enrich request [F012]
pub struct EnrichResult {
    pub hash_type:  HashType,
    pub hash_value: Vec<u8>,
    pub file:       Option<FileRecord>,
}

/// Indexer → Coordinator: stats snapshot [F016]
pub struct IndexerStats {
    pub indexer_id:           Uuid,
    pub protocol:             Protocol,
    pub peers_connected:      u32,
    pub crawl_rate:           f32,
    pub snoop_queue_depth:    u32,
    pub staging_queue_depth:  u32,
    pub uptime_secs:          u64,
}

/// Coordinator → Indexer: config push [F014] [F032]
pub struct ConfigUpdate {
    pub protocol: Protocol,
    pub config:   serde_json::Value,  // merged global + per-indexer override
}

/// Snoop queue entry [F007] [F015]
pub struct SnoopEntry {
    pub query:      String,
    pub hash:       Option<HashType>,
    pub hit_count:  u32,
    pub first_seen: DateTime<Utc>,
    pub last_seen:  DateTime<Utc>,
}

/// Indexer → Coordinator: registration payload [F002] [F030]
pub struct RegisterRequest {
    pub indexer_id: Uuid,    // stable UUID generated by indexer on first start, persisted locally
    pub protocol:   Protocol,
    pub url:        String,
    pub hostname:   String,
    pub version:    String,
}
```

### 4.3 The IndexerService Trait [F013]

```rust
#[async_trait]
pub trait IndexerService: Send + Sync {
    fn protocol(&self) -> Protocol;
    fn version(&self) -> &str;
    fn indexer_id(&self) -> Uuid;  // stable UUID, persisted to local state file [F030]

    async fn start(&self) -> Result<()>;
    async fn stop(&self) -> Result<()>;

    async fn search(&self, job: SearchJob) -> Result<()>;
    async fn enrich(&self, req: EnrichRequest) -> Result<()>;
    async fn seed_popular(&self, req: SeedPopularRequest) -> Result<()>;
    async fn stats(&self) -> Result<IndexerStats>;
    async fn apply_config(&self, config: serde_json::Value) -> Result<()>;
}
```

### 4.4 Provided Helpers [F013]

**`IndexerServer`** — wraps any `IndexerService` impl in an Axum HTTP server:
```rust
fn main() {
    let coordinator_url = std::env::var("OVERLORD_COORDINATOR_URL").unwrap();
    IndexerServer::new(MyIndexer::new(), coordinator_url)
        .serve("0.0.0.0:13301".parse()?)
        .await?;
}
```

On startup `IndexerServer` reads or generates the stable `indexer_id` UUID (persisted to
`./indexer-id`), then POSTs `RegisterRequest` to `A020`. The coordinator matches on
`(hostname, protocol)` — re-registration returns the existing UUID so config overrides
and history survive restarts [F030].

**`CoordinatorClient`** — typed HTTP client for all coordinator interactions:
```rust
impl CoordinatorClient {
    pub async fn post_results(&self, batch: ResultBatch) -> Result<()>;
    pub async fn post_enrich_result(&self, r: EnrichResult) -> Result<()>;
    pub async fn flush_snoop_queue(&self, e: Vec<SnoopEntry>) -> Result<()>;
    pub async fn restore_snoop_queue(&self, p: Protocol) -> Result<Vec<SnoopEntry>>;
    pub async fn get_popular_hashes(&self, p: Protocol, n: u32) -> Result<Vec<PopularHash>>;
}
```

---
