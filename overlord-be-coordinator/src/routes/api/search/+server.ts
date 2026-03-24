import { json, type RequestHandler } from '@sveltejs/kit';

import { createSearchJob, getSearchJob, markSearchDispatchFailed, markSearchDispatchSent } from '$lib/server/search-store';
import type { SearchJob, SearchRequest } from '$lib/shared/internal-api';
import { refreshAllAgentInterfaces } from '$lib/server/agent-control';
import { getReadyIndexersByProtocol } from '$lib/server/state';

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

	await refreshAllAgentInterfaces();
	const agents =
		payload.protocol === 'ed2k'
			? getReadyIndexersByProtocol('kad2')
			: getReadyIndexersByProtocol(payload.protocol);
	if (agents.length === 0) {
		return json({ error: `no ready ${payload.protocol} agents` }, { status: 503 });
	}

	const job: SearchJob = {
		job_id: crypto.randomUUID(),
		protocol: payload.protocol,
		kind: payload.kind,
		query,
		file_hash: fileHash,
		file_size: fileSize,
		callback_url: url.origin
	};
	await createSearchJob(job, agents.map((agent) => agent.indexer_id));

	for (const agent of agents) {
		try {
			const response = await fetch(`${agent.url}/api/internal/search`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(job)
			});
			if (response.ok) {
				await markSearchDispatchSent(job.job_id, agent.indexer_id);
				continue;
			}
			await markSearchDispatchFailed(
				job.job_id,
				agent.indexer_id,
				`agent search dispatch failed with ${response.status}`
			);
		} catch (error) {
			await markSearchDispatchFailed(
				job.job_id,
				agent.indexer_id,
				error instanceof Error ? error.message : String(error)
			);
		}
	}

	return json(await getSearchJob(job.job_id), { status: 202 });
};
