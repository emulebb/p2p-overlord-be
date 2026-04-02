# ID Index

Master ID reference for services, features, tables, APIs, workers, and legacy mappings.

## 15. ID Master Index

### Services
| ID | Package | Tech | Description |
|---|---|---|---|
| SVC-001 | `coordinator` | SvelteKit / Node.js | Coordinator — brain, DB owner, BFF, SSR UI |
| SVC-002 | `overlord-emule` | Rust | KAD + ED2K indexer |
| SVC-003 | `overlord-mainline` | Rust | BitTorrent DHT indexer |
| SVC-004 | `overlord-gnutella` | Rust | Gnutella G2 indexer |
| SVC-005 | `overlord-ipfs` | Rust | IPFS indexer |

### Features
| ID | Description |
|---|---|
| F001 | Coordinator central ownership (DB, config, API) |
| F002 | Indexer self-registration |
| F003 | Always-on passive crawl |
| F004 | Active search fan-out and job lifecycle (active → watching) |
| F005 | Cross-protocol hash deduplication + correlation engine (W002) |
| F006 | Torrent content cross-correlation (T008, T009, W003) |
| F007 | Snoop queue — intercept network queries, run them ourselves |
| F008 | DHT participation seeding — serve popular data back to networks |
| F009 | aria2 download integration (Phase 9) |
| F010 | Metalink 4 (RFC 5854) generation |
| F011 | Content-type inference taxonomy |
| F012 | Two-tier staging: raw_hashes → files enrichment and promotion |
| F013 | IndexerService trait + IndexerServer + CoordinatorClient helpers + OpenAPI contract |
| F014 | Central config ownership + hot-reload push to indexers |
| F015 | Snoop queue crash-safe persistence (flush/restore via T013) |
| F016 | Stats time-series sampling (W004, T015) |
| F017 | Full-text search with ranking (T005 — PostgreSQL tsvector GIN + ts_rank) |
| F018 | Trending feed — P2P Zeitgeist (T014, A009) |
| F019 | Demand Holes — most wanted, never found (T014, A010) |
| F020 | KAD Kad2 protocol — passive crawl + active search |
| F021 | ED2K server protocol — crawl + active search |
| F022 | BEP-51 passive crawl — mainline DHT firehose |
| F023 | BEP-9 metadata fetch — torrent info enrichment |
| F024 | Gnutella G2 hub/leaf — passive crawl + active search |
| F025 | IPFS libp2p DHT PROVIDE crawl |
| F026 | IPFS pubsub topic subscription |
| F027 | IPFS known directory walker |
| F028 | IPFS cross-protocol CID correlation intake |
| F029 | IPFS UnixFS metadata fetch (enrichment) |
| F030 | Multi-indexer: multiple instances per protocol, fan-out strategies, offline detection |
| F031 | Download client abstraction: DownloadManager, multiple backends, protocol routing |
| F032 | Per-indexer config overrides (T016.config_override, merged on push) |
| F033 | Auth stub: A033/A034 exist (501), AUTH_ENABLED flag, session infrastructure defined |

### Database Tables
| ID | Name | Description |
|---|---|---|
| T001 | `raw_hashes` | Staging tier — unenriched hashes |
| T002 | `files` | Promoted tier — fully enriched file records |
| T003 | `file_hashes` | Cross-protocol hash dedup map |
| T004 | `file_names` | Multiple names per file (with tsvector column) |
| T005 | `file_names.name_tsv` | GIN-indexed tsvector on file_names [F017] |
| T006 | `file_tags` | Flexible metadata tags |
| T007 | `sources` | Where to get the file (per protocol) |
| T008 | `torrent_contents` | Individual files within multi-file torrents |
| T009 | `torrent_content_correlations` | Cross-torrent match registry |
| T010 | `search_jobs` | Active and watching search jobs (+ strategy, indexer_ids, routing_log) |
| T011 | `search_results` | File ↔ job linkage (+ indexer_id) |
| T012 | `download_jobs` | Download queue (+ client_id, client_gid) |
| T013 | `snoop_entries` | Snoop queue persistence store (keyed by indexer_id) |
| T014 | `snoop_log` | Timestamped query log (ring buffer, 30d) |
| T015 | `stats_samples` | Crawl stats time-series (ring buffer, 7d, keyed by indexer_id) |
| T016 | `indexer_registry` | Self-registered indexer instances (UUID PK, multi-instance per protocol) |
| T017 | `pruning_config` | Future pruning configuration |
| T018 | `download_clients` | Registered download client backends |

### API Endpoints
| ID | Method | Path | Description |
|---|---|---|---|
| A001 | POST | `/api/search` | Start search job (strategy, indexer_ids optional) |
| A002 | GET | `/api/search/:id/stream` | SSE search results stream |
| A003 | GET | `/api/search/:id` | Job status + routing_log |
| A004 | GET | `/api/files` | Browse files (FTS + filters) |
| A005 | GET | `/api/files/:id` | Full file record |
| A006 | GET | `/api/files/:id/metalink` | Metalink 4 XML |
| A007 | GET | `/api/files/:id/in-torrents` | Torrents containing this file |
| A008 | GET | `/api/torrents/:btih/contents` | Files within a torrent |
| A009 | GET | `/api/trending` | Trending queries |
| A010 | GET | `/api/demand` | Demand holes |
| A011 | GET | `/api/stats/history` | Stats time-series |
| A012 | GET | `/api/status` | Coordinator health |
| A013 | GET | `/api/stats` | Live per-indexer stats |
| A014 | GET | `/api/indexers` | All registered indexer instances |
| A015 | POST | `/api/download` | Queue download job |
| A016 | GET | `/api/downloads` | All download jobs |
| A017 | GET | `/api/downloads/:id` | Download job detail |
| A018 | DELETE | `/api/downloads/:id` | Cancel download |
| A019 | GET | `/api/feed` | Global SSE feed |
| A020 | POST | `/api/internal/register` | Indexer self-registration (UUID dedup by hostname+protocol) |
| A021 | POST | `/api/internal/results` | Ingest result batch |
| A022 | POST | `/api/internal/enrich-result` | Ingest enrichment result |
| A023 | POST | `/api/internal/snoop-flush` | Persist snoop queue |
| A024 | GET | `/api/internal/snoop-restore/:indexer_id` | Restore snoop queue |
| A025 | GET | `/api/internal/popular-hashes` | Popular hashes for DHT seeding |
| A026 | GET | `/api/indexers/:id` | Indexer detail + config override |
| A027 | PATCH | `/api/indexers/:id/config` | Store + push per-indexer config override |
| A028 | GET | `/api/download-clients` | List download clients + ping status |
| A029 | POST | `/api/download-clients` | Add download client |
| A030 | PUT | `/api/download-clients/:id` | Update download client |
| A031 | DELETE | `/api/download-clients/:id` | Remove download client |
| A032 | GET | `/api/download-clients/:id/ping` | Live health check |
| A033 | POST | `/api/auth/login` | Login (501 stub) |
| A034 | POST | `/api/auth/logout` | Logout (501 stub) |

### Background Workers
| ID | Description | Interval |
|---|---|---|
| W001 | Enrichment worker — drains T001, dispatches EnrichRequest | continuous |
| W002 | Cross-network hash correlation — links files by name+size | 5 min |
| W003 | Torrent content cross-correlation — T008 dedup | on each T008 write |
| W004 | Stats sampler — polls all online indexers, writes T015 | 60s |
| W005 | DHT seeding — pushes popular hashes to all online indexers | 10 min |
| W006 | Ring-buffer pruner — T014 and T015 retention | hourly |
| W007 | Passive crawl loops — one instance per protocol per indexer | continuous |
| W008 | Download client progress poller — updates T012 (Phase 9) | 5s |
| W009 | Indexer offline detector — marks stale T016 rows offline | 60s |

### Legacy Backlog IDs
| Legacy ID | Canonical backlog ID |
|---|---|
| B001 | ITEM_011 |
| B002 | ITEM_012 |
| B003 | ITEM_013 |
| B004 | ITEM_014 |
| B005 | ITEM_015 |
| B006 | ITEM_016 |
| B007 | ITEM_017 |
| B008 | ITEM_018 |
| B009 | ITEM_019 |
| B010 | ITEM_020 |
| B011 | ITEM_021 |
| B012 | ITEM_022 |
| B013 | ITEM_023 |
| B014 | ITEM_024 |
| B015 | ITEM_025 |
| B016 | ITEM_026 |
| B017 | ITEM_027 |
| B018 | ITEM_028 |
| B019 | ITEM_029 |
| B020 | ITEM_030 |
