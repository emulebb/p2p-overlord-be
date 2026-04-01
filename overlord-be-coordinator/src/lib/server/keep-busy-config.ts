import type { Logger } from 'winston';

import logger from '$lib/server/logger';

const log: Logger = logger.child({ module: 'keep-busy-config' });

export type KeepBusySourceConfig =
	| {
			id: string;
			label: string;
			type: 'rss';
			url: string;
			enabled: boolean;
			weight: number;
			timeoutSecs: number;
			cleanupRegexes: string[];
	  }
	| {
			id: string;
			label: string;
			type: 'html_list';
			url: string;
			selector: string;
			enabled: boolean;
			weight: number;
			timeoutSecs: number;
			cleanupRegexes: string[];
	  };

export type KeepBusyConfig = {
	enabled: boolean;
	pollIntervalSecs: number;
	maxJobsPerPoll: number;
	perAgentMinGapSecs: number;
	termCooldownSecs: number;
	crawlRateSlackThreshold: number;
	maxSnoopQueueDepth: number;
	termTtlSecs: number;
	sources: KeepBusySourceConfig[];
};

type KeepBusySourceBase = {
	id: string;
	label: string;
	url: string;
	enabled: boolean;
	weight: number;
	timeoutSecs: number;
	cleanupRegexes: string[];
};

const DEFAULT_CONFIG: KeepBusyConfig = {
	enabled: false,
	pollIntervalSecs: 180,
	maxJobsPerPoll: 1,
	perAgentMinGapSecs: 900,
	termCooldownSecs: 21_600,
	crawlRateSlackThreshold: 0.05,
	maxSnoopQueueDepth: 8,
	termTtlSecs: 172_800,
	sources: []
};

function parseBooleanEnv(name: string, fallback: boolean): boolean {
	const value = process.env[name]?.trim().toLowerCase();
	if (!value) {
		return fallback;
	}
	return ['1', 'true', 'yes', 'on'].includes(value);
}

function parseIntegerEnv(name: string, fallback: number): number {
	const value = process.env[name]?.trim();
	if (!value) {
		return fallback;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFloatEnv(name: string, fallback: number): number {
	const value = process.env[name]?.trim();
	if (!value) {
		return fallback;
	}
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseCleanupRegexes(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function parseSourceBase(
	record: Record<string, unknown>,
	index: number,
	url: string
): KeepBusySourceBase {
	return {
		id:
			typeof record.id === 'string' && record.id.trim().length > 0
				? record.id.trim()
				: `source-${index + 1}`,
		label:
			typeof record.label === 'string' && record.label.trim().length > 0
				? record.label.trim()
				: `Source ${index + 1}`,
		url,
		enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
		weight:
			typeof record.weight === 'number' && Number.isFinite(record.weight)
				? Math.max(1, Math.floor(record.weight))
				: 1,
		timeoutSecs:
			typeof record.timeout_secs === 'number' && Number.isFinite(record.timeout_secs)
				? Math.max(1, Math.floor(record.timeout_secs))
				: 10,
		cleanupRegexes: parseCleanupRegexes(record.cleanup_regexes)
	};
}

function parseKeepBusySources(): KeepBusySourceConfig[] {
	const raw = process.env.OVERLORD_KEEP_BUSY_SOURCES_JSON?.trim();
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}

		const sources: KeepBusySourceConfig[] = [];
		for (const [index, entry] of parsed.entries()) {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
				continue;
			}
			const record = entry as Record<string, unknown>;
			const type = record.type;
			const url = typeof record.url === 'string' ? record.url.trim() : '';
			if ((type !== 'rss' && type !== 'html_list') || !url) {
				continue;
			}

			if (type === 'rss') {
				sources.push({
					...parseSourceBase(record, index, url),
					type
				});
				continue;
			}

			const selector = typeof record.selector === 'string' ? record.selector.trim() : '';
			if (!selector) {
				continue;
			}

			sources.push({
				...parseSourceBase(record, index, url),
				type,
				selector
			});
		}
		return sources;
	} catch (error) {
		log.warn('keep_busy_sources_parse_failed', { error });
		return [];
	}
}

/**
 * Loads keep-busy worker settings from environment variables because the coordinator does not yet
 * have a dedicated runtime config file beyond its DB/env bootstrap path.
 */
export function getKeepBusyConfig(): KeepBusyConfig {
	return {
		enabled: parseBooleanEnv('OVERLORD_KEEP_BUSY_ENABLED', DEFAULT_CONFIG.enabled),
		pollIntervalSecs: parseIntegerEnv(
			'OVERLORD_KEEP_BUSY_POLL_INTERVAL_SECS',
			DEFAULT_CONFIG.pollIntervalSecs
		),
		maxJobsPerPoll: parseIntegerEnv(
			'OVERLORD_KEEP_BUSY_MAX_JOBS_PER_POLL',
			DEFAULT_CONFIG.maxJobsPerPoll
		),
		perAgentMinGapSecs: parseIntegerEnv(
			'OVERLORD_KEEP_BUSY_PER_AGENT_MIN_GAP_SECS',
			DEFAULT_CONFIG.perAgentMinGapSecs
		),
		termCooldownSecs: parseIntegerEnv(
			'OVERLORD_KEEP_BUSY_TERM_COOLDOWN_SECS',
			DEFAULT_CONFIG.termCooldownSecs
		),
		crawlRateSlackThreshold: parseFloatEnv(
			'OVERLORD_KEEP_BUSY_CRAWL_RATE_SLACK_THRESHOLD',
			DEFAULT_CONFIG.crawlRateSlackThreshold
		),
		maxSnoopQueueDepth: parseIntegerEnv(
			'OVERLORD_KEEP_BUSY_MAX_SNOOP_QUEUE_DEPTH',
			DEFAULT_CONFIG.maxSnoopQueueDepth
		),
		termTtlSecs: parseIntegerEnv(
			'OVERLORD_KEEP_BUSY_TERM_TTL_SECS',
			DEFAULT_CONFIG.termTtlSecs
		),
		sources: parseKeepBusySources()
	};
}
