# Frontend

Frontend pages, live feeds, and UI-facing behavior.

## 10. Frontend (embedded in SVC-001)

The frontend is part of the SvelteKit coordinator package — no separate service or build
artifact. SvelteKit SSR renders pages server-side on the coordinator Node.js process and
hydrates them client-side for reactivity.

### 10.1 Pages

**Search [F004] [F017]**
- Full-text search box; FTS-backed results [F017]
- Live SSE stream via `A002`; cards show filename, size, content type badge, protocol
  badges, source count
- Watching state shown with "still listening..." indicator
- Sort by availability (default), recency, protocol count — user-switchable
- Strategy selector: broadcast / round_robin / least_busy [F030]
- Optional indexer filter: multi-select of registered instances [F030]

**Browse**
- Paginated file list via `A004`
- Filter: protocol, content_type, size range, date range

**Dashboard**
- Per-indexer live stats (peers, results/min, snoop queue depth) via `A019` [F030]
- DB overview: total files, sources, staging depth, dead hashes
- Sparkline charts from `A011` time-series (24h crawl rate per protocol) [F016]
- Indexer health: per-instance green/red with hostname, version, last seen [F030]
- Live new-file feed from `A019` `new_file` events
- **P2P Zeitgeist widget** [F018]: top trending queries, updates every 60s
- **Demand Holes widget** [F019]: "most wanted, never found" top 10

**File Detail**
- All hashes with copy-to-clipboard per hash type
- One-click magnet link composition (`magnet:?xt=urn:...` for all hashes)
- Download Metalink button → `A006` [F010]
- All names across protocols (collapsible)
- All sources with protocol badges (collapsible, paginated)
- Full tag list (codec, bitrate, resolution, etc.)
- **"Found in X torrents"** section → `A007` [F006]
- Torrent file tree (if the file IS a multi-file torrent)
- **Download button** [F031]: dropdown of available clients sorted by priority;
  submits to `A015` with selected `client_id`

**Torrent Detail** (`/torrents/:btih`)
- Torrent root name, total size, file count
- File tree from `A008`; each file links to its canonical File Detail if correlated [F006]

**Downloads** [F009] [F031]
- Queue via `A016`: filename, client name, progress bar, status, cancel button

**Indexers** [F030] [F032]
- Table: id, protocol, hostname, url, version, status, last_seen
- Expand row: per-indexer config override editor (→ `A027`) and stats history

**Download Clients** [F031]
- Table: name, type, url, protocols, priority, enabled, live ping status
- Add / edit / delete via `A029`–`A031`; ping button → `A032`

### 10.2 SSE Connections

1. **`A019` `/api/feed`** — always open. Powers dashboard.
2. **`A002` `/api/search/:id/stream`** — per search job. Supports `Last-Event-ID` resume.

---
