<script lang="ts">
	import 'uno.css';
	import '../app.css';

	import { page } from '$app/stores';

	type ShellStatus = {
		registered_agents: number;
		search_jobs: number;
		file_count: number;
		search_results: number;
		result_batches: number;
	};

	export let data: {
		shellStatus: ShellStatus;
	};

	const navigation = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/files', label: 'Files' },
		{ href: '/#quick-search', label: 'Quick Search' },
		{ href: '/#agent-networking', label: 'Agents' }
	];

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') {
			return pathname === '/';
		}

		if (href.startsWith('/#')) {
			return pathname === '/';
		}

		return pathname === href;
	}
</script>

<div class="app-shell">
	<header class="app-topbar">
		<div class="app-topbar__brand">
			<p class="eyebrow">Overlord</p>
			<div>
				<h1>Coordinator Console</h1>
				<p>Live ops surface for search fan-out, harvested demand, and agent networking.</p>
			</div>
		</div>

		<nav class="app-nav" aria-label="Coordinator navigation">
			{#each navigation as item}
				<a
					href={item.href}
					class:app-nav__link--active={isActive(item.href, $page.url.pathname)}
					class="app-nav__link"
				>
					{item.label}
				</a>
			{/each}
			{#if $page.url.pathname === '/files'}
				<span class="app-nav__context">Indexed Files</span>
			{/if}
			{#if $page.url.pathname.startsWith('/search/')}
				<span class="app-nav__context">Search Job</span>
			{/if}
		</nav>
	</header>

	<section class="status-strip" aria-label="Coordinator status">
		<div class="status-strip__item">
			<span>Agents</span>
			<strong>{data.shellStatus.registered_agents}</strong>
		</div>
		<div class="status-strip__item">
			<span>Search Jobs</span>
			<strong>{data.shellStatus.search_jobs}</strong>
		</div>
		<div class="status-strip__item">
			<span>Indexed Files</span>
			<strong>{data.shellStatus.file_count}</strong>
		</div>
		<div class="status-strip__item">
			<span>Search Results</span>
			<strong>{data.shellStatus.search_results}</strong>
		</div>
		<div class="status-strip__item">
			<span>Result Batches</span>
			<strong>{data.shellStatus.result_batches}</strong>
		</div>
	</section>

	<div class="app-content">
		<slot />
	</div>
</div>
