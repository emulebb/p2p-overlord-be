<script lang="ts">
	import type { FileRecord } from '$lib/shared/internal-api';
	import { buildEd2kLink } from '$lib/ui/formatters';

	export let file: FileRecord;

	let copied = false;
	let copyFailed = false;
	let copyResetHandle: ReturnType<typeof setTimeout> | null = null;
	let ed2kLink: string | null = null;

	$: ed2kLink = buildEd2kLink(file);

	/**
	 * Writes text to the clipboard, with a textarea fallback for browsers that do not expose the
	 * async clipboard API to the current page context.
	 */
	async function writeClipboardText(value: string): Promise<void> {
		if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(value);
			return;
		}

		if (typeof document === 'undefined') {
			throw new Error('clipboard is unavailable');
		}

		const textarea = document.createElement('textarea');
		textarea.value = value;
		textarea.setAttribute('readonly', 'true');
		textarea.style.position = 'fixed';
		textarea.style.left = '-9999px';
		document.body.appendChild(textarea);
		textarea.select();

		try {
			const copiedWithExecCommand = document.execCommand('copy');
			if (!copiedWithExecCommand) {
				throw new Error('copy command was rejected');
			}
		} finally {
			document.body.removeChild(textarea);
		}
	}

	/**
	 * Copies the computed eD2k link so operators can paste the file straight into eMule.
	 */
	async function copyEd2kLink(): Promise<void> {
		if (!ed2kLink) {
			return;
		}

		try {
			await writeClipboardText(ed2kLink);
			copied = true;
			copyFailed = false;

			if (copyResetHandle) {
				clearTimeout(copyResetHandle);
			}

			copyResetHandle = setTimeout(() => {
				copied = false;
			}, 1800);
		} catch {
			copied = false;
			copyFailed = true;

			if (copyResetHandle) {
				clearTimeout(copyResetHandle);
			}

			copyResetHandle = setTimeout(() => {
				copyFailed = false;
			}, 2400);
		}
	}
</script>

<button
	class={`copy-chip ${copied ? 'copy-chip--good' : ''} ${copyFailed ? 'copy-chip--danger' : ''}`}
	type="button"
	disabled={!ed2kLink}
	on:click={copyEd2kLink}
	title={ed2kLink ? 'Copy eD2k link for eMule' : 'An eD2k link requires a size and an eD2k hash'}
>
	{#if copied}
		copied
	{:else if copyFailed}
		copy failed
	{:else if ed2kLink}
		copy ed2k
	{:else}
		ed2k n/a
	{/if}
</button>
