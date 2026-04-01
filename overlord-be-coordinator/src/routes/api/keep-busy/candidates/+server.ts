import { json, type RequestHandler } from '@sveltejs/kit';

import { listRecentKeepBusyCandidates, upsertKeepBusyCandidates } from '$lib/server/keep-busy-store';

export const GET: RequestHandler = async () => {
	return json(await listRecentKeepBusyCandidates(20));
};

export const POST: RequestHandler = async ({ request }) => {
	const payload = (await request.json()) as { query?: string; weight?: number };
	const query = payload.query?.trim() ?? '';
	if (!query) {
		return json({ error: 'expected { query }' }, { status: 400 });
	}

	const [candidate] = await upsertKeepBusyCandidates([
		{
			query,
			rawTitle: query,
			sourceId: 'keep_busy_ui_manual',
			sourceLabel: 'Keep-busy UI',
			sourceUrl: '/api/keep-busy/candidates',
			sourceWeight:
				typeof payload.weight === 'number' && Number.isFinite(payload.weight)
					? Math.max(1, Math.floor(payload.weight))
					: 5
		}
	]);

	return json(candidate, { status: 202 });
};
