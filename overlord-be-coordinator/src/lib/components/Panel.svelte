<script lang="ts">
	export let title = '';
	export let subtitle: string | null = null;
	export let padded = true;
</script>

<section class:panel--padded={padded} class="panel wm-shell">
	{#if title || subtitle || $$slots.actions}
		<header class="panel__header wm-titlebar">
			<div class="panel__heading">
				{#if title}
					<h3>{title}</h3>
				{/if}
				{#if subtitle}
					<p>{subtitle}</p>
				{/if}
			</div>
			{#if $$slots.actions}
				<div>
					<slot name="actions" />
				</div>
			{/if}
		</header>
	{/if}

	<div class="panel__body">
		<slot />
	</div>
</section>
