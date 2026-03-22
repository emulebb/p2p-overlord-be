import { json } from '@sveltejs/kit';

import { listDemandHoles, listRecentSnoopEntries, listTrendingSnoopDemand } from '$lib/server/snoop-store';

export async function GET() {
	return json({
		entries: await listRecentSnoopEntries(40),
		trending: await listTrendingSnoopDemand(12),
		holes: await listDemandHoles(12)
	});
}
