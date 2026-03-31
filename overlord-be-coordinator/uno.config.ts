import { defineConfig, presetMini } from 'unocss';

/**
 * Lightweight utility theme for the coordinator's compact fluxbox-style console refresh.
 */
export default defineConfig({
	presets: [presetMini()],
	theme: {
		colors: {
			wm: {
				bg: '#dbe4ea',
				panel: '#f7fafc',
				line: '#7d8c98',
				lineStrong: '#43505a',
				title: '#27323a',
				titleActive: '#13212b',
				accent: '#0b8598',
				text: '#13202b',
				muted: '#5b6772',
				good: '#11724d',
				warn: '#9e6500',
				danger: '#b24242'
			}
		}
	},
	shortcuts: {
		'wm-shell': 'border border-wm-lineStrong bg-wm-panel shadow-[2px_2px_0_rgba(19,32,43,0.18)]',
		'wm-titlebar':
			'flex items-center justify-between gap-3 border-b border-wm-lineStrong bg-wm-title px-3 py-2 text-[11px] font-700 uppercase tracking-[0.18em] text-white',
		'wm-table':
			'w-full border-collapse bg-white text-[13px] text-wm-text [&_th]:(border-b border-r border-wm-lineStrong bg-[#e4eaef] px-3 py-2 text-left text-[11px] font-700 uppercase tracking-[0.12em] text-wm-muted last:border-r-0) [&_td]:(border-b border-r border-wm-line px-3 py-2 align-top last:border-r-0)',
		'wm-chip':
			'inline-flex items-center rounded-none border border-wm-lineStrong bg-[#edf2f6] px-2 py-[2px] text-[11px] font-700 uppercase tracking-[0.12em] text-wm-text',
		'wm-button':
			'inline-flex items-center justify-center rounded-none border border-wm-lineStrong bg-[#eef3f7] px-3 py-2 text-[11px] font-700 uppercase tracking-[0.16em] text-wm-text transition hover:bg-white disabled:cursor-wait disabled:opacity-55',
		'wm-input':
			'w-full rounded-none border border-wm-lineStrong bg-white px-3 py-2 text-[13px] text-wm-text outline-none focus:border-wm-accent'
	}
});
