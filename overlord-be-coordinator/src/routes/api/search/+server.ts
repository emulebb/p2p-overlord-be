import { json, type RequestHandler } from '@sveltejs/kit';

import { dispatchSearchRequest } from '$lib/server/search-dispatch';
import type { SearchRequest } from '$lib/shared/internal-api';

export const POST: RequestHandler = async ({ request, url, fetch }) => {
	const payload = (await request.json()) as Partial<SearchRequest>;
	const hashPayload = payload as Partial<Extract<SearchRequest, { kind: 'source' | 'notes' }>>;
	if (payload.protocol !== 'kad2' && payload.protocol !== 'ed2k') {
		return json({ error: 'expected protocol "kad2" or "ed2k"' }, { status: 400 });
	}
	if (payload.kind !== 'keyword' && payload.kind !== 'source' && payload.kind !== 'notes') {
		return json({ error: 'expected kind "keyword", "source", or "notes"' }, { status: 400 });
	}
	if (payload.protocol === 'ed2k' && payload.kind !== 'keyword') {
		return json({ error: 'ed2k only supports keyword search jobs' }, { status: 400 });
	}

	const query: string | null = payload.kind === 'keyword' ? payload.query?.trim() ?? null : null;
	const fileHash =
		payload.kind === 'keyword'
			? null
			: hashPayload.file_hash?.kind === 'ed2k' && typeof hashPayload.file_hash.value === 'string'
				? hashPayload.file_hash
				: null;
	const fileSize =
		payload.kind === 'keyword'
			? null
			: typeof hashPayload.file_size === 'number' &&
					Number.isFinite(hashPayload.file_size) &&
					hashPayload.file_size > 0
				? Math.floor(hashPayload.file_size)
				: null;

	if (payload.kind === 'keyword' && !query) {
		return json(
			{ error: 'expected { protocol: "kad2" | "ed2k", kind: "keyword", query }' },
			{ status: 400 }
		);
	}
	if (payload.kind !== 'keyword' && (fileHash === null || fileSize === null)) {
		return json(
			{ error: 'expected { protocol: "kad2", kind: "source" | "notes", file_hash, file_size }' },
			{ status: 400 }
		);
	}

	try {
		const job = await dispatchSearchRequest(
			{
				protocol: payload.protocol,
				kind: payload.kind,
				query,
				file_hash: fileHash,
				file_size: fileSize
			} as SearchRequest,
			{
				callbackOrigin: url.origin,
				fetch
			}
		);
		return json(job, { status: 202 });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : String(error) },
			{ status: 503 }
		);
	}
};
