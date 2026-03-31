<script lang="ts">
	export let label: string;
	export let value: string | number;
	export let hint: string | null = null;
	export let tone: 'neutral' | 'accent' | 'good' | 'warn' = 'neutral';
</script>

<article class={`summary-card wm-shell summary-card--${tone}`}>
	<span class="summary-card__label">{label}</span>
	<strong class="summary-card__value">{value}</strong>
	{#if hint}
		<p class="summary-card__hint">{hint}</p>
	{/if}
</article>
