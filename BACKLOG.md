# Backlog

Canonical active backlog for the Overlord workspace.

This is the only active backlog file. Legacy backlog markdown sources have been consolidated here.

## Table of Contents

- [Status Vocabulary](#status-vocabulary)
- [Summary](#summary)
- [Network And Protocol Backlog](#network-and-protocol-backlog)
- [Deferred Product And Platform Backlog](#deferred-product-and-platform-backlog)

## Status Vocabulary

| Status | Meaning |
|---|---|
| `TODO` | Accepted work that is not started yet |
| `IN_PROGRESS` | Active work or active investigation |
| `BLOCKED` | Accepted work waiting on an external dependency or prerequisite |
| `DONE` | Completed item, to be archived out of the active backlog |
| `REJECTED` | Explicitly declined item, to be archived out of the active backlog |

## Summary

| Status | Count |
|---|---:|
| `IN_PROGRESS` | 1 |
| `TODO` | 28 |
| `BLOCKED` | 0 |
| `DONE` | 1 |
| `REJECTED` | 0 |

| ID | Title | Status | Priority | Area | Source |
|---|---|---|---|---|---|
| `ITEM_001` | Improve Kad publish acceptance parity and validate harvest warm-up | `IN_PROGRESS` | `P1` | `kad` | `TODO-20260322-001`, `TODONEXTKAD` |
| `ITEM_002` | Fix Kad publish observability roll-up counters in agent stats | `TODO` | `P1` | `kad_observability` | `TODO-20260322-001` |
| `ITEM_003` | Fix lingering UPnP mappings after real agent shutdown | `TODO` | `P1` | `nat` | `TODO-20260321-001` |
| `ITEM_004` | Finish oracle-like Kad transport and packet-tracking parity | `TODO` | `P1` | `kad_net` | `TODONEXTKAD` |
| `ITEM_005` | Align passive source-search scheduling cadence and replay ordering with the oracle | `TODO` | `P1` | `kad_replay` | `TODO-20260322-001`, `TODONEXTKAD` |
| `ITEM_006` | Preserve full snooped request shape for passive replay fidelity | `TODO` | `P1` | `kad_replay` | `TODONEXTKAD` |
| `ITEM_007` | Preserve per-author Kad notes results after live validation | `TODO` | `P1` | `kad_notes` | `TODONEXTKAD` |
| `ITEM_008` | Port routing `CanSplit` and per-bin `/24` clustering rules | `DONE` | `P1` | `kad_routing` | `TODONEXTKAD` |
| `ITEM_009` | Rename misleading Kad proto semantic fields | `TODO` | `P2` | `kad_proto` | `TODONEXTKAD` |
| `ITEM_010` | Complete ED2K server keyword-search parity on real servers | `TODO` | `P2` | `ed2k` | `TODO-20260322-001` |
| `ITEM_011` | Add Prometheus metrics and Grafana dashboards | `TODO` | `P3` | `observability` | `OVERLORD:B001` |
| `ITEM_012` | Implement real password login behind the auth stub | `TODO` | `P3` | `auth` | `OVERLORD:B002` |
| `ITEM_013` | Add content hash blocklist integration | `TODO` | `P3` | `safety` | `OVERLORD:B003` |
| `ITEM_014` | Implement coordinator HA and indexer sharding | `TODO` | `P3` | `architecture` | `OVERLORD:B004` |
| `ITEM_015` | Share indexed content back to all supported networks | `TODO` | `P3` | `network_participation` | `OVERLORD:B005` |
| `ITEM_016` | Add native in-process downloaders | `TODO` | `P4` | `downloaders` | `OVERLORD:B006` |
| `ITEM_017` | Add live queue rate adjustment from the frontend | `TODO` | `P4` | `frontend` | `OVERLORD:B007` |
| `ITEM_018` | Build a correlation log review UI | `TODO` | `P4` | `frontend` | `OVERLORD:B008` |
| `ITEM_019` | Enforce source TTL pruning | `TODO` | `P3` | `coordinator_db` | `OVERLORD:B009` |
| `ITEM_020` | Enforce file TTL pruning | `TODO` | `P3` | `coordinator_db` | `OVERLORD:B010` |
| `ITEM_021` | Add an append-only correlation log table | `TODO` | `P4` | `coordinator_db` | `OVERLORD:B011` |
| `ITEM_022` | Revisit Gnutella 1 support only if G2 proves insufficient | `TODO` | `P5` | `gnutella` | `OVERLORD:B012` |
| `ITEM_023` | Add audio and video perceptual fingerprinting | `TODO` | `P5` | `correlation` | `OVERLORD:B013` |
| `ITEM_024` | Generate `.torrent` files from held metadata | `TODO` | `P4` | `bittorrent` | `OVERLORD:B014` |
| `ITEM_025` | Auto-boost demand holes into the enrichment queue | `TODO` | `P3` | `enrichment` | `OVERLORD:B015` |
| `ITEM_026` | Add outbound alerts and webhooks for matching promoted files | `TODO` | `P4` | `notifications` | `OVERLORD:B016` |
| `ITEM_027` | Add remote indexer crawl pause and resume controls | `TODO` | `P4` | `operations` | `OVERLORD:B017` |
| `ITEM_028` | Add coordinator-pushed indexer binary updates | `TODO` | `P4` | `operations` | `OVERLORD:B018` |
| `ITEM_029` | Add download completion post-processing hooks | `TODO` | `P4` | `downloads` | `OVERLORD:B019` |
| `ITEM_030` | Add per-indexer throughput graphs in the management UI | `TODO` | `P4` | `frontend` | `OVERLORD:B020` |

## Network And Protocol Backlog

### `ITEM_001` — Improve Kad publish acceptance parity and validate harvest warm-up

- Status: `IN_PROGRESS`
- Priority: `P1`
- Area: `kad`
- Source: `TODO-20260322-001`, `TODONEXTKAD`
- Summary: Lift Overlord publish acceptance density toward the oracle and re-check whether stronger publish acceptance starts warming harvested demand on the live network.
- Next steps: Fix the remaining acceptance-rate gap, run longer matched agent/oracle sessions, compare accepted versus timed-out contacts, and preserve the first session where unsolicited demand clearly warms up.

### `ITEM_002` — Fix Kad publish observability roll-up counters in agent stats

- Status: `TODO`
- Priority: `P1`
- Area: `kad_observability`
- Source: `TODO-20260322-001`
- Summary: Bring aggregate publish counters in `/api/internal/stats` into line with the already-correct per-batch publish telemetry.
- Next steps: Align aggregate keyword and source counters with the batch accounting path and verify them during a real publish session.

### `ITEM_003` — Fix lingering UPnP mappings after real agent shutdown

- Status: `TODO`
- Priority: `P1`
- Area: `nat`
- Source: `TODO-20260321-001`
- Summary: The real end-to-end agent run can still leave `41000/41001` mappings behind after shutdown even though the live UPnP path works and manual cleanup succeeds.
- Next steps: Trace shutdown-time mapping release, compare real-run teardown with the working direct UPnP path, and preserve the first clean run where the mappings disappear automatically.

### `ITEM_004` — Finish oracle-like Kad transport and packet-tracking parity

- Status: `TODO`
- Priority: `P1`
- Area: `kad_net`
- Source: `TODONEXTKAD`
- Summary: Finish the remaining obfuscation and packet-tracking work so the runtime looks and behaves more like modern eMule traffic under load.
- Next steps: Port the remaining transport details, replace generic packet tracking with oracle-like logic, and keep re-validating against live captures.

### `ITEM_005` — Align passive source-search scheduling cadence and replay ordering with the oracle

- Status: `TODO`
- Priority: `P1`
- Area: `kad_replay`
- Source: `TODO-20260322-001`, `TODONEXTKAD`
- Summary: Source replay is live, but source-search scheduling and replay ordering still diverge from the oracle enough to affect result density.
- Next steps: Port oracle-like source-search cadence, tighten replay ordering and filtering, and compare zero-result versus non-zero-result runs after each scheduling change.

### `ITEM_006` — Preserve full snooped request shape for passive replay fidelity

- Status: `TODO`
- Priority: `P1`
- Area: `kad_replay`
- Source: `TODONEXTKAD`
- Summary: The current snoop queue is still too target-centric to preserve all oracle-relevant keyword, source, and notes request details.
- Next steps: Extend the stored request shape, keep conversion localized at the edge, and replay the same demand shape the network actually asked for.

### `ITEM_007` — Preserve per-author Kad notes results after live validation

- Status: `TODO`
- Priority: `P1`
- Area: `kad_notes`
- Source: `TODONEXTKAD`
- Summary: Coordinator-triggered Kad notes search is already wired end to end and was validated live on April 2, 2026. The remaining gap is result modeling: note replies are still projected into file-centric search results, so distinct note authors would collapse onto one file record.
- Next steps: Add a note-aware coordinator result shape that preserves author identity at ingest and API boundaries, then rerun live validation against a file that returns multiple notes.

### `ITEM_008` — Port routing `CanSplit` and per-bin `/24` clustering rules

- Status: `DONE`
- Priority: `P1`
- Area: `kad_routing`
- Source: `TODONEXTKAD`
- Summary: The oracle `CanSplit` predicate and per-bin two-per-`/24` anti-clustering cap are already in the Rust routing table and were live-validated on April 2, 2026. This pass added explicit rejection reasons, routing-side observability, targeted tests, and real-network evidence showing oracle-style split decisions during bootstrap and healthy live lookup results.
- Next steps: Archive this item out of the active backlog on the next backlog cleanup pass. Treat any future routing work as new follow-up items tied to a concrete live behavior gap, not as unfinished `CanSplit` or per-bin `/24` parity.

### `ITEM_009` — Rename misleading Kad proto semantic fields

- Status: `TODO`
- Priority: `P2`
- Area: `kad_proto`
- Source: `TODONEXTKAD`
- Summary: Some wire-correct proto fields still expose the wrong mental model in Rust, which increases maintenance risk during parity work.
- Next steps: Rename the misleading fields, update call sites, and keep the wire shape unchanged.

### `ITEM_010` — Complete ED2K server keyword-search parity on real servers

- Status: `TODO`
- Priority: `P2`
- Area: `ed2k`
- Source: `TODO-20260322-001`
- Summary: The ED2K active keyword path is wired through job lifecycle and result posting, but real server searches are still timing out without `OP_SEARCHRESULT`.
- Next steps: Tighten real-server handshake and request parity, then expand into source and notes search only after keyword results work reliably.

## Deferred Product And Platform Backlog

### `ITEM_011` — Add Prometheus metrics and Grafana dashboards

- Status: `TODO`
- Priority: `P3`
- Area: `observability`
- Source: `OVERLORD:B001`
- Summary: Expose service metrics and dashboards for live operational visibility.
- Next steps: Add `/metrics` endpoints, define dashboard scope, and keep metric naming consistent across services.

### `ITEM_012` — Implement real password login behind the auth stub

- Status: `TODO`
- Priority: `P3`
- Area: `auth`
- Source: `OVERLORD:B002`
- Summary: Replace the current auth stub with a real password-based admin login flow.
- Next steps: Add password storage, session handling, and route enforcement behind the existing auth surfaces.

### `ITEM_013` — Add content hash blocklist integration

- Status: `TODO`
- Priority: `P3`
- Area: `safety`
- Source: `OVERLORD:B003`
- Summary: Support filtering known-bad content by hash.
- Next steps: Define ingest and enforcement points and keep blocklist handling auditable.

### `ITEM_014` — Implement coordinator HA and indexer sharding

- Status: `TODO`
- Priority: `P3`
- Area: `architecture`
- Source: `OVERLORD:B004`
- Summary: PostgreSQL is already adopted, but coordinator HA and indexer sharding are still deferred.
- Next steps: Define shard ownership, failover behavior, and coordination semantics before implementation.

### `ITEM_015` — Share indexed content back to all supported networks

- Status: `TODO`
- Priority: `P3`
- Area: `network_participation`
- Source: `OVERLORD:B005`
- Summary: Extend outbound participation beyond current seeding slices into broader sharing behavior.
- Next steps: Define per-network sharing policy and guard it with protocol-appropriate acceptance checks.

### `ITEM_016` — Add native in-process downloaders

- Status: `TODO`
- Priority: `P4`
- Area: `downloaders`
- Source: `OVERLORD:B006`
- Summary: Add in-process downloader implementations as alternatives to the external download-client abstraction.
- Next steps: Decide protocol order and preserve the current external-client path until native implementations are credible.

### `ITEM_017` — Add live queue rate adjustment from the frontend

- Status: `TODO`
- Priority: `P4`
- Area: `frontend`
- Source: `OVERLORD:B007`
- Summary: Let operators adjust queue and crawl rates live from the UI instead of only through TOML edits.
- Next steps: Define safe control surfaces and keep config/state consistency explicit.

### `ITEM_018` — Build a correlation log review UI

- Status: `TODO`
- Priority: `P4`
- Area: `frontend`
- Source: `OVERLORD:B008`
- Summary: Provide an admin UI to review and revert bad correlation or merge decisions.
- Next steps: Add the backing audit data first, then expose review and revert flows in the UI.

### `ITEM_019` — Enforce source TTL pruning

- Status: `TODO`
- Priority: `P3`
- Area: `coordinator_db`
- Source: `OVERLORD:B009`
- Summary: Enforce configured source TTL pruning rather than only defining the setting.
- Next steps: Add the pruning worker path and validate it against current schema and raw SQL naming rules.

### `ITEM_020` — Enforce file TTL pruning

- Status: `TODO`
- Priority: `P3`
- Area: `coordinator_db`
- Source: `OVERLORD:B010`
- Summary: Enforce configured file TTL pruning rather than only defining the setting.
- Next steps: Add the pruning worker path and validate it against current schema and raw SQL naming rules.

### `ITEM_021` — Add an append-only correlation log table

- Status: `TODO`
- Priority: `P4`
- Area: `coordinator_db`
- Source: `OVERLORD:B011`
- Summary: Persist correlation decisions in an append-only audit trail.
- Next steps: Add the table, define the write boundary, and keep naming consistent across SQL, Prisma, and UI DTOs.

### `ITEM_022` — Revisit Gnutella 1 support only if G2 proves insufficient

- Status: `TODO`
- Priority: `P5`
- Area: `gnutella`
- Source: `OVERLORD:B012`
- Summary: Gnutella 1 remains explicitly low priority and should be revisited only if G2 does not deliver enough value.
- Next steps: Keep this deferred until there is evidence that G2 coverage is insufficient.

### `ITEM_023` — Add audio and video perceptual fingerprinting

- Status: `TODO`
- Priority: `P5`
- Area: `correlation`
- Source: `OVERLORD:B013`
- Summary: Support deeper cross-protocol correlation beyond name and size with perceptual media fingerprints.
- Next steps: Choose the smallest viable fingerprinting scope and keep the enrichment cost bounded.

### `ITEM_024` — Generate `.torrent` files from held metadata

- Status: `TODO`
- Priority: `P4`
- Area: `bittorrent`
- Source: `OVERLORD:B014`
- Summary: Synthesize torrent files from metadata already held in the system.
- Next steps: Define minimum metadata requirements and output correctness guarantees.

### `ITEM_025` — Auto-boost demand holes into the enrichment queue

- Status: `TODO`
- Priority: `P3`
- Area: `enrichment`
- Source: `OVERLORD:B015`
- Summary: Elevate high-demand unresolved content automatically into the enrichment path.
- Next steps: Define the boost heuristic and make it visible in operator-facing observability.

### `ITEM_026` — Add outbound alerts and webhooks for matching promoted files

- Status: `TODO`
- Priority: `P4`
- Area: `notifications`
- Source: `OVERLORD:B016`
- Summary: Notify users or systems when promoted content matches registered demand.
- Next steps: Define the registration model and delivery guarantees before implementation.

### `ITEM_027` — Add remote indexer crawl pause and resume controls

- Status: `TODO`
- Priority: `P4`
- Area: `operations`
- Source: `OVERLORD:B017`
- Summary: Provide per-indexer operational pause and resume controls through the management surface.
- Next steps: Define the agent-control contract and UI behavior for safe operational pauses.

### `ITEM_028` — Add coordinator-pushed indexer binary updates

- Status: `TODO`
- Priority: `P4`
- Area: `operations`
- Source: `OVERLORD:B018`
- Summary: Let the coordinator distribute updated indexer binaries to registered nodes.
- Next steps: Define trust, rollout, and rollback behavior before implementation.

### `ITEM_029` — Add download completion post-processing hooks

- Status: `TODO`
- Priority: `P4`
- Area: `downloads`
- Source: `OVERLORD:B019`
- Summary: Support move, rename, and hook behavior after download completion.
- Next steps: Define backend hooks and state transitions without weakening current download job clarity.

### `ITEM_030` — Add per-indexer throughput graphs in the management UI

- Status: `TODO`
- Priority: `P4`
- Area: `frontend`
- Source: `OVERLORD:B020`
- Summary: Show per-indexer throughput trends in the management UI.
- Next steps: Define the timeseries inputs and keep the visual scope lightweight enough for the current UI.
