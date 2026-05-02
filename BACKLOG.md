# Backlog

Canonical active backlog for the Overlord workspace.

This is the only active backlog file. Legacy backlog markdown sources have been consolidated here.

## Table of Contents

- [Status Vocabulary](#status-vocabulary)
- [Summary](#summary)
- [ED2K Full Parity Lane](#ed2k-full-parity-lane)
- [Kad Live-Acceptance Lane](#kad-live-acceptance-lane)
- [Completed Protocol Context](#completed-protocol-context)
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
| `IN_PROGRESS` | 5 |
| `TODO` | 28 |
| `BLOCKED` | 0 |
| `DONE` | 3 |
| `REJECTED` | 0 |

Active protocol work is tracked in two lanes:

- ED2K full parity: finish stock eMule `v0.72a` parity for every
  still-advertised non-obsolete ED2K behavior.
- Kad live acceptance: close the remaining live-network acceptance,
  replay-fidelity, notes-modeling, transport, and NAT cleanup gaps.

Completed protocol items remain visible in this file for context, but they do
not drive active priority order.

| ID | Title | Status | Priority | Lane | Area | Source |
|---|---|---|---|---|---|---|
| `ITEM_010` | Drive ED2K parity beyond server search toward native sharing and transfer | `IN_PROGRESS` | `P1` | `ed2k_full_parity` | `ed2k` | `TODO-20260322-001` |
| `ITEM_031` | Implement truthful modern AICH generation, transport, and verification | `IN_PROGRESS` | `P1` | `ed2k_full_parity` | `ed2k_aich` | `ED2K_072A_FULL_PARITY_TRACKER` |
| `ITEM_032` | Make still-advertised non-obsolete ED2K features truthful | `IN_PROGRESS` | `P1` | `ed2k_full_parity` | `ed2k_truthfulness` | `ED2K_072A_FULL_PARITY_TRACKER` |
| `ITEM_033` | Port stock UploadQueue credit, score, LowID, and friend-slot behavior | `IN_PROGRESS` | `P1` | `ed2k_full_parity` | `ed2k_upload_queue` | `ED2K_072A_FULL_PARITY_TRACKER` |
| `ITEM_034` | Complete buddy and callback parity for firewalled ED2K mode | `TODO` | `P1` | `ed2k_full_parity` | `ed2k_low_id` | `ED2K_072A_FULL_PARITY_TRACKER` |
| `ITEM_035` | Add preview, browsing, and active notes parity surfaces | `TODO` | `P1` | `ed2k_full_parity` | `ed2k_surface` | `ED2K_072A_FULL_PARITY_TRACKER` |
| `ITEM_036` | Tighten downloader scheduling and broader server-session parity | `TODO` | `P1` | `ed2k_full_parity` | `ed2k_scheduler` | `ED2K_072A_FULL_PARITY_TRACKER` |
| `ITEM_001` | Improve Kad publish acceptance parity and validate harvest warm-up | `IN_PROGRESS` | `P1` | `kad_live_acceptance` | `kad` | `TODO-20260322-001`, `TODONEXTKAD` |
| `ITEM_004` | Finish oracle-like Kad transport and packet-tracking parity | `TODO` | `P1` | `kad_live_acceptance` | `kad_net` | `TODONEXTKAD` |
| `ITEM_005` | Align passive source-search scheduling cadence and replay ordering with the oracle | `TODO` | `P1` | `kad_live_acceptance` | `kad_replay` | `TODO-20260322-001`, `TODONEXTKAD` |
| `ITEM_006` | Preserve full snooped request shape for passive replay fidelity | `TODO` | `P1` | `kad_live_acceptance` | `kad_replay` | `TODONEXTKAD` |
| `ITEM_007` | Preserve per-author Kad notes results after live validation | `TODO` | `P1` | `kad_live_acceptance` | `kad_notes` | `TODONEXTKAD` |
| `ITEM_003` | Fix lingering UPnP mappings after real agent shutdown | `TODO` | `P1` | `kad_live_acceptance` | `nat` | `TODO-20260321-001` |
| `ITEM_002` | Fix Kad publish observability roll-up counters in agent stats | `DONE` | `P1` | `completed_context` | `kad_observability` | `TODO-20260322-001` |
| `ITEM_008` | Port routing `CanSplit` and per-bin `/24` clustering rules | `DONE` | `P1` | `completed_context` | `kad_routing` | `TODONEXTKAD` |
| `ITEM_009` | Rename misleading Kad proto semantic fields | `DONE` | `P2` | `completed_context` | `kad_proto` | `TODONEXTKAD` |
| `ITEM_011` | Add Prometheus metrics and Grafana dashboards | `TODO` | `P3` | `deferred_platform` | `observability` | `OVERLORD:B001` |
| `ITEM_012` | Implement real password login behind the auth stub | `TODO` | `P3` | `deferred_platform` | `auth` | `OVERLORD:B002` |
| `ITEM_013` | Add content hash blocklist integration | `TODO` | `P3` | `deferred_platform` | `safety` | `OVERLORD:B003` |
| `ITEM_014` | Implement coordinator HA and indexer sharding | `TODO` | `P3` | `deferred_platform` | `architecture` | `OVERLORD:B004` |
| `ITEM_015` | Share indexed content back to all supported networks | `TODO` | `P3` | `deferred_platform` | `network_participation` | `OVERLORD:B005` |
| `ITEM_019` | Enforce source TTL pruning | `TODO` | `P3` | `deferred_platform` | `coordinator_db` | `OVERLORD:B009` |
| `ITEM_020` | Enforce file TTL pruning | `TODO` | `P3` | `deferred_platform` | `coordinator_db` | `OVERLORD:B010` |
| `ITEM_025` | Auto-boost demand holes into the enrichment queue | `TODO` | `P3` | `deferred_platform` | `enrichment` | `OVERLORD:B015` |
| `ITEM_016` | Add native in-process downloaders | `TODO` | `P4` | `deferred_platform` | `downloaders` | `OVERLORD:B006` |
| `ITEM_017` | Add live queue rate adjustment from the frontend | `TODO` | `P4` | `deferred_platform` | `frontend` | `OVERLORD:B007` |
| `ITEM_018` | Build a correlation log review UI | `TODO` | `P4` | `deferred_platform` | `frontend` | `OVERLORD:B008` |
| `ITEM_021` | Add an append-only correlation log table | `TODO` | `P4` | `deferred_platform` | `coordinator_db` | `OVERLORD:B011` |
| `ITEM_024` | Generate `.torrent` files from held metadata | `TODO` | `P4` | `deferred_platform` | `bittorrent` | `OVERLORD:B014` |
| `ITEM_026` | Add outbound alerts and webhooks for matching promoted files | `TODO` | `P4` | `deferred_platform` | `notifications` | `OVERLORD:B016` |
| `ITEM_027` | Add remote indexer crawl pause and resume controls | `TODO` | `P4` | `deferred_platform` | `operations` | `OVERLORD:B017` |
| `ITEM_028` | Add coordinator-pushed indexer binary updates | `TODO` | `P4` | `deferred_platform` | `operations` | `OVERLORD:B018` |
| `ITEM_029` | Add download completion post-processing hooks | `TODO` | `P4` | `deferred_platform` | `downloads` | `OVERLORD:B019` |
| `ITEM_030` | Add per-indexer throughput graphs in the management UI | `TODO` | `P4` | `deferred_platform` | `frontend` | `OVERLORD:B020` |
| `ITEM_022` | Revisit Gnutella 1 support only if G2 proves insufficient | `TODO` | `P5` | `deferred_platform` | `gnutella` | `OVERLORD:B012` |
| `ITEM_023` | Add audio and video perceptual fingerprinting | `TODO` | `P5` | `deferred_platform` | `correlation` | `OVERLORD:B013` |

## ED2K Full Parity Lane

This lane is the main active parity sequence. The target remains full stock
eMule `v0.72a` parity, excluding only explicitly obsolete ED2K surfaces. Do not
open later feature-surface work as complete while earlier advertised behavior
is still untruthful.

### `ITEM_010` — Drive ED2K parity beyond server search toward native sharing and transfer

- Status: `IN_PROGRESS`
- Priority: `P1`
- Lane: `ed2k_full_parity`
- Area: `ed2k`
- Source: `TODO-20260322-001`
- Summary: ED2K keyword search, paged results, source search, offer-files advertisement, hash-only bootstrap, and the current live same-server roundtrip gates are now wired. Deterministic local large-file loopback coverage also exists for the active direct-ED2K and Kad-discovered transfer paths. On April 26, 2026, `kad2.cell.keyword.search.obfuscated.realnet.v1.obfuscated-20260426-204828` passed with a verified obfuscated live payload. The remaining job is full native stock `v0.72a` parity for non-obsolete server and peer behavior without depending on an external client.
- Next steps: Close `ITEM_031` with fresh large-file real-network evidence, then drive `ITEM_032` through `ITEM_036` in order until every still-advertised non-obsolete surface is either implemented or honestly de-advertised.

### `ITEM_031` — Implement truthful modern AICH generation, transport, and verification

- Status: `IN_PROGRESS`
- Priority: `P1`
- Lane: `ed2k_full_parity`
- Area: `ed2k_aich`
- Source: `ED2K_072A_FULL_PARITY_TRACKER`
- Summary: Modern AICH transport and verifier acceptance are proven on the active path, and local stock-fixture coverage now asserts the expected tracing-harness AICH root plus part hashes for deterministic large payloads. The item remains open until a fresh large-file real-network roundtrip proves that locally generated AICH stays truthful outside the local harness matrix.
- Latest evidence: On May 2, 2026, `ed2k.cell.modern-aich.plaintext.server-roundtrip.large.realnet.v1.plaintext-20260502-154313` resolved the community tracing-harness runtime and reached live execution, but the AICH gate still failed in stage 1 because the agent acquired no usable sources, no MD4/AICH hashset, and no bytes for the harness-exported large file. The live stress cell `ed2k.cell.live-wire.stress.search-download.realnet.v1` then passed in bounded mode for all canonical terms: plaintext completed 4/6 downloads and obfuscated completed 2/6 downloads, with per-term search/source/dump evidence captured for `linux`, `ubuntu`, `fedora`, `freebsd`, `debian`, and `emule`. A later same-server AICH attempt, `ed2k.cell.modern-aich.plaintext.server-roundtrip.large.realnet.v1.plaintext-20260502-183400`, observed the harness live login server, prioritized that endpoint in the agent stage-1 source search without a source hint, and still found zero usable sources before timeout.
- Next steps: Keep `ITEM_031` in progress, preserve the same-server live source-discovery evidence, and focus the next AICH attempt on why freshly harness-exported live files are not returned as usable sources before promoting the large-file AICH gate to completed evidence.

### `ITEM_032` — Make still-advertised non-obsolete ED2K features truthful

- Status: `IN_PROGRESS`
- Priority: `P1`
- Lane: `ed2k_full_parity`
- Area: `ed2k_truthfulness`
- Source: `ED2K_072A_FULL_PARITY_TRACKER`
- Summary: The tracker’s strong completion rule treats every still-advertised non-obsolete ED2K feature as in scope until it is implemented or the advert is corrected. Chat/captcha and file comments remain parity backlog surfaces, but the hello and eMuleInfo profiles no longer advertise unsupported captcha, comment, or preview support.
- Next steps: Continue auditing the current peer-capability and server-session advert surfaces, make each unsupported feature either implemented or honestly de-advertised, and keep regression coverage proving advertised capability bits match implemented behavior.

### `ITEM_033` — Port stock UploadQueue credit, score, LowID, and friend-slot behavior

- Status: `IN_PROGRESS`
- Priority: `P1`
- Lane: `ed2k_full_parity`
- Area: `ed2k_upload_queue`
- Source: `ED2K_072A_FULL_PARITY_TRACKER`
- Summary: The listener upload subset is already serving files. The first UploadQueue parity slice now uses deterministic score-ranked waiters for queue rank and slot promotion, with friend-slot boost, LowID penalty, duplicate reconnect refresh, and a neutral file-priority hook for the later catalog priority field. Plaintext and obfuscated listener queue-only e2e cells now execute the native listener queue module. Credit persistence and stock harness/live parity evidence remain open.
- Next steps: Add durable credit-aware score inputs, wire real friend/file-priority policy instead of test-only defaults, validate queue-rank and accept/deny behavior against harness evidence, and preserve the first live run where Overlord’s upload queue behavior stops diverging from stock `v0.72a`.

### `ITEM_034` — Complete buddy and callback parity for firewalled ED2K mode

- Status: `TODO`
- Priority: `P1`
- Lane: `ed2k_full_parity`
- Area: `ed2k_low_id`
- Source: `ED2K_072A_FULL_PARITY_TRACKER`
- Summary: Callback-aware source acquisition is already wired, but the full buddy matrix, buddy tags, and firewalled callback behavior are still incomplete for truthful LowID parity.
- Next steps: Implement buddy setup and teardown, callback state transitions, and buddy-tag parity for firewalled runs, then validate both plaintext and obfuscated LowID paths against harness and live evidence.

### `ITEM_035` — Add preview, browsing, and active notes parity surfaces

- Status: `TODO`
- Priority: `P1`
- Lane: `ed2k_full_parity`
- Area: `ed2k_surface`
- Source: `ED2K_072A_FULL_PARITY_TRACKER`
- Summary: Several non-obsolete peer-facing ED2K surfaces remain unsupported even though they are still in scope: preview request/answer, shared-files and shared-directories browsing, and active ED2K notes search.
- Next steps: Land these surfaces in staged slices with harness-visible evidence for each slice, keeping preview first if it is needed by current peer behavior and preserving notes-search truthfulness at the API boundary once the transport path is added.

### `ITEM_036` — Tighten downloader scheduling and broader server-session parity

- Status: `TODO`
- Priority: `P1`
- Lane: `ed2k_full_parity`
- Area: `ed2k_scheduler`
- Source: `ED2K_072A_FULL_PARITY_TRACKER`
- Summary: After the modern transport path and the core peer state machines are truthful, the remaining gaps shift toward broader `ServerSocket.cpp` coverage and downloader scheduling behavior where stock `v0.72a` still makes materially different A4AF or global scheduler decisions.
- Next steps: Port the remaining server-session behavior that affects live acceptance, align the downloader scheduler where stock behavior materially changes peer interaction, and keep each change gated by focused tests plus private and live parity evidence.

## Kad Live-Acceptance Lane

This lane stays active in parallel with ED2K. Its priority is live-network
acceptance, transport shape, replay fidelity, note result correctness, and NAT
cleanup where those gaps affect harvest yield or peer behavior.

### `ITEM_001` — Improve Kad publish acceptance parity and validate harvest warm-up

- Status: `IN_PROGRESS`
- Priority: `P1`
- Lane: `kad_live_acceptance`
- Area: `kad`
- Source: `TODO-20260322-001`, `TODONEXTKAD`
- Summary: Lift Overlord publish acceptance density toward the oracle and re-check whether stronger publish acceptance starts warming harvested demand on the live network.
- Next steps: Fix the remaining acceptance-rate gap, run longer matched agent/oracle sessions, compare accepted versus timed-out contacts, and preserve the first session where unsolicited demand clearly warms up.

### `ITEM_004` — Finish oracle-like Kad transport and packet-tracking parity

- Status: `TODO`
- Priority: `P1`
- Lane: `kad_live_acceptance`
- Area: `kad_net`
- Source: `TODONEXTKAD`
- Summary: Recent local `>2 GiB` harness<->agent runs exposed and fixed a reverse-Kad obfuscated source-publish identity mismatch, but broader obfuscation details and packet-tracking behavior still need to converge toward modern eMule traffic under load.
- Next steps: Keep the new source-connect instrumentation, port the remaining transport details, replace generic packet tracking with oracle-like logic, and keep re-validating against both local large-file gates and live captures.

### `ITEM_005` — Align passive source-search scheduling cadence and replay ordering with the oracle

- Status: `TODO`
- Priority: `P1`
- Lane: `kad_live_acceptance`
- Area: `kad_replay`
- Source: `TODO-20260322-001`, `TODONEXTKAD`
- Summary: Source replay is live, but source-search scheduling and replay ordering still diverge from the oracle enough to affect result density.
- Next steps: Port oracle-like source-search cadence, tighten replay ordering and filtering, and compare zero-result versus non-zero-result runs after each scheduling change.

### `ITEM_006` — Preserve full snooped request shape for passive replay fidelity

- Status: `TODO`
- Priority: `P1`
- Lane: `kad_live_acceptance`
- Area: `kad_replay`
- Source: `TODONEXTKAD`
- Summary: The current snoop queue is still too target-centric to preserve all oracle-relevant keyword, source, and notes request details.
- Next steps: Extend the stored request shape, keep conversion localized at the edge, and replay the same demand shape the network actually asked for.

### `ITEM_007` — Preserve per-author Kad notes results after live validation

- Status: `TODO`
- Priority: `P1`
- Lane: `kad_live_acceptance`
- Area: `kad_notes`
- Source: `TODONEXTKAD`
- Summary: Coordinator-triggered Kad notes search is already wired end to end and was validated live on April 2, 2026. The remaining gap is result modeling: note replies are still projected into file-centric search results, so distinct note authors would collapse onto one file record.
- Next steps: Add a note-aware coordinator result shape that preserves author identity at ingest and API boundaries, then rerun live validation against a file that returns multiple notes.

### `ITEM_003` — Fix lingering UPnP mappings after real agent shutdown

- Status: `TODO`
- Priority: `P1`
- Lane: `kad_live_acceptance`
- Area: `nat`
- Source: `TODO-20260321-001`
- Summary: The real end-to-end agent run can still leave `41000/41001` mappings behind after shutdown even though the live UPnP path works and manual cleanup succeeds.
- Next steps: Trace shutdown-time mapping release, compare real-run teardown with the working direct UPnP path, and preserve the first clean run where the mappings disappear automatically.

## Completed Protocol Context

These items stay visible until a later archive cleanup, but they do not count
as active parity priorities.

### `ITEM_002` — Fix Kad publish observability roll-up counters in agent stats

- Status: `DONE`
- Priority: `P1`
- Lane: `completed_context`
- Area: `kad_observability`
- Source: `TODO-20260322-001`
- Summary: Aggregate publish counters in `/api/internal/stats` now project in-flight keyword/source progress from the current batch and expose first-class notes publish batch/counter telemetry when notes publish is enabled.
- Validation: `cargo test -p overlord-agent-emule`, `cargo test -p overlord-agent-common`, `kad2.cell.notes.publish.private.v1`, and `kad2.campaign.publish-families.v1` passed on April 25, 2026.

### `ITEM_008` — Port routing `CanSplit` and per-bin `/24` clustering rules

- Status: `DONE`
- Priority: `P1`
- Lane: `completed_context`
- Area: `kad_routing`
- Source: `TODONEXTKAD`
- Summary: The oracle `CanSplit` predicate and per-bin two-per-`/24` anti-clustering cap are already in the Rust routing table and were live-validated on April 2, 2026. This pass added explicit rejection reasons, routing-side observability, targeted tests, and real-network evidence showing oracle-style split decisions during bootstrap and healthy live lookup results.
- Next steps: Keep visible for context until the next archive cleanup pass. Treat any future routing work as new follow-up items tied to a concrete live behavior gap, not as unfinished `CanSplit` or per-bin `/24` parity.

### `ITEM_009` — Rename misleading Kad proto semantic fields

- Status: `DONE`
- Priority: `P2`
- Lane: `completed_context`
- Area: `kad_proto`
- Source: `TODONEXTKAD`
- Summary: The remaining documented Kad semantic aliases were renamed to match oracle meaning directly, and the docs/code policy is now explicit that oracle naming wins with commentary layered on top.
- Next steps: Keep visible for context until the next archive cleanup pass. Treat future naming drift as follow-up parity bugs, not unfinished legacy cleanup.

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
- Summary: Extend outbound participation beyond current seeding slices into broader native sharing behavior, including ED2K/Kad source presence and eventual upload serving parity.
- Next steps: Define per-network sharing policy, shared-catalog ownership, and protocol-appropriate acceptance checks so native upload participation can expand without drifting from oracle behavior.

### `ITEM_016` — Add native in-process downloaders

- Status: `TODO`
- Priority: `P4`
- Area: `downloaders`
- Source: `OVERLORD:B006`
- Summary: Add in-process downloader implementations so the workspace can converge on native protocol parity instead of relying on an external download-client abstraction.
- Next steps: Start with the ED2K transfer core, piece-store plus resume-manifest persistence, and verification path, then preserve the current external-client path only until the native downloader is credible.

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
