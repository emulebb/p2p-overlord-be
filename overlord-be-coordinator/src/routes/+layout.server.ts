import { getSearchCounters } from '$lib/server/search-store';
import { snapshotStatus } from '$lib/server/state';

export async function load() {
	const searchCounters = await getSearchCounters();
	return {
		shellStatus: {
			...snapshotStatus(),
			...searchCounters
		}
	};
}
