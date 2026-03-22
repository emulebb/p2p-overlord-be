import { json, type RequestHandler } from '@sveltejs/kit';

import type { SnoopEntry, SnoopObservation } from '$lib/shared/internal-api';
import { storeSnoopEntries } from '$lib/server/snoop-store';

export const POST: RequestHandler = async ({ request }) => {
	const payload = (await request.json()) as {
		indexer_id?: string;
		entries?: SnoopEntry[];
		observations?: SnoopObservation[];
	};
	if (
		!payload.indexer_id ||
		!Array.isArray(payload.entries) ||
		(payload.observations !== undefined && !Array.isArray(payload.observations))
	) {
		return json({ error: 'invalid snoop flush payload' }, { status: 400 });
	}

	await storeSnoopEntries(payload.indexer_id, payload.entries, payload.observations ?? []);
	return json({ accepted: true }, { status: 202 });
};
