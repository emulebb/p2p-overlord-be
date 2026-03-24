import { listIndexedFiles, normalizeIndexedFileListParams } from '$lib/server/search-store';

/**
 * Loads the first coordinator-local file listing snapshot for SSR and no-JS fallbacks.
 */
export async function load({ url }) {
	const params = normalizeIndexedFileListParams({
		page: Number(url.searchParams.get('page') ?? ''),
		pageSize: Number(url.searchParams.get('page_size') ?? ''),
		query: url.searchParams.get('q') ?? '',
		sort: url.searchParams.get('sort') ?? undefined
	});

	return {
		files: await listIndexedFiles({
			page: params.page,
			pageSize: params.pageSize,
			query: params.query,
			sort: params.sort
		})
	};
}
