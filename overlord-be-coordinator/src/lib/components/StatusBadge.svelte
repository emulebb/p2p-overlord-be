<script lang="ts">
	export let tone: 'neutral' | 'accent' | 'good' | 'warn' | 'danger' = 'neutral';
	export let text: string;
</script>

<span class={`status-badge wm-chip status-badge--${tone}`}>{text}</span>
