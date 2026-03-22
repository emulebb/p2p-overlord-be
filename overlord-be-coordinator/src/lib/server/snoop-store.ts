import { getDb } from '$lib/server/db';
import type {
	SnoopDashboardEntry,
	SnoopDemandHoleEntry,
	SnoopEntry,
	SnoopObservation,
	SnoopTrendEntry
} from '$lib/shared/internal-api';

type PersistedSnoopEntry = {
	family: string;
	logicalKey: string;
	target: string;
	startPosition: number | null;
	size: bigint | null;
	restrictivePayloadHex: string | null;
	hitCount: number;
	firstSeen: Date;
	lastSeen: Date;
	lastDrainedAt: Date | null;
};

type GroupedSnoopDemand = {
	family: string;
	logicalKey: string;
	target: string;
	startPosition: number | null;
	size: bigint | null;
	restrictivePayloadHex: string | null;
	_count: {
		logicalKey: number;
	};
	_max: {
		observedAt: Date | null;
	};
};

type ReplaySummary = {
	replay_count: number;
	last_replay_at: string | null;
	resolved_file_count: number;
	sample_name: string | null;
	last_error: string | null;
};

function bigintToNumber(value: bigint | null): number | null {
	return value === null ? null : Number(value);
}

function toSnoopEntry(entry: PersistedSnoopEntry): SnoopEntry {
	switch (entry.family) {
		case 'keyword':
			return {
				family: 'keyword',
				logical_key: entry.logicalKey,
				target: entry.target,
				start_position: entry.startPosition ?? 0,
				restrictive_payload_hex: entry.restrictivePayloadHex,
				hit_count: entry.hitCount,
				first_seen: entry.firstSeen.toISOString(),
				last_seen: entry.lastSeen.toISOString(),
				last_drained_at: entry.lastDrainedAt?.toISOString() ?? null
			};
		case 'source':
			return {
				family: 'source',
				logical_key: entry.logicalKey,
				target: entry.target,
				start_position: entry.startPosition ?? 0,
				size: Number(entry.size ?? 0n),
				hit_count: entry.hitCount,
				first_seen: entry.firstSeen.toISOString(),
				last_seen: entry.lastSeen.toISOString(),
				last_drained_at: entry.lastDrainedAt?.toISOString() ?? null
			};
		case 'notes':
			return {
				family: 'notes',
				logical_key: entry.logicalKey,
				target: entry.target,
				size: Number(entry.size ?? 0n),
				hit_count: entry.hitCount,
				first_seen: entry.firstSeen.toISOString(),
				last_seen: entry.lastSeen.toISOString(),
				last_drained_at: entry.lastDrainedAt?.toISOString() ?? null
			};
		default:
			throw new Error(`unsupported snoop entry family: ${entry.family}`);
	}
}

async function buildReplaySummary(logicalKey: string): Promise<ReplaySummary> {
	const db = getDb();
	const [replayCount, latestReplay, resolvedFiles, latestResolvedReplay] = await Promise.all([
		db.harvestReplay.count({
			where: {
				logicalKey
			}
		}),
		db.harvestReplay.findFirst({
			where: {
				logicalKey
			},
			orderBy: {
				completedAt: 'desc'
			},
			select: {
				completedAt: true,
				error: true
			}
		}),
		db.harvestReplayFile.findMany({
			where: {
				replay: {
					logicalKey
				}
			},
			distinct: ['fileId'],
			select: {
				fileId: true
			}
		}),
		db.harvestReplay.findFirst({
			where: {
				logicalKey,
				files: {
					some: {}
				}
			},
			orderBy: {
				completedAt: 'desc'
			},
			include: {
				files: {
					take: 1,
					include: {
						file: {
							include: {
								names: {
									orderBy: {
										firstSeen: 'asc'
									},
									take: 1
								}
							}
						}
					}
				}
			}
		})
	]);

	return {
		replay_count: replayCount,
		last_replay_at: latestReplay?.completedAt.toISOString() ?? null,
		resolved_file_count: resolvedFiles.length,
		sample_name: latestResolvedReplay?.files[0]?.file.names[0]?.name ?? null,
		last_error: latestReplay?.error ?? null
	};
}

async function listGroupedSnoopDemand(windowHours: number): Promise<GroupedSnoopDemand[]> {
	const db = getDb();
	const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
	const groups = await db.snoopLog.groupBy({
		by: ['family', 'logicalKey', 'target', 'startPosition', 'size', 'restrictivePayloadHex'],
		where: {
			observedAt: {
				gte: since
			}
		},
		_count: {
			logicalKey: true
		},
		_max: {
			observedAt: true
		}
	});

	return groups.sort((left, right) => {
		const hitDelta = right._count.logicalKey - left._count.logicalKey;
		if (hitDelta !== 0) {
			return hitDelta;
		}
		return (right._max.observedAt?.getTime() ?? 0) - (left._max.observedAt?.getTime() ?? 0);
	});
}

/**
 * Replaces the persisted snoop snapshot for a single indexer and appends raw observations for demand analytics.
 */
export async function storeSnoopEntries(
	indexerId: string,
	entries: SnoopEntry[],
	observations: SnoopObservation[] = []
): Promise<void> {
	const db = getDb();
	await db.$transaction(async (tx) => {
		await tx.snoopEntry.deleteMany({
			where: {
				indexerId
			}
		});
		if (entries.length > 0) {
			await tx.snoopEntry.createMany({
				data: entries.map((entry) => {
					switch (entry.family) {
						case 'keyword':
							return {
								indexerId,
								logicalKey: entry.logical_key,
								family: entry.family,
								target: entry.target,
								startPosition: entry.start_position,
								size: null,
								restrictivePayloadHex: entry.restrictive_payload_hex,
								hitCount: entry.hit_count,
								firstSeen: new Date(entry.first_seen),
								lastSeen: new Date(entry.last_seen),
								lastDrainedAt: entry.last_drained_at ? new Date(entry.last_drained_at) : null
							};
						case 'source':
							return {
								indexerId,
								logicalKey: entry.logical_key,
								family: entry.family,
								target: entry.target,
								startPosition: entry.start_position,
								size: BigInt(entry.size),
								restrictivePayloadHex: null,
								hitCount: entry.hit_count,
								firstSeen: new Date(entry.first_seen),
								lastSeen: new Date(entry.last_seen),
								lastDrainedAt: entry.last_drained_at ? new Date(entry.last_drained_at) : null
							};
						case 'notes':
							return {
								indexerId,
								logicalKey: entry.logical_key,
								family: entry.family,
								target: entry.target,
								startPosition: null,
								size: BigInt(entry.size),
								restrictivePayloadHex: null,
								hitCount: entry.hit_count,
								firstSeen: new Date(entry.first_seen),
								lastSeen: new Date(entry.last_seen),
								lastDrainedAt: entry.last_drained_at ? new Date(entry.last_drained_at) : null
							};
					}
				})
			});
		}
		if (observations.length > 0) {
			await tx.snoopLog.createMany({
				data: observations.map((observation) => ({
					indexerId,
					family: observation.family,
					logicalKey: observation.logical_key,
					target: observation.target,
					startPosition: observation.start_position,
					size: observation.size === null ? null : BigInt(observation.size),
					restrictivePayloadHex: observation.restrictive_payload_hex,
					observedAt: new Date(observation.observed_at)
				}))
			});
		}
	});
}

/**
 * Restores the persisted snoop snapshot for a single indexer.
 */
export async function restoreSnoopEntries(indexerId: string): Promise<SnoopEntry[]> {
	const db = getDb();
	const entries = await db.snoopEntry.findMany({
		where: {
			indexerId
		},
		orderBy: [{ hitCount: 'desc' }, { lastSeen: 'desc' }]
	});
	return entries.map(toSnoopEntry);
}

/**
 * Lists recently harvested search queries across all indexers for the dashboard.
 */
export async function listRecentSnoopEntries(limit = 25): Promise<SnoopDashboardEntry[]> {
	const db = getDb();
	const entries = await db.snoopEntry.findMany({
		orderBy: [{ lastSeen: 'desc' }, { hitCount: 'desc' }],
		take: limit
	});
	const indexerIds = [...new Set(entries.map((entry) => entry.indexerId))];
	const registries = indexerIds.length
		? await db.indexerRegistry.findMany({
				where: {
					id: {
						in: indexerIds
					}
				}
			})
		: [];
	const registryById = new Map(registries.map((registry) => [registry.id, registry]));
	return entries.map((entry) => {
		const registry = registryById.get(entry.indexerId);
		return {
			...toSnoopEntry(entry),
			indexer_id: entry.indexerId,
			hostname: registry?.hostname ?? null,
			protocol: (registry?.protocol as SnoopDashboardEntry['protocol']) ?? null
		};
	});
}

/**
 * Lists the hottest harvested Kad demand shapes for the requested time window.
 */
export async function listTrendingSnoopDemand(
	limit = 10,
	windowHours = 24
): Promise<SnoopTrendEntry[]> {
	const groups = await listGroupedSnoopDemand(windowHours);
	const selected = groups.slice(0, limit);
	const replaySummaries = await Promise.all(selected.map((entry) => buildReplaySummary(entry.logicalKey)));

	return selected.map((entry, index) => ({
		family: entry.family as SnoopTrendEntry['family'],
		logical_key: entry.logicalKey,
		target: entry.target,
		start_position: entry.startPosition,
		size: bigintToNumber(entry.size),
		restrictive_payload_hex: entry.restrictivePayloadHex,
		observed_count: entry._count.logicalKey,
		last_seen: entry._max.observedAt?.toISOString() ?? new Date(0).toISOString(),
		replay_count: replaySummaries[index].replay_count,
		last_replay_at: replaySummaries[index].last_replay_at,
		resolved_file_count: replaySummaries[index].resolved_file_count,
		sample_name: replaySummaries[index].sample_name
	}));
}

/**
 * Lists harvested Kad shapes that are being replayed but still have not resolved to any files.
 */
export async function listDemandHoles(
	limit = 10,
	windowHours = 24
): Promise<SnoopDemandHoleEntry[]> {
	const groups = await listGroupedSnoopDemand(windowHours);
	const holes: SnoopDemandHoleEntry[] = [];

	for (const entry of groups) {
		const summary = await buildReplaySummary(entry.logicalKey);
		if (summary.replay_count === 0 || summary.resolved_file_count > 0) {
			continue;
		}
		holes.push({
			family: entry.family as SnoopDemandHoleEntry['family'],
			logical_key: entry.logicalKey,
			target: entry.target,
			start_position: entry.startPosition,
			size: bigintToNumber(entry.size),
			restrictive_payload_hex: entry.restrictivePayloadHex,
			observed_count: entry._count.logicalKey,
			last_seen: entry._max.observedAt?.toISOString() ?? new Date(0).toISOString(),
			replay_count: summary.replay_count,
			last_replay_at: summary.last_replay_at,
			last_error: summary.last_error
		});
		if (holes.length >= limit) {
			break;
		}
	}

	return holes;
}
