import { json } from '@sveltejs/kit';

import { listIndexedFiles, normalizeIndexedFileListParams } from '$lib/server/search-store';

/**
 * Returns a paginated, coordinator-local view of indexed files for browse and search flows.
 */
export async function GET({ url }) {
	const params = normalizeIndexedFileListParams({
		page: Number(url.searchParams.get('page') ?? ''),
		pageSize: Number(url.searchParams.get('page_size') ?? ''),
		query: url.searchParams.get('q') ?? '',
		sort: url.searchParams.get('sort') ?? undefined
	});

	return json(
		await listIndexedFiles({
			page: params.page,
			pageSize: params.pageSize,
			query: params.query,
			sort: params.sort
		})
	);
}
