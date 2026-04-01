import type { KeepBusyCandidate } from '@prisma/client';

import { getDb } from '$lib/server/db';
import type { KeepBusyCandidateView } from '$lib/shared/internal-api';

export type KeepBusyCandidateInput = {
	query: string;
	rawTitle: string;
	sourceId: string;
	sourceLabel: string;
	sourceUrl: string;
	sourceWeight: number;
	seenAt?: Date;
};

function toIso(value: Date | null): string | null {
	return value ? value.toISOString() : null;
}

/**
 * Produces a stable key and a query string that is safe to send to Kad keyword search.
 */
export function normalizeKeepBusyQuery(input: string): { queryKey: string; query: string } | null {
	const query = input
		.replace(/[_+.]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (query.length < 3) {
		return null;
	}
	const queryKey = query.toLowerCase();
	if (queryKey.length < 3) {
		return null;
	}
	return { queryKey, query };
}

function toKeepBusyCandidateView(candidate: KeepBusyCandidate): KeepBusyCandidateView {
	return {
		queryKey: candidate.queryKey,
		query: candidate.query,
		rawTitle: candidate.rawTitle,
		sourceId: candidate.sourceId,
		sourceLabel: candidate.sourceLabel,
		sourceUrl: candidate.sourceUrl,
		sourceWeight: candidate.sourceWeight,
		firstSeenAt: candidate.firstSeenAt.toISOString(),
		lastSeenAt: candidate.lastSeenAt.toISOString(),
		seenCount: candidate.seenCount,
		dispatchCount: candidate.dispatchCount,
		successCount: candidate.successCount,
		zeroResultCount: candidate.zeroResultCount,
		lastResultCount: candidate.lastResultCount,
		lastDispatchedAt: toIso(candidate.lastDispatchedAt),
		lastCompletedAt: toIso(candidate.lastCompletedAt),
		cooldownUntil: toIso(candidate.cooldownUntil),
		lastError: candidate.lastError
	};
}

export async function upsertKeepBusyCandidates(
	inputs: KeepBusyCandidateInput[]
): Promise<KeepBusyCandidateView[]> {
	const db = getDb();
	const accepted = inputs
		.map((input) => {
			const normalized = normalizeKeepBusyQuery(input.query);
			if (!normalized) {
				return null;
			}
			return {
				queryKey: normalized.queryKey,
				query: normalized.query,
				rawTitle: input.rawTitle.trim() || normalized.query,
				sourceId: input.sourceId,
				sourceLabel: input.sourceLabel,
				sourceUrl: input.sourceUrl,
				sourceWeight: Math.max(1, Math.floor(input.sourceWeight)),
				seenAt: input.seenAt ?? new Date()
			};
		})
		.filter((value): value is NonNullable<typeof value> => value !== null);

	const candidates = await Promise.all(
		accepted.map(({ queryKey, query, rawTitle, sourceId, sourceLabel, sourceUrl, sourceWeight, seenAt }) =>
			db.keepBusyCandidate.upsert({
				where: {
					queryKey
				},
				create: {
					queryKey,
					query,
					rawTitle,
					sourceId,
					sourceLabel,
					sourceUrl,
					sourceWeight,
					firstSeenAt: seenAt,
					lastSeenAt: seenAt
				},
				update: {
					query,
					rawTitle,
					sourceId,
					sourceLabel,
					sourceUrl,
					sourceWeight: Math.max(sourceWeight, 1),
					lastSeenAt: seenAt,
					seenCount: {
						increment: 1
					}
				}
			})
		)
	);

	return candidates.map(toKeepBusyCandidateView);
}

export async function listRecentKeepBusyCandidates(limit = 12): Promise<KeepBusyCandidateView[]> {
	const db = getDb();
	const candidates = await db.keepBusyCandidate.findMany({
		orderBy: [{ lastSeenAt: 'desc' }, { sourceWeight: 'desc' }],
		take: limit
	});
	return candidates.map(toKeepBusyCandidateView);
}

export async function listDispatchableKeepBusyCandidates(
	now = new Date(),
	limit = 40
): Promise<KeepBusyCandidateView[]> {
	const db = getDb();
	const candidates = await db.keepBusyCandidate.findMany({
		where: {
			OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }]
		},
		orderBy: [{ sourceWeight: 'desc' }, { lastSeenAt: 'desc' }],
		take: limit
	});
	return candidates.map(toKeepBusyCandidateView);
}

export async function recordKeepBusyDispatch(
	queryKey: string,
	cooldownSecs: number,
	dispatchedAt = new Date()
): Promise<void> {
	const db = getDb();
	await db.keepBusyCandidate.update({
		where: {
			queryKey
		},
		data: {
			dispatchCount: {
				increment: 1
			},
			lastDispatchedAt: dispatchedAt,
			cooldownUntil: new Date(dispatchedAt.getTime() + cooldownSecs * 1000),
			lastError: null
		}
	});
}

export async function recordKeepBusyOutcome(
	queryKey: string,
	resultCount: number,
	error: string | null,
	completedAt = new Date()
): Promise<void> {
	const db = getDb();
	await db.keepBusyCandidate.update({
		where: {
			queryKey
		},
		data: {
			lastCompletedAt: completedAt,
			lastResultCount: Math.max(0, Math.floor(resultCount)),
			successCount: resultCount > 0 ? { increment: 1 } : undefined,
			zeroResultCount: resultCount > 0 ? undefined : { increment: 1 },
			lastError: error
		}
	});
}

export async function pruneExpiredKeepBusyCandidates(
	ttlSecs: number,
	now = new Date()
): Promise<void> {
	const db = getDb();
	const cutoff = new Date(now.getTime() - ttlSecs * 1000);
	await db.keepBusyCandidate.deleteMany({
		where: {
			lastSeenAt: {
				lt: cutoff
			}
		}
	});
}
