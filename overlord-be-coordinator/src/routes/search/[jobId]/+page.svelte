<script lang="ts">
	import { onMount } from 'svelte';

	import Panel from '$lib/components/Panel.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { FileRecord, SearchJobStatusView } from '$lib/shared/internal-api';
	import {
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
			<div class="dispatch-grid">
				{#each job.dispatches as dispatch}
					<article class="dispatch-card">
						<div class="dispatch-card__header">
							<div>
								<strong class="dispatch-card__title">{shortIndexerId(dispatch.indexer_id)}</strong>
								<p class="mono">{dispatch.indexer_id}</p>
							</div>
							<StatusBadge tone={dispatchTone(dispatch.status)} text={dispatch.status} />
						</div>

						<div class="dispatch-card__meta">
							<StatusBadge tone="neutral" text={`${dispatch.result_count} results`} />
							<StatusBadge tone="neutral" text={`${dispatch.batch_count} batches`} />
						</div>

						<dl class="meta-list">
							<div class="meta-row">
								<dt>Queued</dt>
								<dd><strong>{formatTimestamp(dispatch.created_at)}</strong></dd>
							</div>
							<div class="meta-row">
								<dt>Started</dt>
								<dd><strong>{formatTimestamp(dispatch.started_at)}</strong></dd>
							</div>
							<div class="meta-row">
								<dt>Finished</dt>
								<dd><strong>{formatTimestamp(dispatch.finished_at)}</strong></dd>
							</div>
						</dl>

						{#if dispatch.last_error}
							<p class="message message--danger">{dispatch.last_error}</p>
						{/if}
					</article>
				{/each}
			</div>
		{:else}
			<p class="message message--accent">No dispatches recorded for this job yet.</p>
		{/if}
	</Panel>

	<Panel
		title="Results"
		subtitle="Incoming files surface here as the SSE stream appends results and job snapshots update."
	>
		{#if job.results.length === 0}
			<p class="message message--accent">No results yet. Keep this page open while agents continue searching.</p>
		{:else}
			<div class="result-grid">
				{#each job.results as file}
					<article class="result-card">
						<div class="result-card__header">
							<div>
								<div class="result-card__title-row">
									<strong class="result-card__title">{primaryFileName(file)}</strong>
									{#if file.content_type}
										<StatusBadge tone="accent" text={file.content_type} />
									{/if}
								</div>
								<p class="mono">{primaryHashValue(file)}</p>
							</div>
							<div class="badge-row">
								<StatusBadge tone="neutral" text={formatBytes(file.size)} />
								<StatusBadge tone="neutral" text={`${file.sources.length} sources`} />
							</div>
						</div>

						<dl class="meta-list">
							<div class="meta-row">
								<dt>Names</dt>
								<dd><strong>{file.names.length}</strong></dd>
							</div>
							<div class="meta-row">
								<dt>Hashes</dt>
								<dd><strong>{file.hashes.length}</strong></dd>
							</div>
							<div class="meta-row">
								<dt>Tags</dt>
								<dd><strong>{file.tags.length}</strong></dd>
							</div>
						</dl>

						{#if file.sources.length > 0}
							<div class="subpanel">
								<h4>First source</h4>
								<p class="mono">{file.sources[0].address}</p>
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</Panel>
</main>
