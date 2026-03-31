<script lang="ts">
	import { onMount } from 'svelte';

	import Ed2kCopyButton from '$lib/components/Ed2kCopyButton.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { FileRecord, SearchJobStatusView } from '$lib/shared/internal-api';
	import {
		buildEd2kLink,
		formatBytes,
		formatTimestamp,
		primaryFileName,
		primaryHashValue,
		shortIndexerId
	} from '$lib/ui/formatters';

	type StreamMessage =
		| { event: 'snapshot' | 'job'; data: SearchJobStatusView }
		| { event: 'file'; data: FileRecord }
		| { event: 'heartbeat'; data: { at: string } };

	type StreamState = 'connecting' | 'live' | 'disconnected';

	export let data: {
		job: SearchJobStatusView;
		shellStatus: {
			registered_agents: number;
			search_jobs: number;
			file_count: number;
			search_results: number;
			result_batches: number;
		};
	};

	let job = data.job;
	let streamError = '';
	let eventSource: EventSource | null = null;
	let streamState: StreamState = 'connecting';
	let lastHeartbeatAt: string | null = null;
	let lastMessageAt: string | null = null;
	let expandedResultKeys = new Set<string>();

	function statusTone(status: SearchJobStatusView['status']): 'accent' | 'good' | 'warn' | 'danger' {
		switch (status) {
			case 'completed':
				return 'good';
			case 'completed_with_errors':
			case 'cancelling':
				return 'warn';
			case 'failed':
			case 'cancelled':
				return 'danger';
			default:
				return 'accent';
		}
	}

	function dispatchTone(
		status: SearchJobStatusView['dispatches'][number]['status']
	): 'accent' | 'good' | 'warn' | 'danger' | 'neutral' {
		switch (status) {
			case 'completed':
				return 'good';
			case 'failed':
			case 'dispatch_failed':
				return 'danger';
			case 'cancelled':
				return 'warn';
			case 'dispatched':
			case 'active':
				return 'accent';
			default:
				return 'neutral';
		}
	}

	function streamTone(state: StreamState): 'accent' | 'good' | 'warn' {
		switch (state) {
			case 'live':
				return 'good';
			case 'disconnected':
				return 'warn';
			default:
				return 'accent';
		}
	}

	/**
	 * Builds a stable-enough client key for row disclosure without relying on server-side UI ids.
	 */
	function resultKey(file: FileRecord, index: number): string {
		return `${primaryHashValue(file)}:${primaryFileName(file)}:${index}`;
	}

	/**
	 * Toggles the inline disclosure row for one streamed result.
	 */
	function toggleExpandedResult(key: string): void {
		const nextExpanded = new Set(expandedResultKeys);
		if (nextExpanded.has(key)) {
			nextExpanded.delete(key);
		} else {
			nextExpanded.add(key);
		}
		expandedResultKeys = nextExpanded;
	}

	async function cancelSearch() {
		const response = await fetch(`/api/search/${job.job_id}/cancel`, {
			method: 'POST'
		});
		if (!response.ok) {
			const payload = (await response.json()) as { error?: string };
			streamError = payload.error ?? `cancel failed with ${response.status}`;
			return;
		}

		job = (await response.json()) as SearchJobStatusView;
	}

	function attach(event: StreamMessage['event']) {
		eventSource?.addEventListener(event, (raw) => {
			const message = raw as MessageEvent<string>;
			const parsed = JSON.parse(message.data) as StreamMessage['data'];
			lastMessageAt = new Date().toISOString();
			if (event === 'snapshot' || event === 'job') {
				job = parsed as SearchJobStatusView;
			} else if (event === 'file') {
				job = {
					...job,
					result_count: job.result_count + 1,
					results: [parsed as FileRecord, ...job.results]
				};
			} else if (event === 'heartbeat') {
				lastHeartbeatAt = (parsed as { at: string }).at;
			}
		});
	}

	onMount(() => {
		eventSource = new EventSource(`/api/search/${job.job_id}/stream`);
		attach('snapshot');
		attach('job');
		attach('file');
		attach('heartbeat');
		eventSource.onopen = () => {
			streamState = 'live';
			streamError = '';
		};
		eventSource.onerror = () => {
			streamState = 'disconnected';
			streamError = 'Live stream disconnected. The page stays readable while the browser retries automatically.';
		};

		return () => {
			eventSource?.close();
			eventSource = null;
		};
	});
</script>

<svelte:head>
	<title>Search Job {job.job_id}</title>
</svelte:head>

<main class="page">
	<section class="page-header">
		<div>
			<p class="eyebrow">Search Job</p>
			<h2>{job.query ?? 'Kad search'}</h2>
			<p>
				<a class="text-link" href="/">Back to dashboard</a>
				<span class="muted"> · job {job.job_id}</span>
			</p>
		</div>
		<div class="badge-row">
			<StatusBadge tone={statusTone(job.status)} text={job.status} />
			<StatusBadge tone={streamTone(streamState)} text={`stream ${streamState}`} />
			<StatusBadge tone="neutral" text={`${job.result_count} results`} />
		</div>
	</section>

	<section class="split-grid">
		<Panel
			title="Job Lifecycle"
			subtitle="Current query state, timing, and dispatch readiness at a glance."
		>
			<div class="stack">
				<dl class="meta-list">
					<div class="meta-row">
						<dt>Protocol / kind</dt>
						<dd>
							<strong>{job.protocol} / {job.kind}</strong>
						</dd>
					</div>
					<div class="meta-row">
						<dt>Created</dt>
						<dd><strong>{formatTimestamp(job.created_at)}</strong></dd>
					</div>
					<div class="meta-row">
						<dt>Started</dt>
						<dd><strong>{formatTimestamp(job.started_at)}</strong></dd>
					</div>
					<div class="meta-row">
						<dt>Finished</dt>
						<dd><strong>{formatTimestamp(job.finished_at)}</strong></dd>
					</div>
					<div class="meta-row">
						<dt>Cancel requested</dt>
						<dd><strong>{formatTimestamp(job.cancel_requested_at)}</strong></dd>
					</div>
				</dl>

				{#if job.last_error}
					<p class="message message--danger">{job.last_error}</p>
				{/if}

				<div class="badge-row">
					{#if job.status === 'active' || job.status === 'queued' || job.status === 'cancelling'}
						<button class="button button--danger" type="button" on:click={cancelSearch}>
							Cancel search
						</button>
					{/if}
				</div>
			</div>
		</Panel>

		<Panel
			title="Stream Health"
			subtitle="The search page stays readable even if the live SSE connection drops and reconnects."
		>
			<div class="stack">
				<p
					class={`message ${
						streamState === 'live'
							? 'message--good'
							: streamState === 'disconnected'
								? 'message--warn'
								: 'message--accent'
					}`}
				>
					{#if streamState === 'live'}
						Live updates are connected and the page is receiving search events.
					{:else if streamState === 'disconnected'}
						Live updates are temporarily disconnected. The browser keeps retrying while the current snapshot remains available.
					{:else}
						Connecting to the search stream now.
					{/if}
				</p>

				<dl class="meta-list">
					<div class="meta-row">
						<dt>Last heartbeat</dt>
						<dd><strong>{formatTimestamp(lastHeartbeatAt)}</strong></dd>
					</div>
					<div class="meta-row">
						<dt>Last message</dt>
						<dd><strong>{formatTimestamp(lastMessageAt)}</strong></dd>
					</div>
					<div class="meta-row">
						<dt>Dispatch count</dt>
						<dd><strong>{job.dispatches.length}</strong></dd>
					</div>
				</dl>

				{#if streamError}
					<p class="message message--warn">{streamError}</p>
				{/if}
			</div>
		</Panel>
	</section>

	<Panel
		title="Dispatches"
		subtitle="Per-agent dispatch progress, batch flow, and error visibility."
	>
		{#if job.dispatches.length > 0}
			<div class="table-shell wm-shell">
				<table class="wm-table">
					<thead>
						<tr>
							<th>Indexer</th>
							<th>Status</th>
							<th>Results</th>
							<th>Batches</th>
							<th>Queued</th>
							<th>Started</th>
							<th>Finished</th>
							<th>Last error</th>
						</tr>
					</thead>
					<tbody>
						{#each job.dispatches as dispatch}
							<tr class="hover:bg-[#f4f8fb]">
								<td>
									<div class="flex flex-col gap-1">
										<strong>{shortIndexerId(dispatch.indexer_id)}</strong>
										<span class="mono text-[11px] text-[#5b6772] break-all">{dispatch.indexer_id}</span>
									</div>
								</td>
								<td><StatusBadge tone={dispatchTone(dispatch.status)} text={dispatch.status} /></td>
								<td class="mono">{dispatch.result_count}</td>
								<td class="mono">{dispatch.batch_count}</td>
								<td class="mono">{formatTimestamp(dispatch.created_at)}</td>
								<td class="mono">{formatTimestamp(dispatch.started_at)}</td>
								<td class="mono">{formatTimestamp(dispatch.finished_at)}</td>
								<td>{dispatch.last_error ?? 'none'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="message message--accent">No dispatches recorded for this job yet.</p>
		{/if}
	</Panel>

	<Panel
		title="Results"
		subtitle="Incoming files land here as compact operator rows while SSE appends snapshots and new hits."
	>
		{#if job.results.length === 0}
			<p class="message message--accent">No results yet. Keep this page open while agents continue searching.</p>
		{:else}
			<div class="table-shell wm-shell">
				<table class="wm-table wm-table--dense">
					<thead>
						<tr>
							<th>Name</th>
							<th>Size</th>
							<th>ED2K</th>
							<th>Sources</th>
							<th>Tags</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each job.results as file, index}
							{@const key = resultKey(file, index)}
							<tr class="hover:bg-[#f4f8fb]">
								<td>
									<div class="flex flex-col gap-1">
										<div class="flex flex-wrap items-center gap-2">
											<strong>{primaryFileName(file)}</strong>
											{#if file.content_type}
												<StatusBadge tone="accent" text={file.content_type} />
											{/if}
										</div>
										<span class="mono text-[11px] text-[#5b6772]">{file.names.length} names / {file.hashes.length} hashes</span>
									</div>
								</td>
								<td class="mono">{formatBytes(file.size)}</td>
								<td class="mono break-all">{primaryHashValue(file)}</td>
								<td class="mono">{file.sources.length}</td>
								<td class="mono">{file.tags.length}</td>
								<td>
									<div class="result-row-actions">
										<Ed2kCopyButton file={file} />
										<button
											class="row-toggle"
											type="button"
											aria-expanded={expandedResultKeys.has(key)}
											aria-label={expandedResultKeys.has(key)
												? `Collapse streamed details for ${primaryFileName(file)}`
												: `Expand streamed details for ${primaryFileName(file)}`}
											on:click={() => toggleExpandedResult(key)}
										>
											{expandedResultKeys.has(key) ? '▾' : '▸'}
										</button>
									</div>
								</td>
							</tr>
							{#if expandedResultKeys.has(key)}
								<tr class="detail-row">
								<td colspan="6" class="bg-[#f8fbfd]">
									<div class="inline-details">
										<div class="detail-grid">
											<section class="subpanel">
												<h4>eD2k link</h4>
												{#if buildEd2kLink(file)}
													<p class="mono detail-copy-preview">{buildEd2kLink(file)}</p>
												{:else}
													<p class="muted">No copyable link yet. This result needs both size and eD2k hash.</p>
												{/if}
											</section>

											<section class="subpanel">
												<h4>First source</h4>
												{#if file.sources.length > 0}
													<p class="mono">{file.sources[0].address}</p>
												{:else}
													<p class="muted">No source data attached yet.</p>
												{/if}
											</section>

											<section class="subpanel">
												<h4>Names</h4>
												<ul class="detail-list">
													{#each file.names as name}
														<li>{name}</li>
													{/each}
												</ul>
											</section>

											<section class="subpanel">
												<h4>Hashes</h4>
												<ul class="detail-list mono">
													{#each file.hashes as hash}
														<li>{hash.kind}: {hash.value}</li>
													{/each}
												</ul>
											</section>

											<section class="subpanel">
												<h4>Tags</h4>
												{#if file.tags.length === 0}
													<p class="muted">No tags stored.</p>
												{:else}
													<ul class="detail-list mono">
														{#each file.tags as tag}
															<li>{tag.key}: {JSON.stringify(tag.value)}</li>
														{/each}
													</ul>
												{/if}
											</section>

											<section class="subpanel">
												<h4>Sources</h4>
												{#if file.sources.length === 0}
													<p class="muted">No sources stored.</p>
												{:else}
													<ul class="detail-list mono">
														{#each file.sources as source}
															<li>{source.protocol}: {source.address}</li>
														{/each}
													</ul>
												{/if}
											</section>
										</div>
									</div>
								</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Panel>
</main>
