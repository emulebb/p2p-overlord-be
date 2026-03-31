export type Protocol = 'kad2' | 'ed2k';

export type HashType = {
	kind: 'ed2k';
	value: string;
};

export type ContentType =
	| 'video'
	| 'audio'
	| 'document'
	| 'archive'
	| 'software'
	| 'unknown';

export type TagEntry = {
	key: string;
	value: unknown;
};

export type Source = {
	protocol: Protocol;
	address: string;
	extra: unknown;
};

export type FileRecord = {
	hashes: HashType[];
	names: string[];
	size: number | null;
	content_type: ContentType | null;
	tags: TagEntry[];
	sources: Source[];
};

export type IndexedFileSort =
	| 'last_seen_desc'
	| 'first_seen_desc'
	| 'name_asc'
	| 'size_desc'
	| 'sources_desc'
	| 'searches_desc';

export type IndexedFileView = FileRecord & {
	file_id: number;
	primary_name: string;
	first_seen: string;
	last_seen: string;
	source_count: number;
	search_job_count: number;
};

export type IndexedFileListResponse = {
	items: IndexedFileView[];
	page: number;
	page_size: number;
	total: number;
	total_pages: number;
	query: string;
	sort: IndexedFileSort;
};

export type SearchKind = 'keyword' | 'source' | 'notes';

export type SearchJob = {
	job_id: string;
	protocol: Protocol;
	kind: SearchKind;
	query: string | null;
	file_hash: HashType | null;
	file_size: number | null;
	callback_url: string;
};

export type SearchEventStatus = 'started' | 'batch_received' | 'completed' | 'failed' | 'cancelled';

export type SearchEvent = {
	job_id: string;
	indexer_id: string;
	status: SearchEventStatus;
	result_count: number | null;
	batch_count: number | null;
	error: string | null;
};

export type SearchCancelRequest = {
	job_id: string;
};

export type KeywordSearchRequest = {
	protocol: Protocol;
	kind: 'keyword';
	query: string;
};

export type HashSearchRequest = {
	protocol: 'kad2';
	kind: 'source' | 'notes';
	file_hash: HashType;
	file_size: number;
};

export type SearchRequest = KeywordSearchRequest | HashSearchRequest;

export type SearchDispatchStatus =
	| 'queued'
	| 'dispatch_failed'
	| 'dispatched'
	| 'active'
	| 'completed'
	| 'failed'
	| 'cancelled';

export type SearchJobStatus =
	| 'queued'
	| 'active'
	| 'cancelling'
	| 'completed'
	| 'completed_with_errors'
	| 'failed'
	| 'cancelled';

export type SearchDispatchView = {
	indexer_id: string;
	status: SearchDispatchStatus;
	result_count: number;
	batch_count: number;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
	last_error: string | null;
};

export type SearchJobStatusView = {
	job_id: string;
	protocol: Protocol;
	kind: SearchKind;
	query: string | null;
	file_hash: HashType | null;
	file_size: number | null;
	status: SearchJobStatus;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
	cancel_requested_at: string | null;
	result_count: number;
	dispatched_to: string[];
	last_error: string | null;
	dispatches: SearchDispatchView[];
	results: FileRecord[];
};

export type ResultBatch = {
	job_id: string | null;
	indexer_id: string;
	protocol: Protocol;
	harvest_context?: HarvestReplayContext | null;
	files: FileRecord[];
};

export type HarvestFamily = 'keyword' | 'source' | 'notes';

export type HarvestReplayContext = {
	replay_id: string;
	family: HarvestFamily;
	logical_key: string;
	target: string;
	start_position: number | null;
	size: number | null;
	restrictive_payload_hex: string | null;
};

export type HarvestReplayRecord = HarvestReplayContext & {
	indexer_id: string;
	started_at: string;
	completed_at: string;
	result_count: number;
	batch_count: number;
	error: string | null;
};

export type SnoopObservation = {
	family: HarvestFamily;
	logical_key: string;
	target: string;
	start_position: number | null;
	size: number | null;
	restrictive_payload_hex: string | null;
	observed_at: string;
};

export type InterfaceAddressFamily = 'ipv4' | 'ipv6';

export type AgentInterfaceAddress = {
	family: InterfaceAddressFamily;
	address: string;
};

export type AgentInterface = {
	name: string;
	description: string | null;
	addresses: AgentInterfaceAddress[];
	is_loopback: boolean;
	is_vpn_candidate: boolean;
	has_default_route: boolean;
};

export type InterfaceSelectionState = 'pending' | 'confirmed' | 'applied' | 'error';

export type InterfaceBindingSelection = {
	bind_iface: string | null;
	bind_ip: string | null;
	selection_confirmed: boolean;
};

export type InterfaceBindingReport = {
	recommended_interface_name: string | null;
	bind_iface: string | null;
	resolved_bind_ip: string | null;
	selection_confirmed: boolean;
	ready: boolean;
	state: InterfaceSelectionState;
	last_error: string | null;
};

export type AgentNetworkReport = {
	interfaces: AgentInterface[];
	control: InterfaceBindingReport;
	p2p: InterfaceBindingReport;
};

export type AgentControlConfig = {
	bind_iface: string | null;
	bind_ip: string | null;
	selection_confirmed: boolean;
	listen_port: number;
};

export type AgentKadConfig = {
	listen_port: number;
};

export type AgentEd2kConfig = {
	listen_port: number;
};

export type AgentP2pConfig = {
	bind_iface: string | null;
	bind_ip: string | null;
	selection_confirmed: boolean;
	kad: AgentKadConfig;
	ed2k: AgentEd2kConfig;
};

export type AgentNatP2pConfig = {
	enabled: boolean;
	backend_order: string[];
	igd_ip: string | null;
	minissdpd_socket: string | null;
	ssdp_local_port: number | null;
	discovery_timeout_secs: number;
	lease_duration_secs: number;
	renew_margin_secs: number;
	external_ip_override: string | null;
};

export type AgentNatConfig = {
	p2p: AgentNatP2pConfig;
};

export type AgentNetworkingConfig = {
	control: AgentControlConfig;
	p2p: AgentP2pConfig;
	nat: AgentNatConfig;
};

export type SelectedGateway = {
	backend: string;
	control_url: string;
	local_ip: string | null;
	gateway_ip: string | null;
	external_ip: string | null;
};

export type MappedEndpoint = {
	name: string;
	protocol: 'tcp' | 'udp';
	local_addr: string;
	external_addr: string;
	lease_expires_in_secs: number;
	backend: string;
};

export type NatStatusSnapshot = {
	enabled: boolean;
	gateway_discovered: boolean;
	backend: string | null;
	bind_ip: string | null;
	igd_ip: string | null;
	minissdpd_socket: string | null;
	ssdp_local_port: number | null;
	external_ip_override: string | null;
	gateway: SelectedGateway | null;
	mappings: MappedEndpoint[];
	observed_external_addresses: string[];
	last_refresh_unix_secs: number | null;
	last_error: string | null;
};

export type AgentActivityState =
	| 'starting'
	| 'bootstrapping'
	| 'idle'
	| 'active_search'
	| 'passive_harvest_replay'
	| 'publishing'
	| 'flushing_snoops'
	| 'reconfiguring'
	| 'degraded';

export type AgentActivitySnapshot = {
	state: AgentActivityState;
	since: string;
	job_id: string | null;
	protocol: Protocol | null;
	kind: SearchKind | null;
	query_or_target: string | null;
	progress_current: number | null;
	progress_total: number | null;
	last_update_at: string;
	last_error: string | null;
};

export type PublishSeedSource = 'coordinator' | 'synthetic_fallback' | 'manual_api';

export type PublishBatchSummary = {
	seed_source: PublishSeedSource;
	published_items: number;
	closest_contacts_considered: number;
	attempted_contacts: number;
	acked_contacts: number;
	failed_contacts: number;
	timed_out_contacts: number;
	completed_at: string;
	last_success_at: string | null;
};

export type PublishCounters = {
	batches: number;
	published_items: number;
	closest_contacts_considered: number;
	attempted_contacts: number;
	acked_contacts: number;
	failed_contacts: number;
	timed_out_contacts: number;
	last_batch_at: string | null;
	last_success_at: string | null;
};

export type AgentLogFileStatus = {
	path: string;
	rotation: string;
	max_files: number;
	last_write_at: string | null;
};

export type KadPublishObservability = {
	last_seed_source: PublishSeedSource | null;
	last_seed_at: string | null;
	latest_keyword_batch: PublishBatchSummary | null;
	latest_source_batch: PublishBatchSummary | null;
	keyword_counters: PublishCounters;
	source_counters: PublishCounters;
	log_file: AgentLogFileStatus | null;
};

export type KadHarvestFamilyObservability = {
	observed_requests: number;
	unique_shapes_observed: number;
	queued_entries: number;
	last_seen_at: string | null;
	last_from: string | null;
	last_target: string | null;
	last_start_position: number | null;
	last_size: number | null;
	last_restrictive_bytes: number | null;
};

export type KadPassiveReplayObservability = {
	started_cycles: number;
	completed_cycles: number;
	idle_cycles: number;
	emitted_results: number;
	widened_cycles: number;
	posted_batches: number;
	post_failures: number;
	last_started_at: string | null;
	last_completed_at: string | null;
	last_idle_at: string | null;
	last_error_at: string | null;
	last_target: string | null;
	last_start_position: number | null;
	last_restrictive_bytes: number | null;
	last_result_count: number;
	last_batches_posted: number;
	last_tiers_attempted: number;
	last_widest_responder_ceiling: number | null;
	last_widened: boolean;
	last_tiers: KadPassiveReplayTierSummary[];
	last_error: string | null;
};

export type KadPassiveReplayTierSummary = {
	responder_ceiling: number;
	result_count: number;
};

export type KadHarvestObservability = {
	keyword_requests: KadHarvestFamilyObservability;
	source_requests: KadHarvestFamilyObservability;
	notes_requests: KadHarvestFamilyObservability;
	passive_keyword_replay: KadPassiveReplayObservability;
	passive_source_replay: KadPassiveReplayObservability;
	passive_notes_replay: KadPassiveReplayObservability;
};

export type AgentInterfacesView = {
	registration: IndexerRegistration;
	report: AgentNetworkReport | null;
	config: AgentNetworkingConfig;
	nat: NatStatusSnapshot | null;
	agent_activity: AgentActivitySnapshot | null;
	publish_observability: KadPublishObservability | null;
	harvest_observability: KadHarvestObservability | null;
	last_error: string | null;
};

export type IndexerStats = {
	indexer_id: string;
	protocol: Protocol;
	peers_connected: number;
	crawl_rate: number;
	snoop_queue_depth: number;
	staging_queue_depth: number;
	uptime_secs: number;
	nat: NatStatusSnapshot | null;
	interface_report: AgentNetworkReport | null;
	agent_activity: AgentActivitySnapshot | null;
	publish_observability: KadPublishObservability | null;
	harvest_observability: KadHarvestObservability | null;
};

export type ConfigUpdate = {
	protocol: Protocol;
	config: unknown;
};

export type KeywordSnoopEntry = {
	family: 'keyword';
	logical_key: string;
	target: string;
	start_position: number;
	restrictive_payload_hex: string | null;
	hit_count: number;
	first_seen: string;
	last_seen: string;
	last_drained_at: string | null;
};

export type SourceSnoopEntry = {
	family: 'source';
	logical_key: string;
	target: string;
	start_position: number;
	size: number;
	hit_count: number;
	first_seen: string;
	last_seen: string;
	last_drained_at: string | null;
};

export type NotesSnoopEntry = {
	family: 'notes';
	logical_key: string;
	target: string;
	size: number;
	hit_count: number;
	first_seen: string;
	last_seen: string;
	last_drained_at: string | null;
};

export type SnoopEntry = KeywordSnoopEntry | SourceSnoopEntry | NotesSnoopEntry;

export type SnoopDashboardEntry = SnoopEntry & {
	indexer_id: string;
	hostname: string | null;
	protocol: Protocol | null;
};

export type SnoopDemandEntry = {
	family: HarvestFamily;
	logical_key: string;
	target: string;
	start_position: number | null;
	size: number | null;
	restrictive_payload_hex: string | null;
	observed_count: number;
	last_seen: string;
	replay_count: number;
	last_replay_at: string | null;
};

export type SnoopTrendEntry = SnoopDemandEntry & {
	resolved_file_count: number;
	sample_name: string | null;
};

export type SnoopDemandHoleEntry = SnoopDemandEntry & {
	last_error: string | null;
};

export type PopularHash = {
	hash: HashType;
	canonical_name: string;
	size: number;
	source_count: number;
};

export type RegisterRequest = {
	indexer_id: string;
	protocol: Protocol;
	url: string;
	hostname: string;
	version: string;
};

export type IndexerRegistration = RegisterRequest & {
	registered_at: string;
};
