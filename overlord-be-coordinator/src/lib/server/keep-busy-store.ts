import { getDb } from '$lib/server/db';
import type { HashType, KeepBusyCandidateView, SearchKind } from '$lib/shared/internal-api';

type KeepBusyCandidateSource = {
	rawTitle: string;
	sourceId: string;
	sourceLabel: string;
	sourceUrl: string;
	sourceWeight: number;
	seenAt?: Date;
};

export type KeywordKeepBusyCandidateInput = KeepBusyCandidateSource & {
	kind?: 'keyword';
	query: string;
};

export type HashKeepBusyCandidateInput = KeepBusyCandidateSource & {
	kind: 'source' | 'notes';
	queryKey: string;
	fileHash: HashType;
	fileSize: number;
};

export type KeepBusyCandidateInput = KeywordKeepBusyCandidateInput | HashKeepBusyCandidateInput;

type AcceptedKeepBusyCandidate = {
	kind: SearchKind;
	queryKey: string;
	query: string | null;
	fileHashType: string | null;
	fileHashValue: string | null;
	fileSize: bigint | null;
	rawTitle: string;
	sourceId: string;
	sourceLabel: string;
	sourceUrl: string;
	sourceWeight: number;
	seenAt: Date;
};

type PersistedKeepBusyCandidate = {
	kind: string;
	queryKey: string;
	query: string | null;
	fileHashType: string | null;
	fileHashValue: string | null;
	fileSize: bigint | null;
	rawTitle: string;
	sourceId: string;
	sourceLabel: string;
	sourceUrl: string;
	sourceWeight: number;
	firstSeenAt: Date;
	lastSeenAt: Date;
	seenCount: number;
	dispatchCount: number;
	successCount: number;
	zeroResultCount: number;
	lastResultCount: number;
	lastDispatchedAt: Date | null;
	lastCompletedAt: Date | null;
	cooldownUntil: Date | null;
	lastError: string | null;
};

function toIso(value: Date | null): string | null {
	return value ? value.toISOString() : null;
}

function toNullableNumber(value: bigint | null): number | null {
	return value === null ? null : Number(value);
}

function toNullableHash(kind: string | null, value: string | null): HashType | null {
	return kind === 'ed2k' && typeof value === 'string' && value.length > 0
		? { kind: 'ed2k', value }
		: null;
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

function normalizeKeepBusyKey(input: string): string | null {
	const key = input.trim().toLowerCase();
	return key.length > 0 ? key : null;
}

function normalizeHashCandidate(input: HashKeepBusyCandidateInput): AcceptedKeepBusyCandidate | null {
	const queryKey = normalizeKeepBusyKey(input.queryKey);
	if (!queryKey || input.fileHash.kind !== 'ed2k' || input.fileHash.value.trim().length === 0) {
		return null;
	}
	if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
		return null;
	}

	return {
		kind: input.kind,
		queryKey,
		query: null,
		fileHashType: input.fileHash.kind,
		fileHashValue: input.fileHash.value.trim().toLowerCase(),
		fileSize: BigInt(Math.floor(input.fileSize)),
		rawTitle: input.rawTitle.trim() || `${input.kind} ${input.fileHash.value}`,
		sourceId: input.sourceId,
		sourceLabel: input.sourceLabel,
		sourceUrl: input.sourceUrl,
		sourceWeight: Math.max(1, Math.floor(input.sourceWeight)),
		seenAt: input.seenAt ?? new Date()
	};
}

function normalizeCandidate(input: KeepBusyCandidateInput): AcceptedKeepBusyCandidate | null {
	if (input.kind === 'source' || input.kind === 'notes') {
		return normalizeHashCandidate(input);
	}

	if (!('query' in input)) {
		return null;
	}
	const normalized = normalizeKeepBusyQuery(input.query);
	if (!normalized) {
		return null;
	}
	return {
		kind: 'keyword',
		queryKey: normalized.queryKey,
		query: normalized.query,
		fileHashType: null,
		fileHashValue: null,
		fileSize: null,
		rawTitle: input.rawTitle.trim() || normalized.query,
		sourceId: input.sourceId,
		sourceLabel: input.sourceLabel,
		sourceUrl: input.sourceUrl,
		sourceWeight: Math.max(1, Math.floor(input.sourceWeight)),
		seenAt: input.seenAt ?? new Date()
	};
}

function toKeepBusyCandidateView(candidate: PersistedKeepBusyCandidate): KeepBusyCandidateView {
	return {
		kind: candidate.kind as SearchKind,
		queryKey: candidate.queryKey,
		query: candidate.query,
		file_hash: toNullableHash(candidate.fileHashType, candidate.fileHashValue),
		file_size: toNullableNumber(candidate.fileSize),
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
		.map((input) => normalizeCandidate(input))
		.filter((value): value is AcceptedKeepBusyCandidate => value !== null);

	const candidates = await Promise.all(
		accepted.map(
			({
				kind,
				queryKey,
				query,
				fileHashType,
				fileHashValue,
				fileSize,
				rawTitle,
				sourceId,
				sourceLabel,
				sourceUrl,
				sourceWeight,
				seenAt
			}) =>
				db.keepBusyCandidate.upsert({
					where: {
						queryKey
					},
					create: {
						kind,
						queryKey,
						query,
						fileHashType,
						fileHashValue,
						fileSize,
						rawTitle,
						sourceId,
						sourceLabel,
						sourceUrl,
						sourceWeight,
						firstSeenAt: seenAt,
						lastSeenAt: seenAt
					},
					update: {
						kind,
						query,
						fileHashType,
						fileHashValue,
						fileSize,
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

	return candidates.map((candidate) =>
		toKeepBusyCandidateView(candidate as PersistedKeepBusyCandidate)
	);
}

export async function listRecentKeepBusyCandidates(limit = 12): Promise<KeepBusyCandidateView[]> {
	const db = getDb();
	const candidates = await db.keepBusyCandidate.findMany({
		orderBy: [{ lastSeenAt: 'desc' }, { sourceWeight: 'desc' }],
		take: limit
	});
	return candidates.map((candidate) =>
		toKeepBusyCandidateView(candidate as PersistedKeepBusyCandidate)
	);
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
	return candidates.map((candidate) =>
		toKeepBusyCandidateView(candidate as PersistedKeepBusyCandidate)
	);
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
