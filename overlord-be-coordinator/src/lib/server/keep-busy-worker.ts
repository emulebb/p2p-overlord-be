import { load as loadHtml } from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import type { Logger } from 'winston';

import { getKeepBusyConfig, type KeepBusySourceConfig } from '$lib/server/keep-busy-config';
import {
	listDispatchableKeepBusyCandidates,
	pruneExpiredKeepBusyCandidates,
	recordKeepBusyDispatch,
	type KeepBusyCandidateInput,
	upsertKeepBusyCandidates
} from '$lib/server/keep-busy-store';
import logger from '$lib/server/logger';
import { listTrendingSnoopDemand } from '$lib/server/snoop-store';
import { dispatchSearchRequest } from '$lib/server/search-dispatch';
import { getAgentActivity, getAgentInterfaceReport, getAgentStats, listRegistrations, storeKeepBusyStatus } from '$lib/server/state';
import type { KeepBusyCandidateView, KeepBusyWorkerStatus, SearchRequest } from '$lib/shared/internal-api';

const log: Logger = logger.child({ module: 'keep-busy-worker' });
const xmlParser = new XMLParser({
	ignoreAttributes: true,
	parseTagValue: true,
	trimValues: true
});

type WorkerRuntime = {
	started: boolean;
	running: boolean;
	timer: ReturnType<typeof setInterval> | null;
	lastDispatchByAgent: Map<string, number>;
};

declare global {
	// eslint-disable-next-line no-var
	var __overlordKeepBusyWorkerRuntime: WorkerRuntime | undefined;
}

function getRuntime(): WorkerRuntime {
	if (!globalThis.__overlordKeepBusyWorkerRuntime) {
		globalThis.__overlordKeepBusyWorkerRuntime = {
			started: false,
			running: false,
			timer: null,
			lastDispatchByAgent: new Map()
		};
	}
	return globalThis.__overlordKeepBusyWorkerRuntime;
}

function buildStatus(
	partial: Partial<KeepBusyWorkerStatus>,
	config = getKeepBusyConfig()
): KeepBusyWorkerStatus {
	return {
		enabled: config.enabled,
		started: partial.started ?? getRuntime().started,
		pollIntervalSecs: config.pollIntervalSecs,
		lastStartedAt: partial.lastStartedAt ?? null,
		lastCompletedAt: partial.lastCompletedAt ?? null,
		lastError: partial.lastError ?? null,
		lastSourcesFetched: partial.lastSourcesFetched ?? 0,
		lastCandidatesSeen: partial.lastCandidatesSeen ?? 0,
		lastJobsDispatched: partial.lastJobsDispatched ?? 0
	};
}

function applyCleanupRegexes(value: string, cleanupRegexes: string[]): string {
	let cleaned = value;
	for (const pattern of cleanupRegexes) {
		try {
			cleaned = cleaned.replace(new RegExp(pattern, 'gi'), ' ');
		} catch (error) {
			log.warn('keep_busy_cleanup_regex_invalid', { pattern, error });
		}
	}
	return cleaned;
}

function normalizeFetchedTitle(value: string, cleanupRegexes: string[]): string {
	return applyCleanupRegexes(value, cleanupRegexes)
		.replace(/\[[^\]]+\]/g, ' ')
		.replace(/[|]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function extractRssTitles(payload: string): string[] {
	const parsed = xmlParser.parse(payload) as Record<string, unknown>;
	const channelItems = ((parsed.rss as { channel?: { item?: unknown } } | undefined)?.channel?.item ??
		[]) as unknown;
	const rssItems = Array.isArray(channelItems) ? channelItems : [channelItems];
	const feedEntries = ((parsed.feed as { entry?: unknown } | undefined)?.entry ?? []) as unknown;
	const atomEntries = Array.isArray(feedEntries) ? feedEntries : [feedEntries];

	return [...rssItems, ...atomEntries]
		.map((entry) => {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
				return null;
			}
			const title = (entry as Record<string, unknown>).title;
			if (typeof title === 'string') {
				return title;
			}
			if (title && typeof title === 'object' && !Array.isArray(title)) {
				const text = (title as Record<string, unknown>)['#text'];
				return typeof text === 'string' ? text : null;
			}
			return null;
		})
		.filter((title): title is string => Boolean(title?.trim()));
}

function extractHtmlTitles(payload: string, selector: string): string[] {
	const document = loadHtml(payload);
	return document(selector)
		.toArray()
		.map((element) => document(element).text().trim())
		.filter((title) => title.length > 0);
}

async function fetchSourceTerms(source: KeepBusySourceConfig): Promise<KeepBusyCandidateInput[]> {
	const response = await fetch(source.url, {
		headers: {
			'user-agent': 'p2p-overlord-keep-busy/0.1'
		},
		signal: AbortSignal.timeout(source.timeoutSecs * 1000)
	});
	if (!response.ok) {
		throw new Error(`source fetch failed with ${response.status}`);
	}
	const payload = await response.text();
	const titles =
		source.type === 'rss'
			? extractRssTitles(payload)
			: extractHtmlTitles(payload, source.selector);

	return titles
		.map((title) => normalizeFetchedTitle(title, source.cleanupRegexes))
		.filter((title) => title.length > 0)
		.map((title) => ({
			query: title,
			rawTitle: title,
			sourceId: source.id,
			sourceLabel: source.label,
			sourceUrl: source.url,
			sourceWeight: source.weight
		}));
}

function scoreCandidate(candidate: KeepBusyCandidateView, now: Date): number {
	const ageHours = Math.max(
		0,
		(now.getTime() - new Date(candidate.lastSeenAt).getTime()) / (1000 * 60 * 60)
	);
	const freshness = Math.max(0, 48 - ageHours);
	return (
		candidate.sourceWeight * 100 +
		freshness * 4 +
		candidate.successCount * 20 +
		Math.min(candidate.lastResultCount, 50) -
		candidate.zeroResultCount * 10 -
		candidate.dispatchCount
	);
}

/**
 * Stored-term keyword dispatch should coexist with passive source replay. Use the per-family
 * harvested keyword backlog when available so a deep source snoop queue does not suppress
 * coordinator-issued keyword jobs.
 */
function keywordQueueDepth(indexerId: string): number | null {
	const stats = getAgentStats(indexerId);
	if (!stats) {
		return null;
	}
	return stats.harvest_observability?.keyword_requests.queued_entries ?? stats.snoop_queue_depth;
}

function keepBusyActivityAllowsDispatch(indexerId: string): boolean {
	const state = getAgentActivity(indexerId)?.state;
	return state === 'idle' || state === 'passive_harvest_replay';
}

function listSlackKadAgents(now: Date, config = getKeepBusyConfig()): string[] {
	const runtime = getRuntime();
	return listRegistrations()
		.filter((registration) => registration.protocol === 'kad2')
		.filter((registration) => getAgentInterfaceReport(registration.indexer_id)?.p2p.state === 'applied')
		.filter((registration) => keepBusyActivityAllowsDispatch(registration.indexer_id))
		.filter((registration) => {
			const stats = getAgentStats(registration.indexer_id);
			return Boolean(stats) && stats!.crawl_rate <= config.crawlRateSlackThreshold;
		})
		.filter((registration) => {
			const queuedKeywords = keywordQueueDepth(registration.indexer_id);
			return queuedKeywords !== null && queuedKeywords <= config.maxSnoopQueueDepth;
		})
		.filter((registration) => {
			const lastDispatchAt = runtime.lastDispatchByAgent.get(registration.indexer_id);
			return (
				!lastDispatchAt ||
				now.getTime() - lastDispatchAt >= config.perAgentMinGapSecs * 1000
			);
		})
		.map((registration) => registration.indexer_id);
}

async function ingestConfiguredSources(config = getKeepBusyConfig()): Promise<number> {
	const fetchedInputs = await Promise.all(
		config.sources
			.filter((source) => source.enabled)
			.map(async (source) => {
				try {
					return await fetchSourceTerms(source);
				} catch (error) {
					log.warn('keep_busy_source_fetch_failed', {
						sourceId: source.id,
						sourceUrl: source.url,
						error
					});
					return [];
				}
			})
	);

	await upsertKeepBusyCandidates(fetchedInputs.flat());
	return fetchedInputs.length;
}

/**
 * Coordinator-persisted snoops preserve exact source and notes hashes plus file sizes, so they can
 * be recycled into active keep-busy work items even after the agent-local passive queue has rotated.
 * Harvested keyword snoops are not promoted here because the coordinator only sees the Kad target
 * hash, not the original text query.
 */
async function ingestPersistedSnoopDemand(): Promise<number> {
	const trending = await listTrendingSnoopDemand(64, 24);
	const inputs: KeepBusyCandidateInput[] = trending.flatMap((entry) => {
		if ((entry.family !== 'source' && entry.family !== 'notes') || entry.size === null) {
			return [];
		}
		return [
			{
				kind: entry.family,
				queryKey: `snoop:${entry.family}:${entry.logical_key}`,
				fileHash: {
					kind: 'ed2k',
					value: entry.target
				},
				fileSize: entry.size,
				rawTitle: entry.sample_name ?? `${entry.family} ${entry.target}`,
				sourceId: `harvested_${entry.family}_demand`,
				sourceLabel: `Harvested ${entry.family}`,
				sourceUrl: '/api/snoop',
				sourceWeight: Math.max(2, Math.min(50, entry.observed_count))
			}
		];
	});

	await upsertKeepBusyCandidates(inputs);
	return inputs.length;
}

async function dispatchKeepBusyJobs(config = getKeepBusyConfig()): Promise<number> {
	const now = new Date();
	const candidates = (await listDispatchableKeepBusyCandidates(now, 64)).sort(
		(left, right) => scoreCandidate(right, now) - scoreCandidate(left, now)
	);
	const slackAgents = listSlackKadAgents(now, config);
	const runtime = getRuntime();
	let jobsDispatched = 0;
	const usedCandidates = new Set<string>();

	for (const indexerId of slackAgents) {
		if (jobsDispatched >= config.maxJobsPerPoll) {
			break;
		}
		const candidate = candidates.find((entry) => !usedCandidates.has(entry.queryKey));
		if (!candidate) {
			break;
		}

		const request: SearchRequest | null =
			candidate.kind === 'keyword' && candidate.query
				? {
						protocol: 'kad2',
						kind: 'keyword',
						query: candidate.query
					}
				: candidate.kind !== 'keyword' && candidate.file_hash && candidate.file_size
					? {
							protocol: 'kad2',
							kind: candidate.kind,
							file_hash: candidate.file_hash,
							file_size: candidate.file_size
						}
					: null;
		if (!request) {
			continue;
		}
		await dispatchSearchRequest(request, {
			callbackOrigin: 'http://127.0.0.1:13300',
			fetch: (input, init) => fetch(input, init),
			origin: 'keep_busy_auto',
			originKey: candidate.queryKey,
			targetIndexerIds: [indexerId]
		});
		await recordKeepBusyDispatch(candidate.queryKey, config.termCooldownSecs, now);
		runtime.lastDispatchByAgent.set(indexerId, now.getTime());
		usedCandidates.add(candidate.queryKey);
		jobsDispatched += 1;
	}

	storeKeepBusyStatus(
		buildStatus({
			started: runtime.started,
			lastCandidatesSeen: candidates.length,
			lastJobsDispatched: jobsDispatched
		}, config)
	);
	return jobsDispatched;
}

async function runKeepBusyCycle(): Promise<void> {
	const runtime = getRuntime();
	if (runtime.running) {
		return;
	}

	const config = getKeepBusyConfig();
	storeKeepBusyStatus(
		buildStatus({
			started: runtime.started,
			lastStartedAt: new Date().toISOString()
		}, config)
	);
	if (!config.enabled) {
		return;
	}

	runtime.running = true;
	try {
		await pruneExpiredKeepBusyCandidates(config.termTtlSecs);
		const sourcesFetched = await ingestConfiguredSources(config);
		const harvestedDemandSeen = await ingestPersistedSnoopDemand();
		const jobsDispatched = await dispatchKeepBusyJobs(config);
		storeKeepBusyStatus(
			buildStatus(
				{
					started: runtime.started,
					lastCompletedAt: new Date().toISOString(),
					lastError: null,
					lastSourcesFetched: sourcesFetched + (harvestedDemandSeen > 0 ? 1 : 0),
					lastJobsDispatched: jobsDispatched
				},
				config
			)
		);
	} catch (error) {
		storeKeepBusyStatus(
			buildStatus(
				{
					started: runtime.started,
					lastCompletedAt: new Date().toISOString(),
					lastError: error instanceof Error ? error.message : String(error)
				},
				config
			)
		);
		log.error('keep_busy_cycle_failed', { error });
	} finally {
		runtime.running = false;
	}
}

/**
 * Starts the keep-busy worker once per coordinator process. The loop is lazy-started from the
 * request path so development HMR and non-server build phases do not spin a background timer.
 */
export function ensureKeepBusyWorkerStarted(): void {
	const runtime = getRuntime();
	if (runtime.started) {
		return;
	}

	const config = getKeepBusyConfig();
	runtime.started = true;
	storeKeepBusyStatus(
		buildStatus(
			{
				started: true
			},
			config
		)
	);
	void runKeepBusyCycle();
	runtime.timer = setInterval(() => {
		void runKeepBusyCycle();
	}, config.pollIntervalSecs * 1000);
	log.info('keep_busy_worker_started', {
		enabled: config.enabled,
		pollIntervalSecs: config.pollIntervalSecs,
		sources: config.sources.length
	});
}
