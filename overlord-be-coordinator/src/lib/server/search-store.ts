import { Prisma, type SearchDispatch as PrismaSearchDispatch } from '@prisma/client';

import { getDb, getPgPool } from '$lib/server/db';
import { publishSearchStream } from '$lib/server/search-events';
import type {
	FileRecord,
	HarvestReplayContext,
	HarvestReplayRecord,
	HashType,
	IndexedFileListResponse,
	IndexedFileSort,
	IndexedFileView,
	ResultBatch,
	SearchDispatchStatus,
	SearchDispatchView,
	SearchEvent,
	SearchJob,
	SearchJobStatus,
	SearchJobStatusView
} from '$lib/shared/internal-api';

const FILE_INCLUDE = {
	hashes: {
		orderBy: [{ hashType: 'asc' }, { hashValue: 'asc' }]
	},
	names: {
		orderBy: [{ firstSeen: 'asc' }, { id: 'asc' }]
	},
	tags: {
		orderBy: {
			id: 'asc'
		}
	},
	sources: {
		orderBy: [{ seenAt: 'desc' }, { id: 'desc' }]
	}
} satisfies Prisma.FileInclude;

const SEARCH_JOB_INCLUDE = {
	dispatches: {
		orderBy: {
			createdAt: 'asc'
		}
	},
	results: {
		include: {
			file: {
				include: FILE_INCLUDE
			}
		},
		orderBy: {
			firstSeen: 'asc'
		}
	}
} satisfies Prisma.SearchJobInclude;

type FileWithRelations = Prisma.FileGetPayload<{
	include: typeof FILE_INCLUDE;
}>;

type SearchJobWithRelations = Prisma.SearchJobGetPayload<{
	include: typeof SEARCH_JOB_INCLUDE;
}>;

type IndexedFileRow = {
	fileId: string;
	sourceCount: string;
	searchJobCount: string;
};

type IndexedFileCountRow = {
	count: string;
};

const DEFAULT_INDEXED_FILE_PAGE_SIZE = 25;
const MAX_INDEXED_FILE_PAGE_SIZE = 100;

function toIso(value: Date | null): string | null {
	return value ? value.toISOString() : null;
}

function bigintToNumber(value: bigint | null): number | null {
	return value === null ? null : Number(value);
}

function parseHash(value: Prisma.JsonValue | null): HashType | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}
	const record = value as Record<string, unknown>;
	if (record.kind === 'ed2k' && typeof record.value === 'string') {
		return {
			kind: 'ed2k',
			value: record.value
		};
	}
	return null;
}

function serializeHash(value: HashType | null): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
	return value ? (value as Prisma.InputJsonValue) : Prisma.DbNull;
}

function dedupeTags(tags: FileWithRelations['tags']): FileRecord['tags'] {
	const seen = new Map<string, FileRecord['tags'][number]>();
	for (const tag of tags) {
		seen.set(`${tag.key}:${JSON.stringify(tag.value)}`, {
			key: tag.key,
			value: tag.value as unknown
		});
	}
	return Array.from(seen.values());
}

function dedupeSources(sources: FileWithRelations['sources']): FileRecord['sources'] {
	const seen = new Map<string, FileRecord['sources'][number]>();
	for (const source of sources) {
		seen.set(`${source.protocol}:${source.address}:${JSON.stringify(source.extra)}`, {
			protocol: source.protocol === 'ed2k' ? 'ed2k' : 'kad2',
			address: source.address,
			extra: source.extra as unknown
		});
	}
	return Array.from(seen.values());
}

function toFileRecord(file: FileWithRelations): FileRecord {
	return {
		hashes: file.hashes
			.map((hash) =>
				hash.hashType === 'ed2k'
					? {
							kind: 'ed2k' as const,
							value: hash.hashValue
						}
					: null
			)
			.filter((value): value is HashType => value !== null),
		names: Array.from(new Set(file.names.map((name) => name.name))),
		size: bigintToNumber(file.size),
		content_type: null,
		tags: dedupeTags(file.tags),
		sources: dedupeSources(file.sources)
	};
}

function primaryFileName(file: FileWithRelations): string {
	return file.names[0]?.name ?? file.hashes[0]?.hashValue ?? 'unnamed file';
}

function toIndexedFileView(
	file: FileWithRelations,
	metrics: { sourceCount: string; searchJobCount: string }
): IndexedFileView {
	return {
		file_id: Number(file.id),
		primary_name: primaryFileName(file),
		first_seen: file.firstSeen.toISOString(),
		last_seen: file.lastSeen.toISOString(),
		source_count: Number(metrics.sourceCount),
		search_job_count: Number(metrics.searchJobCount),
		...toFileRecord(file)
	};
}

function buildIndexedFileOrder(sort: IndexedFileSort, hasQuery: boolean): string {
	if (hasQuery) {
		switch (sort) {
			case 'first_seen_desc':
				return 'ORDER BY score DESC NULLS LAST, "firstSeen" DESC, "fileId" DESC';
			case 'name_asc':
				return 'ORDER BY score DESC NULLS LAST, "primaryName" ASC, "fileId" ASC';
			case 'sources_desc':
				return 'ORDER BY score DESC NULLS LAST, "sourceCount" DESC, "lastSeen" DESC, "fileId" DESC';
			case 'searches_desc':
				return 'ORDER BY score DESC NULLS LAST, "searchJobCount" DESC, "lastSeen" DESC, "fileId" DESC';
			case 'size_desc':
				return 'ORDER BY score DESC NULLS LAST, size DESC NULLS LAST, "fileId" DESC';
			case 'last_seen_desc':
			default:
				return 'ORDER BY score DESC NULLS LAST, "lastSeen" DESC, "fileId" DESC';
		}
	}

	switch (sort) {
		case 'first_seen_desc':
			return 'ORDER BY "firstSeen" DESC, "fileId" DESC';
		case 'name_asc':
			return 'ORDER BY "primaryName" ASC, "fileId" ASC';
		case 'sources_desc':
			return 'ORDER BY "sourceCount" DESC, "lastSeen" DESC, "fileId" DESC';
		case 'searches_desc':
			return 'ORDER BY "searchJobCount" DESC, "lastSeen" DESC, "fileId" DESC';
		case 'size_desc':
			return 'ORDER BY size DESC NULLS LAST, "fileId" DESC';
		case 'last_seen_desc':
		default:
			return 'ORDER BY "lastSeen" DESC, "fileId" DESC';
	}
}

/**
 * Normalizes browse query parameters before they reach the indexed-file listing query.
 */
export function normalizeIndexedFileListParams(input: {
	page?: number;
	pageSize?: number;
	query?: string;
	sort?: string;
}): {
	page: number;
	pageSize: number;
	query: string;
	sort: IndexedFileSort;
} {
	const page =
		typeof input.page === 'number' && Number.isFinite(input.page) && input.page > 0
			? Math.floor(input.page)
			: 1;
	const requestedPageSize =
		typeof input.pageSize === 'number' && Number.isFinite(input.pageSize) && input.pageSize > 0
			? Math.floor(input.pageSize)
			: DEFAULT_INDEXED_FILE_PAGE_SIZE;
	const sort: IndexedFileSort =
		input.sort === 'first_seen_desc' ||
		input.sort === 'name_asc' ||
		input.sort === 'sources_desc' ||
		input.sort === 'searches_desc' ||
		input.sort === 'size_desc' ||
		input.sort === 'last_seen_desc'
			? input.sort
			: 'last_seen_desc';

	return {
		page,
		pageSize: Math.min(requestedPageSize, MAX_INDEXED_FILE_PAGE_SIZE),
		query: input.query?.trim() ?? '',
		sort
	};
}

function toDispatchView(dispatch: PrismaSearchDispatch): SearchDispatchView {
	return {
		indexer_id: dispatch.indexerId,
		status: dispatch.status as SearchDispatchStatus,
		result_count: dispatch.resultCount,
		batch_count: dispatch.batchCount,
		created_at: dispatch.createdAt.toISOString(),
		started_at: toIso(dispatch.startedAt),
		finished_at: toIso(dispatch.finishedAt),
		last_error: dispatch.lastError
	};
}

function toJobView(job: SearchJobWithRelations): SearchJobStatusView {
	return {
		job_id: job.id,
		protocol: job.protocol as SearchJobStatusView['protocol'],
		kind: job.kind as SearchJobStatusView['kind'],
		query: job.query,
		file_hash: parseHash(job.fileHash),
		file_size: bigintToNumber(job.fileSize),
		status: job.status as SearchJobStatus,
		created_at: job.createdAt.toISOString(),
		started_at: toIso(job.startedAt),
		finished_at: toIso(job.finishedAt),
		cancel_requested_at: toIso(job.cancelRequestedAt),
		result_count: job.resultCount,
		dispatched_to: job.dispatches.map((dispatch) => dispatch.indexerId),
		last_error: job.lastError,
		dispatches: job.dispatches.map(toDispatchView),
		results: job.results.map((result) => toFileRecord(result.file))
	};
}

function terminalDispatch(status: string): boolean {
	return ['dispatch_failed', 'completed', 'failed', 'cancelled'].includes(status);
}

async function refreshJobStatus(
	tx: Prisma.TransactionClient,
	jobId: string
): Promise<SearchJobWithRelations> {
	const job = await tx.searchJob.findUniqueOrThrow({
		where: { id: jobId },
		include: SEARCH_JOB_INCLUDE
	});
	const statuses = job.dispatches.map((dispatch) => dispatch.status);
	const allQueued = statuses.length > 0 && statuses.every((status) => status === 'queued');
	const anyRunning = statuses.some((status) => ['dispatched', 'active', 'queued'].includes(status));
	const allTerminal = statuses.length > 0 && statuses.every(terminalDispatch);
	const completedCount = statuses.filter((status) => status === 'completed').length;
	const failedCount = statuses.filter((status) => ['failed', 'dispatch_failed'].includes(status)).length;
	const cancelledCount = statuses.filter((status) => status === 'cancelled').length;
	const startedAt =
		job.dispatches
			.map((dispatch) => dispatch.startedAt)
			.filter((value): value is Date => value !== null)
			.sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
	const finishedAt = allTerminal
		? job.dispatches
				.map((dispatch) => dispatch.finishedAt)
				.filter((value): value is Date => value !== null)
				.sort((left, right) => right.getTime() - left.getTime())[0] ?? null
		: null;
	const resultCount = await tx.searchResult.count({
		where: {
			jobId
		}
	});

	let status: SearchJobStatus;
	if (allQueued) {
		status = 'queued';
	} else if (job.cancelRequestedAt && anyRunning) {
		status = 'cancelling';
	} else if (anyRunning) {
		status = 'active';
	} else if (job.cancelRequestedAt) {
		status =
			completedCount === 0 && failedCount === 0 && cancelledCount > 0
				? 'cancelled'
				: 'completed_with_errors';
	} else if (completedCount === job.dispatches.length && job.dispatches.length > 0) {
		status = 'completed';
	} else if (failedCount === job.dispatches.length && job.dispatches.length > 0) {
		status = 'failed';
	} else if (allTerminal) {
		status = 'completed_with_errors';
	} else {
		status = 'queued';
	}

	await tx.searchJob.update({
		where: { id: jobId },
		data: {
			status,
			startedAt,
			finishedAt,
			resultCount,
			lastError:
				job.dispatches.find((dispatch) => dispatch.lastError)?.lastError ?? job.lastError ?? null
		}
	});

	return tx.searchJob.findUniqueOrThrow({
		where: { id: jobId },
		include: SEARCH_JOB_INCLUDE
	});
}

async function upsertFile(
	tx: Prisma.TransactionClient,
	record: FileRecord
): Promise<bigint | null> {
	const primaryHash = record.hashes.find((hash) => hash.kind === 'ed2k');
	if (!primaryHash) {
		return null;
	}

	const existingHash = await tx.fileHash.findUnique({
		where: {
			hashType_hashValue: {
				hashType: primaryHash.kind,
				hashValue: primaryHash.value
			}
		}
	});

	let fileId = existingHash?.fileId ?? null;
	if (fileId === null) {
		const created = await tx.file.create({
			data: {
				size: record.size === null ? null : BigInt(record.size),
				hashes: {
					create: record.hashes.map((hash) => ({
						hashType: hash.kind,
						hashValue: hash.value
					}))
				}
			}
		});
		fileId = created.id;
	} else {
		await tx.file.update({
			where: { id: fileId },
			data: {
				lastSeen: new Date(),
				size: record.size === null ? undefined : BigInt(record.size)
			}
		});
		await tx.fileHash.createMany({
			data: record.hashes.map((hash) => ({
				hashType: hash.kind,
				hashValue: hash.value,
				fileId: fileId as bigint
			})),
			skipDuplicates: true
		});
	}

	if (fileId === null) {
		return null;
	}
	const resolvedFileId = fileId;

	if (record.names.length > 0) {
		await tx.fileName.createMany({
			data: record.names.map((name) => ({
				fileId: resolvedFileId,
				name
			})),
			skipDuplicates: true
		});
	}

	for (const tag of record.tags) {
		await tx.fileTag.create({
			data: {
				fileId: resolvedFileId,
				key: tag.key,
				value: tag.value as Prisma.InputJsonValue
			}
		});
	}

	for (const source of record.sources) {
		await tx.source.create({
			data: {
				fileId: resolvedFileId,
				protocol: source.protocol,
				address: source.address,
				extra: source.extra as Prisma.InputJsonValue
			}
		});
	}

	return fileId;
}

async function ensureHarvestReplay(
	tx: Prisma.TransactionClient,
	indexerId: string,
	context: HarvestReplayContext
): Promise<void> {
	const placeholderTimestamp = new Date();
	await tx.harvestReplay.upsert({
		where: {
			id: context.replay_id
		},
		create: {
			id: context.replay_id,
			indexerId,
			family: context.family,
			logicalKey: context.logical_key,
			target: context.target,
			startPosition: context.start_position,
			size: context.size === null ? null : BigInt(context.size),
			restrictivePayloadHex: context.restrictive_payload_hex,
			startedAt: placeholderTimestamp,
			completedAt: placeholderTimestamp,
			resultCount: 0,
			batchCount: 0,
			error: null
		},
		update: {
			indexerId,
			family: context.family,
			logicalKey: context.logical_key,
			target: context.target,
			startPosition: context.start_position,
			size: context.size === null ? null : BigInt(context.size),
			restrictivePayloadHex: context.restrictive_payload_hex
		}
	});
}

export async function storeHarvestReplay(record: HarvestReplayRecord): Promise<void> {
	const db = getDb();
	await db.harvestReplay.upsert({
		where: {
			id: record.replay_id
		},
		create: {
			id: record.replay_id,
			indexerId: record.indexer_id,
			family: record.family,
			logicalKey: record.logical_key,
			target: record.target,
			startPosition: record.start_position,
			size: record.size === null ? null : BigInt(record.size),
			restrictivePayloadHex: record.restrictive_payload_hex,
			startedAt: new Date(record.started_at),
			completedAt: new Date(record.completed_at),
			resultCount: record.result_count,
			batchCount: record.batch_count,
			error: record.error
		},
		update: {
			indexerId: record.indexer_id,
			family: record.family,
			logicalKey: record.logical_key,
			target: record.target,
			startPosition: record.start_position,
			size: record.size === null ? null : BigInt(record.size),
			restrictivePayloadHex: record.restrictive_payload_hex,
			startedAt: new Date(record.started_at),
			completedAt: new Date(record.completed_at),
			resultCount: record.result_count,
			batchCount: record.batch_count,
			error: record.error
		}
	});
}

export async function createSearchJob(job: SearchJob, indexerIds: string[]): Promise<void> {
	const db = getDb();
	await db.searchJob.create({
		data: {
			id: job.job_id,
			protocol: job.protocol,
			kind: job.kind,
			query: job.query,
			fileHash: serializeHash(job.file_hash),
			fileSize: job.file_size === null ? null : BigInt(job.file_size),
			status: 'queued',
			dispatches: {
				create: indexerIds.map((indexerId) => ({
					indexerId,
					status: 'queued'
				}))
			}
		}
	});
}

export async function markSearchDispatchSent(jobId: string, indexerId: string): Promise<void> {
	const db = getDb();
	await db.$transaction(async (tx) => {
		await tx.searchDispatch.update({
			where: {
				jobId_indexerId: {
					jobId,
					indexerId
				}
			},
			data: {
				status: 'dispatched'
			}
		});
		await refreshJobStatus(tx, jobId);
	});
}

export async function markSearchDispatchFailed(
	jobId: string,
	indexerId: string,
	error: string
): Promise<void> {
	const db = getDb();
	const snapshot = await db.$transaction(async (tx) => {
		await tx.searchDispatch.update({
			where: {
				jobId_indexerId: {
					jobId,
					indexerId
				}
			},
			data: {
				status: 'dispatch_failed',
				finishedAt: new Date(),
				lastError: error
			}
		});
		return refreshJobStatus(tx, jobId);
	});
	publishSearchStream(jobId, { event: 'job', data: toJobView(snapshot) });
}

export async function ingestResultBatch(batch: ResultBatch): Promise<void> {
	const db = getDb();
	const jobId = batch.job_id;
	const harvestContext = batch.harvest_context ?? null;
	const snapshot = await db.$transaction(async (tx) => {
		if (harvestContext) {
			await ensureHarvestReplay(tx, batch.indexer_id, harvestContext);
		}

		for (const file of batch.files) {
			const fileId = await upsertFile(tx, file);
			if (fileId !== null && harvestContext) {
				await tx.harvestReplayFile.upsert({
					where: {
						replayId_fileId: {
							replayId: harvestContext.replay_id,
							fileId
						}
					},
					create: {
						replayId: harvestContext.replay_id,
						fileId
					},
					update: {}
				});
			}
			if (fileId === null || jobId === null) {
				continue;
			}

			await tx.searchResult.upsert({
				where: {
					jobId_fileId: {
						jobId,
						fileId
					}
				},
				create: {
					jobId,
					fileId
				},
				update: {
					seenCount: {
						increment: 1
					},
					lastSeen: new Date()
				}
			});
		}

		if (jobId === null) {
			return null;
		}

		await tx.searchDispatch.update({
			where: {
				jobId_indexerId: {
					jobId,
					indexerId: batch.indexer_id
				}
			},
			data: {
				status: 'active',
				resultCount: {
					increment: batch.files.length
				},
				batchCount: {
					increment: 1
				},
				startedAt: new Date()
			}
		});

		return refreshJobStatus(tx, jobId);
	});

	if (jobId && snapshot) {
		for (const file of batch.files) {
			publishSearchStream(jobId, { event: 'file', data: file });
		}
		publishSearchStream(jobId, { event: 'job', data: toJobView(snapshot) });
	}
}

export async function applySearchEvent(event: SearchEvent): Promise<SearchJobStatusView> {
	const db = getDb();
	const snapshot = await db.$transaction(async (tx) => {
		const data: Prisma.SearchDispatchUpdateInput = {};
		if (event.status === 'started') {
			data.status = 'active';
			data.startedAt = new Date();
			data.lastError = null;
		} else if (event.status === 'batch_received') {
			data.status = 'active';
			data.startedAt = new Date();
		} else if (event.status === 'completed') {
			data.status = 'completed';
			data.finishedAt = new Date();
			data.lastError = null;
		} else if (event.status === 'failed') {
			data.status = 'failed';
			data.finishedAt = new Date();
			data.lastError = event.error ?? 'search failed';
		} else if (event.status === 'cancelled') {
			data.status = 'cancelled';
			data.finishedAt = new Date();
		}

		if (event.result_count !== null) {
			data.resultCount = event.result_count;
		}
		if (event.batch_count !== null) {
			data.batchCount = event.batch_count;
		}

		await tx.searchDispatch.update({
			where: {
				jobId_indexerId: {
					jobId: event.job_id,
					indexerId: event.indexer_id
				}
			},
			data
		});

		return refreshJobStatus(tx, event.job_id);
	});

	const view = toJobView(snapshot);
	publishSearchStream(event.job_id, { event: 'job', data: view });
	return view;
}

export async function cancelSearchJob(jobId: string): Promise<SearchJobStatusView> {
	const db = getDb();
	const snapshot = await db.$transaction(async (tx) => {
		await tx.searchJob.update({
			where: { id: jobId },
			data: {
				cancelRequestedAt: new Date(),
				status: 'cancelling'
			}
		});
		return refreshJobStatus(tx, jobId);
	});
	const view = toJobView(snapshot);
	publishSearchStream(jobId, { event: 'job', data: view });
	return view;
}

export async function getSearchJob(jobId: string): Promise<SearchJobStatusView | null> {
	const db = getDb();
	const job = await db.searchJob.findUnique({
		where: { id: jobId },
		include: SEARCH_JOB_INCLUDE
	});
	return job ? toJobView(job) : null;
}

export async function listRecentSearchJobs(limit = 10): Promise<SearchJobStatusView[]> {
	const db = getDb();
	const jobs = await db.searchJob.findMany({
		orderBy: {
			createdAt: 'desc'
		},
		take: limit,
		include: SEARCH_JOB_INCLUDE
	});
	return jobs.map(toJobView);
}

/**
 * Lists indexed files from the coordinator database with optional PostgreSQL full-text search.
 */
export async function listIndexedFiles(input: {
	page?: number;
	pageSize?: number;
	query?: string;
	sort?: IndexedFileSort;
}): Promise<IndexedFileListResponse> {
	const db = getDb();
	const pgPool = getPgPool();
	const params = normalizeIndexedFileListParams(input);
	const offset = (params.page - 1) * params.pageSize;
	const hasQuery = params.query.length > 0;
	const orderBy = buildIndexedFileOrder(params.sort, hasQuery);

	// Keep the browse API file-centric even when several names for the same file match the query.
	const countResult = hasQuery
		? await pgPool.query<IndexedFileCountRow>(
				`
				SELECT COUNT(*)::bigint AS count
				FROM "File" f
				WHERE EXISTS (
					SELECT 1
					FROM "FileName" fn
					WHERE fn."fileId" = f.id
						AND fn."nameTsv" @@ websearch_to_tsquery('english', $1)
				)
			`,
				[params.query]
			)
		: await pgPool.query<IndexedFileCountRow>(
				`
				SELECT COUNT(*)::bigint AS count
				FROM "File"
			`
			);

	const fileResult = hasQuery
		? await pgPool.query<IndexedFileRow>(
				`
				WITH source_counts AS (
					SELECT deduped."fileId", COUNT(*)::bigint AS "sourceCount"
					FROM (
						SELECT DISTINCT s."fileId", s."protocol", s."address", s."extra"
						FROM "Source" s
					) deduped
					GROUP BY deduped."fileId"
				),
				search_counts AS (
					SELECT sr."fileId", COUNT(DISTINCT sr."jobId")::bigint AS "searchJobCount"
					FROM "SearchResult" sr
					GROUP BY sr."fileId"
				),
				ranked_files AS (
					SELECT
						f.id AS "fileId",
						COALESCE(primary_name.name, '') AS "primaryName",
						COALESCE(source_counts."sourceCount", 0::bigint) AS "sourceCount",
						COALESCE(search_counts."searchJobCount", 0::bigint) AS "searchJobCount",
						f.size AS size,
						f."firstSeen" AS "firstSeen",
						f."lastSeen" AS "lastSeen",
						MAX(ts_rank(fn."nameTsv", websearch_to_tsquery('english', $1))) AS score
					FROM "File" f
					JOIN "FileName" fn
						ON fn."fileId" = f.id
						AND fn."nameTsv" @@ websearch_to_tsquery('english', $1)
					LEFT JOIN LATERAL (
						SELECT fn_primary."name" AS name
						FROM "FileName" fn_primary
						WHERE fn_primary."fileId" = f.id
						ORDER BY fn_primary."firstSeen" ASC, fn_primary.id ASC
						LIMIT 1
					) primary_name ON TRUE
					LEFT JOIN source_counts
						ON source_counts."fileId" = f.id
					LEFT JOIN search_counts
						ON search_counts."fileId" = f.id
					GROUP BY
						f.id,
						primary_name.name,
						source_counts."sourceCount",
						search_counts."searchJobCount",
						f.size,
						f."firstSeen",
						f."lastSeen"
					${orderBy}
					LIMIT $2
					OFFSET $3
				)
				SELECT "fileId", "sourceCount", "searchJobCount"
				FROM ranked_files
			`,
				[params.query, params.pageSize, offset]
			)
		: await pgPool.query<IndexedFileRow>(
				`
				WITH source_counts AS (
					SELECT deduped."fileId", COUNT(*)::bigint AS "sourceCount"
					FROM (
						SELECT DISTINCT s."fileId", s."protocol", s."address", s."extra"
						FROM "Source" s
					) deduped
					GROUP BY deduped."fileId"
				),
				search_counts AS (
					SELECT sr."fileId", COUNT(DISTINCT sr."jobId")::bigint AS "searchJobCount"
					FROM "SearchResult" sr
					GROUP BY sr."fileId"
				),
				listed_files AS (
					SELECT
						f.id AS "fileId",
						COALESCE(primary_name.name, '') AS "primaryName",
						COALESCE(source_counts."sourceCount", 0::bigint) AS "sourceCount",
						COALESCE(search_counts."searchJobCount", 0::bigint) AS "searchJobCount",
						f.size AS size,
						f."firstSeen" AS "firstSeen",
						f."lastSeen" AS "lastSeen"
					FROM "File" f
					LEFT JOIN LATERAL (
						SELECT fn_primary."name" AS name
						FROM "FileName" fn_primary
						WHERE fn_primary."fileId" = f.id
						ORDER BY fn_primary."firstSeen" ASC, fn_primary.id ASC
						LIMIT 1
					) primary_name ON TRUE
					LEFT JOIN source_counts
						ON source_counts."fileId" = f.id
					LEFT JOIN search_counts
						ON search_counts."fileId" = f.id
					${orderBy}
					LIMIT $1
					OFFSET $2
				)
				SELECT "fileId", "sourceCount", "searchJobCount"
				FROM listed_files
			`,
				[params.pageSize, offset]
			);

	const countRows = countResult.rows;
	const fileRows = fileResult.rows;

	const orderedIds = fileRows.map((row) => BigInt(row.fileId));
	if (orderedIds.length === 0) {
		return {
			items: [],
			page: params.page,
			page_size: params.pageSize,
			total: Number(countRows[0]?.count ?? 0n),
			total_pages: Math.ceil(Number(countRows[0]?.count ?? 0n) / params.pageSize),
			query: params.query,
			sort: params.sort
		};
	}

	const files = await db.file.findMany({
		where: {
			id: {
				in: orderedIds
			}
		},
		include: FILE_INCLUDE
	});
	const filesById = new Map(files.map((file) => [file.id.toString(), file]));
	const metricsById = new Map(
		fileRows.map((row) => [
			row.fileId,
			{
				sourceCount: row.sourceCount,
				searchJobCount: row.searchJobCount
			}
		])
	);

	return {
		items: orderedIds
			.map((fileId) => {
				const key = fileId.toString();
				const file = filesById.get(key);
				const metrics = metricsById.get(key);
				return file && metrics ? toIndexedFileView(file, metrics) : null;
			})
			.filter((file): file is IndexedFileView => file !== null),
		page: params.page,
		page_size: params.pageSize,
		total: Number(countRows[0]?.count ?? 0n),
		total_pages: Math.ceil(Number(countRows[0]?.count ?? 0n) / params.pageSize),
		query: params.query,
		sort: params.sort
	};
}

export async function getSearchCounters() {
	const db = getDb();
	const [searchJobs, fileCount, resultCount] = await Promise.all([
		db.searchJob.count(),
		db.file.count(),
		db.searchResult.count()
	]);
	return {
		search_jobs: searchJobs,
		file_count: fileCount,
		search_results: resultCount
	};
}
