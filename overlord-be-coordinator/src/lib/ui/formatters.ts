import type {
	AgentInterfacesView,
	FileRecord,
	InterfaceBindingReport,
	InterfaceBindingSelection,
	KadHarvestFamilyObservability,
	KadPassiveReplayObservability,
	KadPublishObservability,
	PublishBatchSummary,
	SnoopDemandHoleEntry,
	SnoopDashboardEntry,
	SnoopTrendEntry
} from '$lib/shared/internal-api';

const ANY_BIND_IP = '0.0.0.0';

export function isAnyBindingOption(binding: InterfaceBindingSelection): boolean {
	return binding.bind_iface === null && binding.bind_ip === ANY_BIND_IP;
}

export function desiredNatBackend(agent: AgentInterfacesView): string {
	return agent.config.nat.p2p.backend_order[0] ?? 'upnp_miniupnpc';
}

export function shortIndexerId(indexerId: string): string {
	return indexerId.slice(0, 8);
}

export function formatTimestamp(value: string | null): string {
	if (!value) {
		return 'Pending';
	}

	return new Date(value).toLocaleString();
}

export function formatCompactTimestamp(value: string | null): string {
	if (!value) {
		return 'Pending';
	}

	return new Date(value).toLocaleTimeString([], {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function formatBytes(value: number | null): string {
	if (value === null) {
		return 'Unknown size';
	}

	if (value < 1024) {
		return `${value} B`;
	}

	const units = ['KB', 'MB', 'GB', 'TB'];
	let current = value / 1024;
	let unitIndex = 0;
	while (current >= 1024 && unitIndex < units.length - 1) {
		current /= 1024;
		unitIndex += 1;
	}

	return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatSnoopDetails(entry: SnoopDashboardEntry): string {
	switch (entry.family) {
		case 'keyword':
			return entry.restrictive_payload_hex
				? `start=${entry.start_position} restrictive=${entry.restrictive_payload_hex}`
				: `start=${entry.start_position}`;
		case 'source':
			return `start=${entry.start_position} size=${formatBytes(entry.size)}`;
		case 'notes':
			return `size=${formatBytes(entry.size)}`;
	}
}

export function formatDemandDetails(entry: SnoopTrendEntry | SnoopDemandHoleEntry): string {
	switch (entry.family) {
		case 'keyword':
			return entry.restrictive_payload_hex
				? `start=${entry.start_position ?? 0} restrictive=${entry.restrictive_payload_hex}`
				: `start=${entry.start_position ?? 0}`;
		case 'source':
			return `start=${entry.start_position ?? 0} size=${formatBytes(entry.size)}`;
		case 'notes':
			return `size=${formatBytes(entry.size)}`;
	}
}

export function formatSeedSource(value: KadPublishObservability['last_seed_source']): string {
	if (!value) {
		return 'Pending';
	}

	return value.replaceAll('_', ' ');
}

export function formatPublishBatch(summary: PublishBatchSummary | null): string {
	if (!summary) {
		return 'Pending';
	}

	return `items=${summary.published_items} acked=${summary.acked_contacts}/${summary.attempted_contacts} failed=${summary.failed_contacts} timed_out=${summary.timed_out_contacts}`;
}

export function formatHarvestFamily(summary: KadHarvestFamilyObservability | null): string {
	if (!summary) {
		return 'Pending';
	}

	return `${summary.observed_requests} seen · ${summary.unique_shapes_observed} unique · ${summary.queued_entries} queued`;
}

export function formatPassiveReplay(summary: KadPassiveReplayObservability | null): string {
	if (!summary) {
		return 'Pending';
	}

	return `${summary.completed_cycles}/${summary.started_cycles} cycles · ${summary.emitted_results} results · ${summary.posted_batches} batches`;
}

export function summarizeBinding(report: InterfaceBindingReport | null, label: string): string {
	if (!report) {
		return `${label} pending`;
	}

	const iface = report.bind_iface ?? 'auto';
	const ip = report.resolved_bind_ip ?? 'unresolved';
	return `${label} ${report.state} · ${iface} · ${ip}`;
}

export function summarizeExternalAddress(agent: AgentInterfacesView): string {
	return (
		agent.nat?.gateway?.external_ip ??
		agent.nat?.observed_external_addresses?.[0] ??
		agent.config.nat.p2p.external_ip_override ??
		'none'
	);
}

export function primaryFileName(file: FileRecord): string {
	return file.names[0] ?? file.hashes[0]?.value ?? 'unnamed result';
}

export function primaryHashValue(file: FileRecord): string {
	return file.hashes[0]?.value ?? 'unknown hash';
}
