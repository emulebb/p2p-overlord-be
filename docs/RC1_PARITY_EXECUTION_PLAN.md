# p2p-overlord RC1 Parity Review And Execution Plan

Prepared on 2026-05-25 for work resuming on 2026-05-26.

The first planned public release candidate is `0.1.1-rc.1`. Release naming,
branching, tagging, and GitHub milestone rules live in
[Release Policy](./RELEASE_POLICY.md). The workspace remains in dev mode until
the operator explicitly confirms release prep.

This plan is limited to the p2p-overlord repos:

- `%OVERLORD_PROJECT_DIR%/p2p-overlord-agents`
- `%OVERLORD_PROJECT_DIR%/p2p-overlord-be`
- `%OVERLORD_PROJECT_DIR%/p2p-overlord-tooling`

The RC1 target is full stock-compatible Kad/eD2K support for file sharing and
downloading. PeerCache remains out of scope. Durable eD2K credit accounting is
not an RC1 gate per current product direction, but peer-visible queue behavior
still has to be stock-like enough to avoid bad interoperability or suspicious
behavior.

## Executive State

The current blocker is not AICH hashing or local AICH generation. The Rust agent
already builds, validates, persists, advertises, and serves MD4/AICH metadata for
local completed files. The active blocker for `ITEM_031` is same-server live
source discovery in the large-file real-network closure cell. The last live runs
reached the agent source-search stage against the harness-connected server but
still ended in `no_sources`, so the agent never acquired bytes or the network
hashsets needed to close the large-file AICH evidence cell.

The second RC1 blocker is product and evidence alignment around "full eD2K".
The Rust agent can dispatch eD2K keyword, source, and notes jobs internally, but
the coordinator public search endpoint still rejects eD2K source and notes
requests. Tooling has strong private coverage for downloader, listener, queue,
resume, callback, and AICH-adjacent paths, but the available surface campaign
currently contains only notes search. Preview and shared-files/shared-directory
browsing still need implementation or truthful de-advertising with explicit RC1
scope language.

Kad is in better shape after the recent stock-parity commits. The remaining Kad
RC1 work is mostly acceptance density and edge parity: publish acceptance,
packet-tracking/obfuscation under load, passive source-search cadence, full
snoop request shape, notes result modeling, and UPnP cleanup.

## Review Iterations

### Pass 1: Backlog And Resume Documents

The canonical backlog is
`%OVERLORD_PROJECT_DIR%/p2p-overlord-be/BACKLOG.md`. It points at this active
critical path:

1. Close `ITEM_031` by fixing same-server live source discovery for the
   large-file AICH closure cell.
2. Keep `ITEM_032` capability truthfulness tight while features move.
3. Resume `ITEM_033`, `ITEM_034`, `ITEM_036`, and remaining `ITEM_035` surfaces
   after source/AICH evidence is unblocked.

The tooling resume documents have a slight ordering tension: one says to continue
`ITEM_035` surface work first, while the backlog and current eD2K tracker put
`ITEM_031` first. For RC1, the right ordering is `ITEM_031` first because full
file downloading and large-file AICH evidence are acceptance gates. Surface work
then follows in parallel with truthfulness.

Backlog hygiene issue to fix early: the backlog summary/table/detail statuses for
`ITEM_031`, `ITEM_032`, and `ITEM_034` are not fully consistent. Do not use those
inconsistencies as implementation truth; use the scenario evidence and current
code state.

### Pass 2: Rust Agent Code

The Rust code shape supports the conclusion above:

- `overlord-agent-emule/src/ed2k_transfer/hashset.rs` implements MD4 and AICH
  part/root hashset build and validation, plus local completed-manifest AICH
  refresh.
- `overlord-agent-emule/src/ed2k_transfer/metadata.rs` persists validated MD4
  and AICH hashsets and preserves peer-learned AICH roots when reconciling.
- `overlord-agent-emule/src/ed2k_transfer/ingest.rs` ingests local payloads,
  computes MD4/AICH, marks manifests complete, and refreshes the shared catalog.
- `overlord-agent-emule/src/agent/ed2k_download/sources.rs` attempts background
  server search, active TCP source search, UDP server source search, and Kad
  fallback/supplement.
- `overlord-agent-emule/src/ed2k_server/active_source.rs` has same-server
  preference and one-shot TCP source search logic.
- `overlord-agent-emule/src/ed2k_server/background.rs` sends background TCP/UDP
  source searches after offer-file settle.
- `overlord-agent-emule/src/ed2k_server/startup.rs` sends login, offer-files,
  server list, and source requests, including large-file size forms.
- `overlord-agent-emule/src/ed2k_transfer/upload_queue.rs` implements
  score-ranked waiters, rank refresh, LowID penalty, friend-slot boost, active
  slot promotion, and duplicate reconnect handling. Durable credits are the
  omitted piece and are not an RC1 gate now.

Likely `ITEM_031` investigation points:

- Is the harness file actually indexed by the selected live server before the
  agent sends `OP_GETSOURCES`?
- Does the agent advertise the large file in the exact offer-file shape the
  server accepts, including high-size tags and client identity fields?
- Is the source request opcode and payload correct for the server flags selected
  from `server.met`?
- Is the background search racing the one-shot search or closing the session
  before server indexing has settled?
- Does the UDP source-search path use the server UDP endpoint and large-size
  payload shape the selected server expects?
- Does the same-server preference select the endpoint that actually indexed the
  harness seeder after the live runner restarts with a single-server `server.met`?

### Pass 3: Backend And Product Contract

The agent side can run both Kad and eD2K work through one service. The public
coordinator contract is narrower:

- `overlord-be-coordinator/src/routes/api/search/+server.ts` validates
  `protocol=ed2k` but rejects all non-keyword eD2K jobs.
- `overlord-be-coordinator/src/lib/shared/internal-api.ts` types hash search as
  Kad-only even though the agent service can handle eD2K source/notes jobs.
- `overlord-be-coordinator/openapi/internal-api.yaml` is partly advisory and has
  some known drift from current internal structs.

For RC1, this matters because "full eD2K support" should not require internal
agent-only entry points. Either expose eD2K source/notes/search surfaces through
the coordinator or explicitly define RC1 as agent-level support plus keyword-only
product search. The stronger RC1 target is to align the coordinator with the
agent and tooling.

### Pass 4: Scenario And Evidence Matrix

Available eD2K campaigns:

- `ed2k.campaign.downloader-startup.v1`: private direct/Kad-assisted plus live
  plaintext and obfuscated downloader cells.
- `ed2k.campaign.source-acquisition.v1`: private callback and live direct source
  acquisition.
- `ed2k.campaign.listener-serving.v1`: one live plaintext listener roundtrip.
- `ed2k.campaign.queue-and-slot.v1`: private downloader/listener queue cells for
  plaintext and obfuscated transports.
- `ed2k.campaign.resume.v1`: private downloader/listener resume cells for
  plaintext and obfuscated transports.
- `ed2k.campaign.callback.v1`: private callback-issued plaintext and obfuscated
  cells.
- `ed2k.campaign.surface.v1`: currently only notes search, despite its scope
  description mentioning preview and browsing.
- `ed2k.campaign.modern-aich.v1`: the large-file real-network AICH closure cell.
- `ed2k.campaign.realnet-confidence.v1`: live plaintext/obfuscated downloader,
  live plaintext listener, and large-file AICH.

Available Kad campaigns:

- `kad2.campaign.private-confidence.v1`: deterministic private startup, search,
  and publish cells.
- `kad2.campaign.publish-families.v1`: private keyword/source/notes publish.
- `kad2.campaign.search-families.private.v1`: private keyword/source/notes
  search.
- `kad2.campaign.realnet-confidence.v1`: live startup/publish plus plaintext and
  obfuscated keyword search.
- `kad2.campaign.routing-and-transport.v1`: private bootstrap plus live keyword
  search transports.

Evidence gaps for RC1:

- Large-file AICH real-network closure still fails at source discovery.
- eD2K preview and shared browsing are not represented by available scenario
  cells.
- Listener real-network confidence has plaintext coverage but no obfuscated live
  listener cell.
- Queue/resume/callback evidence is strong privately but should not be marketed
  as full live confidence until live or stock-harness evidence is added.
- Kad real-network evidence is mostly keyword/startup/publish focused; source
  and notes live confidence should be added if RC1 claims full Kad search family
  acceptance on public networks.

## Execution Plan For 2026-05-26

### 0. Start Clean

From each p2p-overlord repo, confirm state:

```console
git status --short --branch
```

Set the expected workspace variables before running live or generated-output
tasks:

```console
$env:OVERLORD_PROJECT_DIR="<workspace p2p-overlord parent>"
$env:OVERLORD_TMP_DIR="<local temp dir>"
$env:OVERLORD_LOG_DIR="<local log dir>"
```

For live runs, enforce the workspace policy: bind traffic through the approved
VPN/interface setup, enable the required UPnP behavior, and use only canonical
Linux-style live-wire search terms.

### 1. Close `ITEM_031`: Same-Server Large-File AICH

Run the failing cell with live and e2e enabled, keeping sessions alive for the
first debug pass:

```console
python -m pytest tests/e2e/test_parity_scenarios.py -q --run-e2e --run-live --keep-sessions-running -k "ed2k.cell.modern-aich.plaintext.server-roundtrip.large.realnet.v1"
```

If runtimes are already built:

```console
python -m pytest tests/e2e/test_parity_scenarios.py -q --run-e2e --run-live --skip-runtime-build --keep-sessions-running -k "ed2k.cell.modern-aich.plaintext.server-roundtrip.large.realnet.v1"
```

Instrument only what is needed to classify the failure:

- selected harness server endpoint and server flags;
- exact offer-file payload shape for the large file;
- login client ID/ports/LowID state after `OP_IDCHANGE`;
- background TCP/UDP source-search send time and response count;
- active one-shot TCP source-search endpoint, opcode, file hash, file size, and
  decoded response count;
- UDP source-search endpoint, request form, and decoded response count;
- server settle time between harness offer-files and agent source search.

Acceptance for closing this gate:

- `sameServerSourceDiscovery.status` becomes `found_sources`;
- agent stage 1 downloads bytes from the harness source;
- agent manifest contains verified MD4 and AICH hashset metadata;
- stage 2 harness download from the agent validates HASHSET2/AICH evidence;
- `ed2k.campaign.modern-aich.v1` passes without source hints.

### 2. Keep Capability Truthfulness Tight

Every feature branch must preserve truthful peer/server adverts:

- Do not advertise preview support until preview request/answer is implemented
  and covered.
- Do not advertise shared-files/shared-directory browsing until answer payloads
  are implemented and covered.
- Keep chat/captcha unsupported unless implemented; unsupported bits should stay
  absent from hello/capability surfaces.
- Keep large-file tags and obfuscation flags truthful for both server login and
  client hello paths.

This is the standing guard for `ITEM_032`.

### 3. Align Coordinator With Full eD2K

After `ITEM_031` is unblocked, make the product contract match the agent:

- allow eD2K source and notes jobs in
  `overlord-be-coordinator/src/routes/api/search/+server.ts`;
- update shared TypeScript request types in
  `overlord-be-coordinator/src/lib/shared/internal-api.ts`;
- refresh OpenAPI/internal API documentation where it is used as an operator or
  test contract;
- add coordinator tests proving eD2K keyword/source/notes dispatch reaches the
  ready eMule agent.

Acceptance:

- public search accepts `protocol=ed2k` for keyword, source, and notes where the
  agent supports them;
- unsupported eD2K peer-facing features remain non-advertised rather than
  pretending support;
- backend checks pass.

### 4. Finish File Sharing And Downloading Gates

RC1 needs evidence for both directions:

- local ingest through `ingest_local_file`;
- shared catalog refresh from verified manifests;
- server offer-files and Kad source publishing for verified local files;
- peer download from the agent, plaintext and obfuscated;
- agent download from peer, plaintext and obfuscated;
- fresh and resume transfers;
- direct and callback/LowID source paths;
- large-file HASHSET2/AICH path;
- compressed part serving and validation.

Credits are not part of this gate. Queue rank, LowID handling, friend-slot
behavior where advertised, slot rotation, duplicate reconnect behavior, and
accept-upload promotion remain peer-visible gates.

### 5. Complete eD2K Surface Work

Prioritize surfaces by RC1 visibility:

1. Preview:
   - implement preview request/answer on the listener side or keep preview
     absent from capabilities;
   - add private scenario cells to `ed2k.campaign.surface.v1`.
2. Shared files and shared directories:
   - implement browse answer payloads from the verified shared catalog or keep
     browsing absent from capabilities;
   - add private scenario cells for allowed, denied, empty, and populated cases.
3. Callback/buddy:
   - complete buddy setup/teardown tags and callback state transitions;
   - add LowID callback matrix evidence.
4. Downloader scheduling:
   - finish broader server-session and A4AF scheduling behavior;
   - preserve state labels for `returned_zero_sources`, `filtered_to_zero`,
     `callback_only`, `queued_but_accepted`, `slot_granted_but_no_part_progress`,
     `listener_queue_waiting`, and `resume_reconnected`.

### 6. Close Kad RC1 Gaps

Kad work should run in parallel after the eD2K AICH blocker is classified:

- `ITEM_001`: get stronger publish acceptance evidence on real network;
- `ITEM_004`: finish packet tracking and obfuscated transport parity under load;
- `ITEM_005`: align passive source-search cadence and replay ordering;
- `ITEM_006`: complete full snoop request shape and preserve source
  start-position details;
- `ITEM_007`: model notes as per-author results instead of collapsing only to
  file-centric records;
- `ITEM_003`: ensure UPnP mappings are removed on shutdown.

Acceptance:

- private Kad startup/search/publish campaigns pass;
- live Kad startup/publish and plaintext/obfuscated keyword cells pass;
- source and notes live confidence is either added or explicitly scoped as
  private-confidence for RC1.

### 7. Sanitize Seed Inputs Before RC1

The synthetic publish seed list should not contain real-media or product-like
queries in tracked harness/runtime defaults. For RC1, use operator-provided seed
inputs or canonical Linux-style test terms that satisfy the workspace live-wire
policy.

## RC1 Gate Checklist

RC1 can be cut only when these are true:

- `cargo fmt --all --check` passes in `p2p-overlord-agents`.
- Strict clippy from the agents repo policy passes or has an explicitly accepted
  tracked exception.
- Backend `npm run check`, Prisma validation, and Prisma generation pass.
- Tooling manifest/catalog tests pass.
- `ed2k.campaign.modern-aich.v1` passes.
- `ed2k.campaign.realnet-confidence.v1` passes or any remaining live confidence
  limitation is explicitly called out in RC notes.
- `ed2k.campaign.queue-and-slot.v1`, `ed2k.campaign.resume.v1`, and
  `ed2k.campaign.callback.v1` pass.
- `ed2k.campaign.surface.v1` either covers preview and browsing or RC notes state
  those features are not advertised.
- `kad2.campaign.private-confidence.v1` and `kad2.campaign.realnet-confidence.v1`
  pass.
- Coordinator/API behavior matches the RC1 support claim.
- All maintained docs avoid machine-specific absolute paths.
- Live-run evidence manifests, logs, and summaries are archived under configured
  p2p-overlord output directories.

## Command Book

Agents:

```console
cargo fmt --all --check
cargo test -p overlord-agent-emule ed2k_server
cargo test -p overlord-agent-emule ed2k_tcp
cargo test -p overlord-agent-emule ed2k_transfer
cargo test -p overlord-agent-emule
cargo clippy --workspace --all-targets --all-features -- -D warnings -D clippy::unwrap_used -D clippy::expect_used -D clippy::panic
```

Backend:

```console
npm run prisma:generate
npm run prisma:validate
npm run check
```

Tooling catalog and matrix:

```console
python -m pytest tests/e2e/test_manifests.py tests/e2e/test_scenario_catalog.py -q
python -m overlord_tooling show-parity-matrix --availability available --protocol ed2k
python -m overlord_tooling show-parity-matrix --availability available --protocol kad2
python -m overlord_tooling guard-tracked-files --repo-root ../p2p-overlord-be
python -m overlord_tooling guard-tracked-files --repo-root ../p2p-overlord-agents
python -m overlord_tooling guard-tracked-files --repo-root ../p2p-overlord-tooling
```

Private campaigns:

```console
python -m pytest tests/e2e/test_parity_scenarios.py -q --run-e2e -k "ed2k.campaign.queue-and-slot.v1"
python -m pytest tests/e2e/test_parity_scenarios.py -q --run-e2e -k "ed2k.campaign.resume.v1"
python -m pytest tests/e2e/test_parity_scenarios.py -q --run-e2e -k "ed2k.campaign.callback.v1"
python -m pytest tests/e2e/test_parity_scenarios.py -q --run-e2e -k "kad2.campaign.private-confidence.v1"
```

Live campaigns:

```console
python -m pytest tests/e2e/test_parity_scenarios.py -q --run-e2e --run-live -k "ed2k.campaign.realnet-confidence.v1"
python -m pytest tests/e2e/test_parity_scenarios.py -q --run-e2e --run-live -k "ed2k.campaign.modern-aich.v1"
python -m pytest tests/e2e/test_parity_scenarios.py -q --run-e2e --run-live -k "kad2.campaign.realnet-confidence.v1"
```

Use `--skip-runtime-build` only after confirming the current debug runtimes match
the code under test. Use `--keep-sessions-running` for the first source-discovery
debug pass.

## First 90 Minutes On 2026-05-26

1. Confirm clean git status in all three p2p-overlord repos.
2. Run catalog tests and print the eD2K/Kad available matrices.
3. Run the large-file AICH cell with `--keep-sessions-running`.
4. Classify `no_sources` into one concrete bucket: not indexed, wrong server,
   wrong request shape, wrong offer shape, transport/UDP mismatch, or timing.
5. Patch the smallest source-discovery issue that matches the evidence.
6. Rerun only the large-file AICH cell until it reaches bytes or a new classified
   failure.
7. Once it reaches bytes and AICH evidence, rerun `ed2k.campaign.modern-aich.v1`
   without source hints.
8. Only then switch to API/surface/queue/Kad closure work.
