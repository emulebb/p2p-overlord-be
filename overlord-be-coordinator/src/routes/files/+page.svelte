<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { IndexedFileListResponse, IndexedFileSort } from '$lib/shared/internal-api';
	import { formatBytes, formatCompactTimestamp } from '$lib/ui/formatters';

	type ShellStatus = {
		registered_agents: number;
		search_jobs: number;
		file_count: number;
		search_results: number;
		result_batches: number;
	};

	const sortOptions: Array<{ value: IndexedFileSort; label: string }> = [
		{ value: 'last_seen_desc', label: 'Last seen' },
		{ value: 'first_seen_desc', label: 'First seen' },
		{ value: 'name_asc', label: 'Name' },
		{ value: 'size_desc', label: 'Size' },
		{ value: 'sources_desc', label: 'Most sources' },
		{ value: 'searches_desc', label: 'Most searches' }
	];

	export let data: {
		shellStatus: ShellStatus;
		files: IndexedFileListResponse;
	};

	let response = data.files;
	let lastServerResponse = data.files;
	let query = data.files.query;
	let sort = data.files.sort;
	let loading = false;
	let error = '';

	$: if (data.files !== lastServerResponse) {
		lastServerResponse = data.files;
		response = data.files;
		query = data.files.query;
		sort = data.files.sort;
		loading = false;
		error = '';
	}

	function buildSearchParams(page: number): URLSearchParams {
		const params = new URLSearchParams();
		const trimmed = query.trim();
		if (trimmed) {
			params.set('q', trimmed);
		}
		params.set('sort', sort);
		params.set('page', String(page));
		params.set('page_size', String(response.page_size));
		return params;
	}

	function syncBrowserUrl(params: URLSearchParams): void {
		if (typeof window === 'undefined') {
			return;
		}

		const nextUrl = new URL(window.location.href);
		nextUrl.search = params.toString();
		window.history.replaceState(window.history.state, '', nextUrl);
	}

	/**
	 * Refreshes the browse list from the coordinator-local files API without leaving the page.
	 */
	async function loadFiles(page: number): Promise<void> {
		loading = true;
		error = '';
		const params = buildSearchParams(page);

		try {
			const apiUrl = `/api/files?${params.toString()}`;
			const apiResponse = await fetch(apiUrl);
			if (!apiResponse.ok) {
				const payload = (await apiResponse.json()) as { error?: string };
				throw new Error(payload.error ?? `file browse failed with ${apiResponse.status}`);
			}

			response = (await apiResponse.json()) as IndexedFileListResponse;
			query = response.query;
			sort = response.sort;
			syncBrowserUrl(params);
		} catch (loadError) {
			error = loadError instanceof Error ? loadError.message : String(loadError);
		} finally {
			loading = false;
		}
	}

	async function submitSearch(): Promise<void> {
		await loadFiles(1);
	}

	async function loadPreviousPage(): Promise<void> {
		if (response.page <= 1 || loading) {
			return;
		}
		await loadFiles(response.page - 1);
	}

	async function loadNextPage(): Promise<void> {
		if (loading || response.page >= response.total_pages) {
			return;
		}
		await loadFiles(response.page + 1);
	}
</script>

<svelte:head>
	<title>Indexed Files</title>
</svelte:head>

<main class="page">
	<section class="page-header">
		<div>
			<p class="eyebrow">Browse</p>
			<h2>Indexed files</h2>
			<p>
				Search and inspect the coordinator’s persisted file index without launching a live network
				search.
			</p>
		</div>
		<div class="badge-row">
			<StatusBadge tone="good" text={`${data.shellStatus.file_count} indexed`} />
			<StatusBadge tone={response.query ? 'accent' : 'neutral'} text={response.query ? 'fts active' : 'browse all'} />
			<StatusBadge tone={loading ? 'warn' : 'neutral'} text={loading ? 'loading' : `${response.total} matches`} />
		</div>
	</section>

	<section class="split-grid">
		<Panel
			title="Browse Controls"
			subtitle="This screen searches only the coordinator index. Use Quick Search for live agent fan-out."
		>
			<div class="stack">
				<form class="inline-form" method="GET" action="/files" on:submit|preventDefault={submitSearch}>
					<label class="field">
						<span>File query</span>
						<input
							class="input"
							name="q"
							bind:value={query}
							placeholder="ubuntu linux"
							autocomplete="off"
						/>
					</label>
					<label class="field">
						<span>Sort</span>
						<select class="select" name="sort" bind:value={sort}>
							{#each sortOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>
					<button class="button" type="submit" disabled={loading}>
						{loading ? 'Refreshing...' : 'Refresh files'}
					</button>
				</form>

				<p class="hint">
					Search matches against indexed file names in PostgreSQL. Results stay file-centric even
					when several names point at the same file. Popularity sorts use deduped source count and
					distinct search-job count.
				</p>

				{#if error}
					<p class="message message--danger">{error}</p>
				{/if}
			</div>
		</Panel>

		<Panel
			title="Browse Status"
			subtitle="Quick operator context for the current indexed-files result set."
		>
			<div class="stack">
				<dl class="meta-list">
					<div class="meta-row">
						<dt>Current page</dt>
						<dd><strong>{response.total_pages === 0 ? '0 / 0' : `${response.page} / ${response.total_pages}`}</strong></dd>
					</div>
					<div class="meta-row">
						<dt>Page size</dt>
						<dd><strong>{response.page_size}</strong></dd>
					</div>
					<div class="meta-row">
						<dt>Total matches</dt>
						<dd><strong>{response.total}</strong></dd>
					</div>
					<div class="meta-row">
						<dt>Mode</dt>
						<dd><strong>{response.query ? 'searching index' : 'listing index'}</strong></dd>
					</div>
				</dl>

				<div class="pagination-row">
					<button class="button button--subtle" type="button" on:click={loadPreviousPage} disabled={loading || response.page <= 1}>
						Previous
					</button>
					<button
						class="button button--subtle"
						type="button"
						on:click={loadNextPage}
						disabled={loading || response.page >= response.total_pages || response.total_pages === 0}
					>
						Next
					</button>
				</div>
			</div>
		</Panel>
	</section>

	<Panel
		title="Indexed Results"
		subtitle="Expand any file inline to inspect every stored name, hash, tag, and source."
	>
		{#if response.items.length === 0}
			<p class="message message--accent">
				{#if response.query}
					No indexed files match this query yet.
				{:else}
					No indexed files have been promoted into the coordinator yet.
				{/if}
			</p>
		{:else}
			<div class="result-list indexed-file-list">
				{#each response.items as file}
					<article class="result-card">
						<div class="result-card__header">
							<div>
								<div class="result-card__title-row">
									<strong class="result-card__title">{file.primary_name}</strong>
									{#if file.content_type}
										<StatusBadge tone="accent" text={file.content_type} />
									{/if}
								</div>
								<p class="mono">file #{file.file_id}</p>
							</div>
							<div class="badge-row">
								<StatusBadge tone="neutral" text={formatBytes(file.size)} />
								<StatusBadge tone="neutral" text={`${file.source_count} sources`} />
								<StatusBadge tone="neutral" text={`${file.search_job_count} searches`} />
								<StatusBadge tone="neutral" text={`${file.hashes.length} hashes`} />
							</div>
						</div>

						<dl class="meta-list">
							<div class="meta-row">
								<dt>First seen</dt>
								<dd><strong>{formatCompactTimestamp(file.first_seen)}</strong></dd>
							</div>
							<div class="meta-row">
								<dt>Last seen</dt>
								<dd><strong>{formatCompactTimestamp(file.last_seen)}</strong></dd>
							</div>
							<div class="meta-row">
								<dt>Names</dt>
								<dd><strong>{file.names.length}</strong></dd>
							</div>
							<div class="meta-row">
								<dt>Search jobs</dt>
								<dd><strong>{file.search_job_count}</strong></dd>
							</div>
							<div class="meta-row">
								<dt>Tags</dt>
								<dd><strong>{file.tags.length}</strong></dd>
							</div>
						</dl>

						<details class="inline-details">
							<summary>Inspect full indexed record</summary>

							<div class="detail-grid">
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
						</details>
					</article>
				{/each}
			</div>
		{/if}
	</Panel>
</main>
