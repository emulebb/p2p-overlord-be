import { randomUUID } from 'node:crypto';

import { createSearchJob, getSearchJob, markSearchDispatchFailed, markSearchDispatchSent } from '$lib/server/search-store';
import type { IndexerRegistration } from '$lib/shared/internal-api';
import type { SearchJob, SearchJobOrigin, SearchJobStatusView, SearchRequest } from '$lib/shared/internal-api';
import { refreshAllAgentInterfaces } from '$lib/server/agent-control';
import { getReadyIndexersByProtocol } from '$lib/server/state';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type DispatchSearchRequestOptions = {
	callbackOrigin: string;
	fetch: FetchLike;
	origin?: SearchJobOrigin;
	originKey?: string | null;
	targetIndexerIds?: string[];
};

function resolveTargetAgents(
	request: SearchRequest,
	targetIndexerIds: string[] | undefined
): IndexerRegistration[] {
	const routingProtocol = request.protocol === 'ed2k' ? 'kad2' : request.protocol;
	const readyAgents = getReadyIndexersByProtocol(routingProtocol);
	if (!targetIndexerIds || targetIndexerIds.length === 0) {
		return readyAgents;
	}

	const selected = new Set(targetIndexerIds);
	return readyAgents.filter((agent) => selected.has(agent.indexer_id));
}

/**
 * Sends one validated search request through the normal coordinator job pipeline.
 */
export async function dispatchSearchRequest(
	request: SearchRequest,
	options: DispatchSearchRequestOptions
): Promise<SearchJobStatusView> {
	await refreshAllAgentInterfaces();
	const agents = resolveTargetAgents(request, options.targetIndexerIds);
	if (agents.length === 0) {
		throw new Error(`no ready ${request.protocol} agents`);
	}

	const job: SearchJob = {
		job_id: randomUUID(),
		protocol: request.protocol,
		kind: request.kind,
		query: request.kind === 'keyword' ? request.query : null,
		file_hash: request.kind === 'keyword' ? null : request.file_hash,
		file_size: request.kind === 'keyword' ? null : request.file_size,
		origin: options.origin ?? 'user_api',
		origin_key: options.originKey ?? null,
		callback_url: options.callbackOrigin
	};
	await createSearchJob(job, agents.map((agent) => agent.indexer_id));

	for (const agent of agents) {
		try {
			const response = await options.fetch(`${agent.url}/api/internal/search`, {
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

	const view = await getSearchJob(job.job_id);
	if (!view) {
		throw new Error(`search job ${job.job_id} was not persisted`);
	}
	return view;
}
