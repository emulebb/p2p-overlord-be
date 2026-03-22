import { refreshAllAgentInterfaces } from '$lib/server/agent-control';
import { listRecentSearchJobs } from '$lib/server/search-store';
import { listRecentSnoopEntries } from '$lib/server/snoop-store';
import { listAgentDashboard } from '$lib/server/state';

export async function load() {
	await refreshAllAgentInterfaces();
	return {
		agents: listAgentDashboard(),
		searches: await listRecentSearchJobs(8),
		snoops: await listRecentSnoopEntries(40)
	};
}
