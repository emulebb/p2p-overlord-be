# Indexers

Indexer-specific behavior across the currently planned protocol agents.

## 6. eMule Indexer (`overlord-emule`) [SVC-002]

Two complementary layers of the same network under one service:
- **KAD (Kad2)** [F020]: decentralized DHT, XOR metric, eMule Kad2 wire protocol
- **ED2K servers** [F021]: centralized search index, TCP, `servers.met` list

Both share the same hash space (`Ed2kHash` / 128-bit MD4). Same hash = same file.

### 6.1 KAD Passive Keyspace Crawl [F020]

Continuous background loop (`W007` instance for KAD). Never stops.

1. Maintain routing table (zone tree, k-buckets, up to 12k contacts configurable)
2. Generate random `NodeId`s, send `Req` (find_node) → collect contacts, expand table
3. Drain snoop queue [F007] at configured throttle rate

### 6.2 Snoop Queue [F007]

Every incoming `SearchKeyReq` from another node reveals what the network wants.
Extract the keyword hash + query string → add to in-memory priority queue.

- **In-memory** during operation; flushed to `T013` via `A023` every 60s and on shutdown
- **Restored** from `T013` via `A024` on restart — crash-safe [F015]
- Sorted by `hit_count` (most queried = top of queue)
- Each drain tick: with probability `random_pick_probability` (default 5%), pick a random
  low-priority entry — prevents starvation of rare content
- Dedup window: same query within 8 hours (configurable) → increment `hit_count`, no dup
- User `SearchJob`s [F004] bypass queue entirely — no throttle applied
- Drain rate: `max_queries_per_600s` (configurable, default 60)
- Every snooped query also appended to `T014` (`snoop_log`) for `F018`/`F019`

**Cold start [F007]:** bundled wordlist (`nc-emule/wordlist/default.txt`, ~5000 terms)
seeds the queue. Snooped queries accumulate; their `hit_count`s naturally displace
wordlist entries over time.

### 6.3 KAD Active Search [F020]

On `SearchJob` from coordinator:
1. Compute `sha1(query)` → target `NodeId`
2. Kad2 traversal: Phase 1 (Req/Res lookups) + Phase 2 (SearchKeyReq to K closest nodes)
3. Collect `SearchRes` packets → build `FileRecord`s with full tag set (Windows-1252 fallback)
4. Multiple `POST A021` as traversal progresses — results stream in real time

### 6.4 DHT Seeding [F008]

On `seed_popular` from coordinator (`W005`):
- Call `PublishKeyReq` to the K closest KAD nodes for each popular file's keywords
- We become a known publisher → other clients searching those terms find us, join routing
  table → more `SearchKeyReq` traffic → more snooped queries [F007]

### 6.5 ED2K Server Crawl [F021]

**Server list management:**
- Parse `servers.met` (binary eMule format) + plain-text fallback
- Auto-update from known public sources on startup and every 24h
- Bundled starter list for cold start

**Passive crawl (`W007` instance for ED2K):**
- Pool of N simultaneous server connections (configurable)
- Per connection: rotate through shared wordlist + snoop queue, send `SearchReq`
- Mine `ServerInfo` / `ServerList` broadcasts → discover new servers
- Results → `FileRecord` → `POST A021`

**Active search [F004]:**
- `SearchJob` received → query all connected servers in parallel → `POST A021`

**Note:** ED2K server protocol does not expose other users' searches.
Snoop queue [F007] applies to KAD only within this indexer.

### 6.6 Wire Protocol Foundation

Migrated and refactored from `kadkad`:
- `proto`: Kad2 packet codec (binrw), all opcodes, tag system, Windows-1252 fallback
- `routing`: zone tree, k-buckets, XOR distance, contact management
- `net`: UDP transport, RC4 obfuscation, RPC manager, flood detection, rate limiting
- `ed2k_proto`: **new** — ED2K server TCP protocol (login, search, server list exchange)

---

## 7. Mainline DHT Indexer (`overlord-mainline`) [SVC-003]

BEP-5 DHT + BEP-9 metadata + BEP-51 crawl + BT v2 support.
Highest-volume indexer. BEP-51 alone can yield millions of infohashes per day.

### 7.1 BEP-51 Passive Crawl [F022]

Worker `W007` instance for mainline:
1. Maintain routing table (Kademlia, bencode over UDP)
2. Send `sample_infohashes` to random nodes
3. Each response: up to 20 infohashes + 8 closer nodes
4. Recurse → exponential network coverage
5. All infohashes → `POST A021` → `T001` staging (`W001` dispatches `F023` enrichment)

### 7.2 Snoop Queue [F007]

- `get_peers` received: another client is actively looking for this btih right now
  → add to snoop queue with high priority → `F023` enrichment fast-tracked
- `announce_peer` received: a client is currently seeding this torrent
  → same fast-track. More peers = higher BEP-9 fetch success likelihood
- Flushed to `T013`, restored via `A024` [F015]
- Appended to `T014` for `F018`/`F019`

### 7.3 BEP-9 Metadata Fetch [F023]

On `EnrichRequest` for a btih:
1. `get_peers` DHT query → find peers seeding this torrent
2. TCP connect → BEP-10 Extension Protocol handshake → `ut_metadata`
3. Fetch info dict in pieces (BEP-9)
4. Parse:
   - **Single-file**: name, length → `FileRecord`
   - **Multi-file**: root name, file list (path, length each) →
     `FileRecord` + `TorrentFile[]` array populated [F006]
5. **BT v2**: if v2 info dict present → extract per-file `sha256_root` → `T008` for
   exact cross-torrent correlation by `W003` [F006]
6. `POST A022` → promotion attempt

### 7.4 DHT Seeding [F008]

On `seed_popular`:
- Respond positively to `get_peers` for known btih hashes, pointing queriers to sources
  from `T007` → drives `announce_peer` traffic to us → more snooped queries [F007]

### 7.5 Active Search [F004]

Mainline DHT has no keyword search. On `SearchJob`:
- If query looks like a hex hash (40 chars) or base32 → treat as btih, run `get_peers`
- Otherwise → acknowledge, return empty (FTS in `A004` covers keyword matching)

---

## 8. Gnutella Indexer (`overlord-gnutella`) [SVC-004]

G2 hub/leaf topology. Distinct content universe. SHA1 + TTH hashes. Minimal hash overlap
with eMule/BT, but `W002` [F005-W] links files by name+size across protocols.

### 8.1 Topology & Bootstrap [F024]

- We operate as a **leaf** connected to N hubs simultaneously
- Bootstrap: GWebCache HTTP lookups + bundled hub list for cold start

### 8.2 Passive Crawl [F024]

Worker `W007` instance for Gnutella:
1. Maintain hub pool (configurable size)
2. Receive `/QH2` query hits pushed by hubs — free file announcements, no queries needed
3. Send `/BH` browse-host to hubs → their full shared file list on demand
4. Parse: filename, size, SHA1, TTH → `FileRecord` → `POST A021`

### 8.3 Snoop Queue [F007]

Incoming `/Q2` queries from other leaves reveal what G2 is searching for.
Same mechanics as KAD snoop queue. Flushed to `T013` [F015]. Logged to `T014` [F018].

### 8.4 Active Search & DHT Seeding [F004] [F008]

- `SearchJob` → `/Q2` to all connected hubs → collect `/QH2` → `POST A021`
- `seed_popular` → include popular files in our shared file list advertised to hubs

---

## 9. IPFS Indexer (`overlord-ipfs`) [SVC-005]

Content-addressed, not keyword-searchable at DHT level. Four parallel strategies to collect
CIDs; enrichment derives metadata from the content itself.

### 9.1 Strategy A — libp2p DHT PROVIDE Crawl [F025]

Worker `W007` instance for IPFS:
- Run libp2p DHT node (Kademlia over TCP, multiaddr)
- Listen for `PROVIDE` records: peers announcing they have a CID → `T001` staging

### 9.2 Strategy B — Pubsub Topics [F026]

- Subscribe to known IPFS pubsub topics where content is announced
- Extract CIDs from messages → `T001` staging

### 9.3 Strategy C — Known Directory Crawl [F027]

- Periodically walk known high-value directory CIDs (configurable list)
- Fetch `dag-json` / UnixFS listings → child CIDs + filenames → direct promotion bypass

### 9.4 Strategy D — Cross-Protocol CID Correlation [F028]

- Other indexers surface IPFS URIs embedded in metadata (magnet links with CID,
  ED2K comments, torrent descriptions)
- Coordinator flags these; IPFS indexer receives them as `EnrichRequest`s [F012]

### 9.5 DHT Seeding [F008]

On `seed_popular`: publish `PROVIDE` records for popular CIDs → we become a provider
for popular content → attracts more lookups and PROVIDE observations.

### 9.6 Metadata Fetch [F029]

On `EnrichRequest` for a CID:
1. Fetch `dag-json` → determine structure
2. Directory → list entries → filenames + sizes → `FileRecord`
3. File → stat via UnixFS node header (size only, no content downloaded)
4. `POST A022`

---
