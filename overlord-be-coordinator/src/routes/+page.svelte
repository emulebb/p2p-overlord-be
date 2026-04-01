<script lang="ts">
	import type {
		AgentActivitySnapshot,
		AgentInterfacesView,
		InterfaceBindingSelection,
		InterfaceSelectionState,
		KeepBusyCandidateView,
		KadHarvestObservability,
		KadPublishObservability,
		SearchRequest,
		SearchJobStatusView,
		SnoopDemandHoleEntry,
		SnoopDashboardEntry,
		SnoopTrendEntry
	} from '$lib/shared/internal-api';
	import { onMount } from 'svelte';

	import Panel from '$lib/components/Panel.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import {
		desiredNatBackend,
		formatAgentActivityProgress,
		formatAgentActivityState,
		formatHarvestFamily,
		formatDemandDetails,
		formatDurationSince,
		formatPassiveReplay,
		formatPublishBatch,
		formatSeedSource,
		formatSnoopDetails,
		formatTimestamp,
		isAnyBindingOption,
		shortIndexerId,
		summarizeBinding,
		summarizeExternalAddress
	} from '$lib/ui/formatters';

	const ANY_BIND_OPTION = '__any__';

	type ShellStatus = {
		registered_agents: number;
		search_jobs: number;
		file_count: number;
		search_results: number;
		result_batches: number;
		keepBusy: {
			enabled: boolean;
			started: boolean;
			lastJobsDispatched: number;
		};
	};

	type BadgeTone = 'neutral' | 'accent' | 'good' | 'warn' | 'danger';

	export let data:
		| {
				shellStatus: ShellStatus;
				agents: AgentInterfacesView[];
				searches: SearchJobStatusView[];
				snoops: SnoopDashboardEntry[];
				trending: SnoopTrendEntry[];
				holes: SnoopDemandHoleEntry[];
				keepBusyCandidates: KeepBusyCandidateView[];
		  }
		| undefined;

	let query = '';
	let searchProtocol: SearchRequest['protocol'] = 'kad2';
	let keepBusyQuery = '';
	let searchError = '';
	let keepBusyError = '';
	let creatingSearch = false;
	let creatingKeepBusy = false;
	let snoops: SnoopDashboardEntry[] = [];
	let trending: SnoopTrendEntry[] = [];
	let holes: SnoopDemandHoleEntry[] = [];
	let keepBusyCandidates: KeepBusyCandidateView[] = [];

	$: snoops = data?.snoops ?? [];
	$: trending = data?.trending ?? [];
	$: holes = data?.holes ?? [];
	$: keepBusyCandidates = data?.keepBusyCandidates ?? [];

	async function startSearch() {
		const trimmed = query.trim();
		if (!trimmed) {
			searchError = 'Enter a search query first.';
			return;
		}

		creatingSearch = true;
		searchError = '';
		try {
			const response = await fetch('/api/search', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					protocol: searchProtocol,
					kind: 'keyword',
					query: trimmed
				})
			});
			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? `search request failed with ${response.status}`);
			}
			const payload = (await response.json()) as SearchJobStatusView;
			window.location.assign(`/search/${payload.job_id}`);
		} catch (error) {
			searchError = error instanceof Error ? error.message : String(error);
		} finally {
			creatingSearch = false;
		}
	}

	async function addKeepBusyCandidate() {
		const trimmed = keepBusyQuery.trim();
		if (!trimmed) {
			keepBusyError = 'Enter a keep-busy keyword first.';
			return;
		}

		creatingKeepBusy = true;
		keepBusyError = '';
		try {
			const response = await fetch('/api/keep-busy/candidates', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ query: trimmed })
			});
			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? `keep-busy update failed with ${response.status}`);
			}
			const candidate = (await response.json()) as KeepBusyCandidateView;
			keepBusyCandidates = [
				candidate,
				...keepBusyCandidates.filter((entry) => entry.queryKey !== candidate.queryKey)
			].slice(0, 20);
			keepBusyQuery = '';
		} catch (error) {
			keepBusyError = error instanceof Error ? error.message : String(error);
		} finally {
			creatingKeepBusy = false;
		}
	}

	function selectionTone(state: InterfaceSelectionState | null | undefined, ready = false): BadgeTone {
		if (ready) {
			return 'good';
		}

		switch (state) {
			case 'error':
				return 'danger';
			case 'confirmed':
			case 'applied':
				return 'accent';
			case 'pending':
			default:
				return 'warn';
		}
	}

	function agentTone(agent: AgentInterfacesView): BadgeTone {
		if (agent.last_error) {
			return 'danger';
		}
		if (agent.report?.control.ready && agent.report?.p2p.ready) {
			return 'good';
		}
		if (agent.report) {
			return 'warn';
		}
		return 'neutral';
	}

	function agentStatus(agent: AgentInterfacesView): string {
		if (agent.last_error) {
			return 'degraded';
		}
		if (agent.report?.control.ready && agent.report?.p2p.ready) {
			return 'ready';
		}
		if (agent.report) {
			return 'config pending';
		}
		return 'awaiting report';
	}

	function natTone(agent: AgentInterfacesView): BadgeTone {
		if (!agent.config.nat.p2p.enabled) {
			return 'neutral';
		}
		if (agent.nat?.last_error) {
			return 'danger';
		}
		if (agent.nat?.gateway_discovered) {
			return 'good';
		}
		return 'warn';
	}

	function natStatus(agent: AgentInterfacesView): string {
		if (!agent.config.nat.p2p.enabled) {
			return 'disabled';
		}
		if (agent.nat?.last_error) {
			return 'gateway error';
		}
		if (agent.nat?.gateway_discovered) {
			return 'gateway ready';
		}
		return 'discovering';
	}

	function activityTone(activity: AgentActivitySnapshot | null): BadgeTone {
		if (!activity) {
			return 'neutral';
		}

		switch (activity.state) {
			case 'degraded':
				return 'danger';
			case 'idle':
				return 'neutral';
			case 'bootstrapping':
			case 'reconfiguring':
				return 'warn';
			case 'active_search':
			case 'passive_harvest_replay':
			case 'publishing':
			case 'flushing_snoops':
			case 'starting':
			default:
				return 'accent';
		}
	}

	function publishTone(observability: KadPublishObservability | null): BadgeTone {
		if (!observability) {
			return 'neutral';
		}
		if (
			observability.keyword_counters.failed_contacts > 0 ||
			observability.source_counters.failed_contacts > 0
		) {
			return 'warn';
		}
		return 'accent';
	}

	function harvestTone(observability: KadHarvestObservability | null): BadgeTone {
		if (!observability) {
			return 'neutral';
		}
		if (
			observability.keyword_requests.observed_requests > 0 ||
			observability.source_requests.observed_requests > 0 ||
			observability.notes_requests.observed_requests > 0
		) {
			return 'good';
		}
		if (
			observability.passive_keyword_replay.idle_cycles > 0 ||
			observability.passive_source_replay.idle_cycles > 0 ||
			observability.passive_notes_replay.idle_cycles > 0
		) {
			return 'accent';
		}
		return 'warn';
	}

	onMount(() => {
		let cancelled = false;

		async function refreshSnoops() {
			try {
				const response = await fetch('/api/snoop');
				if (!response.ok) {
					return;
				}

				const payload = (await response.json()) as {
					entries: SnoopDashboardEntry[];
					trending: SnoopTrendEntry[];
					holes: SnoopDemandHoleEntry[];
				};
				if (!cancelled) {
					snoops = payload.entries;
					trending = payload.trending;
					holes = payload.holes;
				}
			} catch {
				// Keep the dashboard usable when background refreshes fail.
			}
		}

		const interval = window.setInterval(refreshSnoops, 10000);
		refreshSnoops();

		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	});
</script>

<svelte:head>
	<title>Coordinator Console</title>
</svelte:head>

<main class="page">
	<section class="page-header">
		<div>
			<p class="eyebrow">Dashboard</p>
			<h2>Coordinator overview</h2>
			<p>Track agent readiness, launch searches, and watch harvested Kad demand without leaving the console.</p>
		</div>
		<div class="badge-row">
			<StatusBadge
				tone={data && data.agents.length > 0 ? 'good' : 'warn'}
				text={data && data.agents.length > 0 ? 'agents online' : 'waiting for agents'}
			/>
			<StatusBadge
				tone={snoops.length > 0 ? 'accent' : 'neutral'}
				text={snoops.length > 0 ? 'snoop feed warm' : 'no harvested demand yet'}
			/>
		</div>
	</section>

	{#if data}
		<Panel
			title="System Counters"
			subtitle="Compact coordinator counters in a single operator table."
		>
			<div class="table-shell wm-shell">
				<table class="wm-table">
					<thead>
						<tr>
							<th>Metric</th>
							<th>Value</th>
							<th>Notes</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Registered agents</td>
							<td class="mono">{data.shellStatus.registered_agents}</td>
							<td>Known agent registrations in the coordinator.</td>
						</tr>
						<tr>
							<td>Indexed files</td>
							<td class="mono">{data.shellStatus.file_count}</td>
							<td>Promoted file rows available for browse and search flows at `/files`.</td>
						</tr>
						<tr>
							<td>Search jobs</td>
							<td class="mono">{data.shellStatus.search_jobs}</td>
							<td>Persisted jobs across queued, active, and completed searches.</td>
						</tr>
						<tr>
							<td>Search results</td>
							<td class="mono">{data.shellStatus.search_results}</td>
							<td>{data.shellStatus.result_batches} result batches observed by the coordinator.</td>
						</tr>
						<tr>
							<td>Keep-busy worker</td>
							<td class="mono">{data.shellStatus.keepBusy.enabled ? 'enabled' : 'disabled'}</td>
							<td>Last cycle dispatched {data.shellStatus.keepBusy.lastJobsDispatched} auto jobs.</td>
						</tr>
					</tbody>
				</table>
			</div>
		</Panel>

		<section class="split-grid">
			<Panel
				title="Quick Search"
				subtitle="Launch a Kad or ED2K keyword search and jump straight into the live job view."
			>
				<div class="stack" id="quick-search">
					<form class="inline-form" on:submit|preventDefault={startSearch}>
						<label class="field">
							<span>Protocol</span>
							<select class="input" bind:value={searchProtocol}>
								<option value="kad2">Kad</option>
								<option value="ed2k">ED2K server</option>
							</select>
						</label>
						<label class="field">
							<span>Keyword query</span>
							<input
								class="input"
								bind:value={query}
								placeholder="ubuntu linux"
								autocomplete="off"
							/>
						</label>
						<button class="button" type="submit" disabled={creatingSearch}>
							{creatingSearch ? 'Starting search...' : 'Start search'}
						</button>
					</form>

					<p class="hint">
						This keeps the current coordinator flow intact: `POST /api/search`, then redirect
						to the live SSE job page. ED2K keyword jobs are routed to the current eMule agents
						through the existing registration path until multi-protocol registration lands.
					</p>

					<p class="hint">
						Need the persisted index instead of a live search job? Browse it directly at
						<a class="text-link" href="/files">/files</a>.
					</p>

					{#if searchError}
						<p class="message message--danger">{searchError}</p>
					{/if}

					{#if data.searches.length > 0}
						<div class="table-shell wm-shell">
							<table class="wm-table">
								<thead>
									<tr>
										<th>Query</th>
										<th>Origin</th>
										<th>Protocol</th>
										<th>Status</th>
										<th>Results</th>
										<th>Created</th>
										<th>Open</th>
									</tr>
								</thead>
								<tbody>
									{#each data.searches as search}
										<tr>
											<td>{search.query ?? search.job_id}</td>
											<td>
												<StatusBadge
													tone={search.origin === 'keep_busy_auto' ? 'warn' : 'neutral'}
													text={search.origin === 'keep_busy_auto' ? 'keep-busy' : 'user'}
												/>
											</td>
											<td><StatusBadge tone="neutral" text={search.protocol} /></td>
											<td>
												<StatusBadge
													tone={search.status === 'completed' ? 'good' : search.status === 'failed' ? 'danger' : 'accent'}
													text={search.status}
												/>
											</td>
											<td class="mono">{search.result_count}</td>
											<td class="mono">{formatTimestamp(search.created_at)}</td>
											<td><a class="text-link" href={`/search/${search.job_id}`}>Open</a></td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="message message--accent">No recent jobs yet. Start a search to seed the dashboard.</p>
					{/if}
				</div>
			</Panel>

			<Panel
				title="Search Readiness"
				subtitle="A quick operator read on whether the dashboard is ready to fan out active Kad work."
			>
				<div class="stack">
					<p class="message {data.agents.length > 0 ? 'message--good' : 'message--warn'}">
						{#if data.agents.length > 0}
							At least one agent is registered. Search dispatch can proceed when a Kad agent is marked ready.
						{:else}
							No agents are registered yet. Search requests will return a readiness error until one checks in.
						{/if}
					</p>

					<dl class="meta-list">
						<div class="meta-row">
							<dt>Ready agents</dt>
							<dd>
								<strong>
									{data.agents.filter((agent) => agent.report?.control.ready && agent.report?.p2p.ready).length}
								</strong>
							</dd>
						</div>
						<div class="meta-row">
							<dt>Harvested snoops</dt>
							<dd><strong>{snoops.length}</strong></dd>
						</div>
						<div class="meta-row">
							<dt>Recent jobs shown</dt>
							<dd><strong>{data.searches.length}</strong></dd>
						</div>
						<div class="meta-row">
							<dt>Trending shapes</dt>
							<dd><strong>{trending.length}</strong></dd>
						</div>
						<div class="meta-row">
							<dt>Demand holes</dt>
							<dd><strong>{holes.length}</strong></dd>
						</div>
					</dl>
				</div>
			</Panel>
		</section>

		<section class="split-grid">
			<Panel
				title="Keep-Busy Keywords"
				subtitle="Inject manual keyword terms into the same candidate pool used by the coordinator keep-busy worker."
			>
				<div class="stack">
					<form class="inline-form" on:submit|preventDefault={addKeepBusyCandidate}>
						<label class="field">
							<span>Keyword</span>
							<input
								class="input"
								bind:value={keepBusyQuery}
								placeholder="ubuntu linux 24.04"
								autocomplete="off"
							/>
						</label>
						<button class="button" type="submit" disabled={creatingKeepBusy}>
							{creatingKeepBusy ? 'Adding...' : 'Add keep-busy keyword'}
						</button>
					</form>

					<p class="hint">
						UI-added keywords are stored as `Keep-busy UI` candidates and compete with web-fed terms
						using the same cooldown and dispatch logic.
					</p>

					{#if keepBusyError}
						<p class="message message--danger">{keepBusyError}</p>
					{/if}
				</div>
			</Panel>

			<Panel
				title="Keep-Busy Candidates"
				subtitle="Recent auto-feed candidates from the web worker and manual UI additions."
			>
				{#if keepBusyCandidates.length > 0}
					<div class="table-shell wm-shell">
						<table class="wm-table">
							<thead>
								<tr>
									<th>Query</th>
									<th>Source</th>
									<th>Seen</th>
									<th>Dispatches</th>
									<th>Results</th>
								</tr>
							</thead>
							<tbody>
								{#each keepBusyCandidates as candidate}
									<tr>
										<td>{candidate.query}</td>
										<td><StatusBadge tone="accent" text={candidate.sourceLabel} /></td>
										<td>{formatTimestamp(candidate.lastSeenAt)}</td>
										<td>{candidate.dispatchCount}</td>
										<td>{candidate.lastResultCount}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="message message--accent">
						No keep-busy candidates yet. Add one from the UI or enable the web-source worker.
					</p>
				{/if}
			</Panel>
		</section>

		<Panel
			title="Harvested Kad Queries"
			subtitle="Auto-refreshes every 10 seconds from the persisted snoop queue so you can see what the network is asking for."
		>
			{#if snoops.length > 0}
				<div class="table-shell wm-shell">
					<table class="wm-table">
						<thead>
							<tr>
								<th>Seen</th>
								<th>Family</th>
								<th>Target</th>
								<th>Details</th>
								<th>Hits</th>
								<th>Drained</th>
								<th>Agent</th>
							</tr>
						</thead>
						<tbody>
							{#each snoops as snoop}
								<tr>
									<td>{formatTimestamp(snoop.last_seen)}</td>
									<td><StatusBadge tone="neutral" text={snoop.family} /></td>
									<td><code class="dense-code">{snoop.target}</code></td>
									<td>{formatSnoopDetails(snoop)}</td>
									<td>{snoop.hit_count}</td>
									<td>{formatTimestamp(snoop.last_drained_at)}</td>
									<td>
										<div class="badge-row">
											<StatusBadge tone="accent" text={snoop.hostname ?? snoop.protocol ?? 'agent'} />
										</div>
										<div class="muted mono">{shortIndexerId(snoop.indexer_id)}</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="message message--accent">
					No harvested Kad queries yet. Once agents snoop network demand, this table will populate automatically.
				</p>
			{/if}
		</Panel>

		<section class="split-grid">
			<Panel
				title="Trending Kad Demand"
				subtitle="Append-only harvested observations over the last 24 hours, ranked by repeated request shape."
			>
				{#if trending.length > 0}
					<div class="table-shell wm-shell">
						<table class="wm-table">
							<thead>
								<tr>
									<th>Last Seen</th>
									<th>Family</th>
									<th>Target</th>
									<th>Details</th>
									<th>Observations</th>
									<th>Replays</th>
									<th>Resolved</th>
								</tr>
							</thead>
							<tbody>
								{#each trending as entry}
									<tr>
										<td>{formatTimestamp(entry.last_seen)}</td>
										<td><StatusBadge tone="neutral" text={entry.family} /></td>
										<td><code class="dense-code">{entry.target}</code></td>
										<td>{formatDemandDetails(entry)}</td>
										<td>{entry.observed_count}</td>
										<td>{entry.replay_count}</td>
										<td>{entry.sample_name ?? `${entry.resolved_file_count} files`}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="message message--accent">
						No append-only demand trends yet. Once the snoop log fills, this view will rank the hottest shapes.
					</p>
				{/if}
			</Panel>

			<Panel
				title="Demand Holes"
				subtitle="Harvested shapes that are being replayed but still have not yielded any linked files."
			>
				{#if holes.length > 0}
					<div class="table-shell wm-shell">
						<table class="wm-table">
							<thead>
								<tr>
									<th>Last Seen</th>
									<th>Family</th>
									<th>Target</th>
									<th>Details</th>
									<th>Replays</th>
									<th>Last Replay</th>
									<th>Last Error</th>
								</tr>
							</thead>
							<tbody>
								{#each holes as entry}
									<tr>
										<td>{formatTimestamp(entry.last_seen)}</td>
										<td><StatusBadge tone="warn" text={entry.family} /></td>
										<td><code class="dense-code">{entry.target}</code></td>
										<td>{formatDemandDetails(entry)}</td>
										<td>{entry.replay_count}</td>
										<td>{formatTimestamp(entry.last_replay_at)}</td>
										<td>{entry.last_error ?? 'None'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="message message--good">
						No current demand holes. Replayed harvested shapes are either unresolved and not yet retried, or already linked to files.
					</p>
				{/if}
			</Panel>
		</section>

		<Panel
			title="Agent Networking"
			subtitle="Per-agent activity, readiness, NAT posture, and Kad publish/harvest observability in one place."
		>
			<div class="stack" id="agent-networking">
				{#if data.agents.length > 0}
					<div class="agent-grid">
						{#each data.agents as agent}
							<article class="agent-card wm-shell">
								<div class="agent-card__header">
									<div>
										<div class="agent-card__title-row">
											<strong class="agent-card__title">
												{agent.registration.protocol} · {agent.registration.hostname}
											</strong>
											<StatusBadge tone={agentTone(agent)} text={agentStatus(agent)} />
											<StatusBadge
												tone={activityTone(agent.agent_activity)}
												text={`activity ${formatAgentActivityState(agent.agent_activity)}`}
											/>
											<StatusBadge
												tone={publishTone(agent.publish_observability)}
												text={agent.publish_observability ? 'publish telemetry' : 'telemetry pending'}
											/>
										</div>
										<p>Registered URL {agent.registration.url}</p>
										<p class="mono">{agent.registration.indexer_id}</p>
									</div>
									<div class="badge-row">
										<StatusBadge
											tone={selectionTone(agent.report?.control.state, agent.report?.control.ready)}
											text={`control ${agent.report?.control.state ?? 'pending'}`}
										/>
										<StatusBadge
											tone={selectionTone(agent.report?.p2p.state, agent.report?.p2p.ready)}
											text={`p2p ${agent.report?.p2p.state ?? 'pending'}`}
										/>
										<StatusBadge tone={natTone(agent)} text={`nat ${natStatus(agent)}`} />
									</div>
								</div>

								<div class="subgrid">
									<section class="subpanel">
										<h4>Activity</h4>
										<dl class="kv-list">
											<div class="kv-row">
												<dt>State</dt>
												<dd>{formatAgentActivityState(agent.agent_activity)}</dd>
											</div>
											<div class="kv-row">
												<dt>Since</dt>
												<dd>{formatDurationSince(agent.agent_activity?.since ?? null)}</dd>
											</div>
											<div class="kv-row">
												<dt>Target / query</dt>
												<dd>{agent.agent_activity?.query_or_target ?? 'Pending'}</dd>
											</div>
											<div class="kv-row">
												<dt>Progress</dt>
												<dd>{formatAgentActivityProgress(agent.agent_activity)}</dd>
											</div>
											<div class="kv-row">
												<dt>Last update</dt>
												<dd>{formatTimestamp(agent.agent_activity?.last_update_at ?? null)}</dd>
											</div>
										</dl>
									</section>

									<section class="subpanel">
										<h4>Control</h4>
										<dl class="kv-list">
											<div class="kv-row">
												<dt>Binding</dt>
												<dd>{summarizeBinding(agent.report?.control ?? null, 'control')}</dd>
											</div>
											<div class="kv-row">
												<dt>Port</dt>
												<dd>{agent.config.control.listen_port}</dd>
											</div>
											<div class="kv-row">
												<dt>Confirmed</dt>
												<dd>{agent.config.control.selection_confirmed ? 'yes' : 'no'}</dd>
											</div>
										</dl>
									</section>

									<section class="subpanel">
										<h4>P2P</h4>
										<dl class="kv-list">
											<div class="kv-row">
												<dt>Binding</dt>
												<dd>{summarizeBinding(agent.report?.p2p ?? null, 'p2p')}</dd>
											</div>
											<div class="kv-row">
												<dt>Kad / eD2k</dt>
												<dd>{agent.config.p2p.kad.listen_port} / {agent.config.p2p.ed2k.listen_port}</dd>
											</div>
											<div class="kv-row">
												<dt>Confirmed</dt>
												<dd>{agent.config.p2p.selection_confirmed ? 'yes' : 'no'}</dd>
											</div>
										</dl>
									</section>

									<section class="subpanel">
										<h4>NAT</h4>
										<dl class="kv-list">
											<div class="kv-row">
												<dt>Backend</dt>
												<dd>{desiredNatBackend(agent)}</dd>
											</div>
											<div class="kv-row">
												<dt>Gateway</dt>
												<dd>{agent.nat?.gateway?.gateway_ip ?? 'none'}</dd>
											</div>
											<div class="kv-row">
												<dt>External IP</dt>
												<dd>{summarizeExternalAddress(agent)}</dd>
											</div>
										</dl>
									</section>
								</div>

								{#if agent.last_error ?? agent.agent_activity?.last_error}
									<p class="message message--danger">
										{agent.agent_activity?.last_error ?? agent.last_error}
									</p>
								{/if}

								<section class="subpanel">
									<div class="page-header">
										<div>
											<h4>Publish observability</h4>
											<p>Latest seed source, batch outcomes, and persistent log status.</p>
										</div>
										<StatusBadge
											tone={publishTone(agent.publish_observability)}
											text={formatSeedSource(agent.publish_observability?.last_seed_source ?? null)}
										/>
									</div>

									{#if agent.publish_observability}
										<div class="metrics-grid">
											<section class="subpanel">
												<h4>Latest batch</h4>
												<dl class="kv-list">
													<div class="kv-row">
														<dt>Last seed</dt>
														<dd>{formatTimestamp(agent.publish_observability.last_seed_at)}</dd>
													</div>
													<div class="kv-row">
														<dt>Keyword publish</dt>
														<dd>{formatPublishBatch(agent.publish_observability.latest_keyword_batch)}</dd>
													</div>
													<div class="kv-row">
														<dt>Source publish</dt>
														<dd>{formatPublishBatch(agent.publish_observability.latest_source_batch)}</dd>
													</div>
												</dl>
											</section>

											<section class="subpanel">
												<h4>Counters</h4>
												<dl class="kv-list">
													<div class="kv-row">
														<dt>Keyword totals</dt>
														<dd>
															{agent.publish_observability.keyword_counters.batches} batches ·
															{agent.publish_observability.keyword_counters.acked_contacts}/
															{agent.publish_observability.keyword_counters.attempted_contacts} acked
														</dd>
													</div>
													<div class="kv-row">
														<dt>Source totals</dt>
														<dd>
															{agent.publish_observability.source_counters.batches} batches ·
															{agent.publish_observability.source_counters.acked_contacts}/
															{agent.publish_observability.source_counters.attempted_contacts} acked
														</dd>
													</div>
													<div class="kv-row">
														<dt>Log file</dt>
														<dd>
															{#if agent.publish_observability.log_file}
																<span class="mono">{agent.publish_observability.log_file.path}</span>
															{:else}
																pending
															{/if}
														</dd>
													</div>
												</dl>
											</section>
										</div>
									{:else}
										<p class="message message--accent">
											Publish observability is still pending from this agent.
										</p>
									{/if}
								</section>

								<section class="subpanel">
									<div class="page-header">
										<div>
											<h4>Harvest observability</h4>
											<p>Track unsolicited Kad demand and passive replay activity by family.</p>
										</div>
										<StatusBadge
											tone={harvestTone(agent.harvest_observability)}
											text={agent.harvest_observability ? 'harvest telemetry' : 'telemetry pending'}
										/>
									</div>

									{#if agent.harvest_observability}
										<div class="metrics-grid">
											<section class="subpanel">
												<h4>Inbound demand</h4>
												<dl class="kv-list">
													<div class="kv-row">
														<dt>Keyword requests</dt>
														<dd>{formatHarvestFamily(agent.harvest_observability.keyword_requests)}</dd>
													</div>
													<div class="kv-row">
														<dt>Source requests</dt>
														<dd>{formatHarvestFamily(agent.harvest_observability.source_requests)}</dd>
													</div>
													<div class="kv-row">
														<dt>Notes requests</dt>
														<dd>{formatHarvestFamily(agent.harvest_observability.notes_requests)}</dd>
													</div>
													<div class="kv-row">
														<dt>Last keyword seen</dt>
														<dd>{formatTimestamp(agent.harvest_observability.keyword_requests.last_seen_at)}</dd>
													</div>
													<div class="kv-row">
														<dt>Last source seen</dt>
														<dd>{formatTimestamp(agent.harvest_observability.source_requests.last_seen_at)}</dd>
													</div>
													<div class="kv-row">
														<dt>Last notes seen</dt>
														<dd>{formatTimestamp(agent.harvest_observability.notes_requests.last_seen_at)}</dd>
													</div>
												</dl>
											</section>

											<section class="subpanel">
												<h4>Passive replay</h4>
												<dl class="kv-list">
													<div class="kv-row">
														<dt>Keyword replay</dt>
														<dd>{formatPassiveReplay(agent.harvest_observability.passive_keyword_replay)}</dd>
													</div>
													<div class="kv-row">
														<dt>Keyword last start</dt>
														<dd>{formatTimestamp(agent.harvest_observability.passive_keyword_replay.last_started_at)}</dd>
													</div>
													<div class="kv-row">
														<dt>Keyword last completion</dt>
														<dd>{formatTimestamp(agent.harvest_observability.passive_keyword_replay.last_completed_at)}</dd>
													</div>
													<div class="kv-row">
														<dt>Keyword last target</dt>
														<dd>{agent.harvest_observability.passive_keyword_replay.last_target ?? 'Pending'}</dd>
													</div>
													<div class="kv-row">
														<dt>Source replay</dt>
														<dd>{formatPassiveReplay(agent.harvest_observability.passive_source_replay)}</dd>
													</div>
													<div class="kv-row">
														<dt>Source last start</dt>
														<dd>{formatTimestamp(agent.harvest_observability.passive_source_replay.last_started_at)}</dd>
													</div>
													<div class="kv-row">
														<dt>Source last completion</dt>
														<dd>{formatTimestamp(agent.harvest_observability.passive_source_replay.last_completed_at)}</dd>
													</div>
													<div class="kv-row">
														<dt>Source last target</dt>
														<dd>{agent.harvest_observability.passive_source_replay.last_target ?? 'Pending'}</dd>
													</div>
													<div class="kv-row">
														<dt>Notes replay</dt>
														<dd>{formatPassiveReplay(agent.harvest_observability.passive_notes_replay)}</dd>
													</div>
													<div class="kv-row">
														<dt>Notes last start</dt>
														<dd>{formatTimestamp(agent.harvest_observability.passive_notes_replay.last_started_at)}</dd>
													</div>
													<div class="kv-row">
														<dt>Notes last completion</dt>
														<dd>{formatTimestamp(agent.harvest_observability.passive_notes_replay.last_completed_at)}</dd>
													</div>
													<div class="kv-row">
														<dt>Notes last target</dt>
														<dd>{agent.harvest_observability.passive_notes_replay.last_target ?? 'Pending'}</dd>
													</div>
												</dl>
											</section>
										</div>
									{:else}
										<p class="message message--accent">
											Harvest observability is still pending from this agent.
										</p>
									{/if}
								</section>

								<form
									class="agent-form"
									method="POST"
									action={`/api/agents/${agent.registration.indexer_id}/interface-selection`}
								>
									<section class="form-section">
										<h4>Control interface</h4>
										<div class="form-grid">
											<label class="field">
												<span>Control interface</span>
												<select class="select" name="control_bind_iface">
													<option value="">-- choose --</option>
													<option
														value={ANY_BIND_OPTION}
														selected={isAnyBindingOption(agent.config.control as InterfaceBindingSelection)}
													>
														Any (0.0.0.0)
													</option>
													{#each agent.report?.interfaces ?? [] as iface}
														<option
															value={iface.name}
															selected={iface.name === agent.config.control.bind_iface}
														>
															{iface.name}
															{#if iface.is_vpn_candidate} (vpn){/if}
															{#if iface.has_default_route} (default-route){/if}
														</option>
													{/each}
												</select>
											</label>

											<label class="field">
												<span>Control bind IP</span>
												<input
													class="input"
													name="control_bind_ip"
													value={agent.config.control.bind_ip ?? ''}
												/>
											</label>

											<label class="field">
												<span>Control listen port</span>
												<input
													class="input"
													name="control_listen_port"
													value={agent.config.control.listen_port}
												/>
											</label>
										</div>

										<label class="checkbox-field">
											<input
												type="checkbox"
												name="control_selection_confirmed"
												checked={agent.config.control.selection_confirmed}
											/>
											<span>Control selection confirmed</span>
										</label>
									</section>

									<section class="form-section">
										<h4>P2P interface</h4>
										<div class="form-grid">
											<label class="field">
												<span>P2P interface</span>
												<select class="select" name="p2p_bind_iface">
													<option value="">-- choose --</option>
													<option
														value={ANY_BIND_OPTION}
														selected={isAnyBindingOption(agent.config.p2p as InterfaceBindingSelection)}
													>
														Any (0.0.0.0)
													</option>
													{#each agent.report?.interfaces ?? [] as iface}
														<option
															value={iface.name}
															selected={iface.name === agent.config.p2p.bind_iface}
														>
															{iface.name}
															{#if iface.is_vpn_candidate} (vpn){/if}
															{#if iface.has_default_route} (default-route){/if}
														</option>
													{/each}
												</select>
											</label>

											<label class="field">
												<span>P2P bind IP</span>
												<input class="input" name="p2p_bind_ip" value={agent.config.p2p.bind_ip ?? ''} />
											</label>

											<label class="field">
												<span>Kad listen port</span>
												<input
													class="input"
													name="p2p_kad_listen_port"
													value={agent.config.p2p.kad.listen_port}
												/>
											</label>

											<label class="field">
												<span>eD2k listen port</span>
												<input
													class="input"
													name="p2p_ed2k_listen_port"
													value={agent.config.p2p.ed2k.listen_port}
												/>
											</label>
										</div>

										<label class="checkbox-field">
											<input
												type="checkbox"
												name="p2p_selection_confirmed"
												checked={agent.config.p2p.selection_confirmed}
											/>
											<span>P2P selection confirmed</span>
										</label>
									</section>

									<section class="form-section">
										<h4>NAT for P2P</h4>
										<div class="form-grid">
											<label class="field">
												<span>NAT backend</span>
												<select class="select" name="nat_p2p_backend">
													<option
														value="upnp_miniupnpc"
														selected={desiredNatBackend(agent) === 'upnp_miniupnpc'}
													>
														upnp_miniupnpc
													</option>
													<option
														value="upnp_rupnp"
														selected={desiredNatBackend(agent) === 'upnp_rupnp'}
													>
														upnp_rupnp
													</option>
													<option
														value="upnp_igd"
														selected={desiredNatBackend(agent) === 'upnp_igd'}
													>
														upnp_igd
													</option>
												</select>
											</label>

											<label class="field">
												<span>IGD IP override</span>
												<input class="input" name="nat_p2p_igd_ip" value={agent.config.nat.p2p.igd_ip ?? ''} />
											</label>

											<label class="field">
												<span>MiniSSDPd socket</span>
												<input
													class="input"
													name="nat_p2p_minissdpd_socket"
													value={agent.config.nat.p2p.minissdpd_socket ?? ''}
												/>
											</label>

											<label class="field">
												<span>SSDP local port</span>
												<input
													class="input"
													name="nat_p2p_ssdp_local_port"
													value={agent.config.nat.p2p.ssdp_local_port ?? ''}
												/>
											</label>

											<label class="field">
												<span>Discovery timeout</span>
												<input
													class="input"
													name="nat_p2p_discovery_timeout_secs"
													value={agent.config.nat.p2p.discovery_timeout_secs}
												/>
											</label>

											<label class="field">
												<span>Lease duration</span>
												<input
													class="input"
													name="nat_p2p_lease_duration_secs"
													value={agent.config.nat.p2p.lease_duration_secs}
												/>
											</label>

											<label class="field">
												<span>Renew margin</span>
												<input
													class="input"
													name="nat_p2p_renew_margin_secs"
													value={agent.config.nat.p2p.renew_margin_secs}
												/>
											</label>

											<label class="field">
												<span>External IP override</span>
												<input
													class="input"
													name="nat_p2p_external_ip_override"
													value={agent.config.nat.p2p.external_ip_override ?? ''}
												/>
											</label>
										</div>

										<label class="checkbox-field">
											<input
												type="checkbox"
												name="nat_p2p_enabled"
												checked={agent.config.nat.p2p.enabled}
											/>
											<span>Enable UPnP or NAT traversal for P2P</span>
										</label>
									</section>

									<div class="form-actions">
										<button class="button" type="submit">Apply networking config</button>
									</div>
								</form>
							</article>
						{/each}
					</div>
				{:else}
					<p class="message message--warn">
						No agent registrations yet. Once an agent registers, its networking form and live status will appear here.
					</p>
				{/if}
			</div>
		</Panel>
	{/if}
</main>
