import { json, type RequestHandler } from '@sveltejs/kit';

import { storeHarvestReplay } from '$lib/server/search-store';
import type { HarvestReplayRecord } from '$lib/shared/internal-api';

export const POST: RequestHandler = async ({ request }) => {
	const payload = (await request.json()) as Partial<HarvestReplayRecord>;
	if (
		typeof payload.replay_id !== 'string' ||
		typeof payload.indexer_id !== 'string' ||
		typeof payload.family !== 'string' ||
		typeof payload.logical_key !== 'string' ||
		typeof payload.target !== 'string' ||
		typeof payload.started_at !== 'string' ||
		typeof payload.completed_at !== 'string' ||
		typeof payload.result_count !== 'number' ||
		typeof payload.batch_count !== 'number'
	) {
		return json({ error: 'invalid harvest replay payload' }, { status: 400 });
	}

	await storeHarvestReplay(payload as HarvestReplayRecord);
	return json({ accepted: true }, { status: 202 });
};
