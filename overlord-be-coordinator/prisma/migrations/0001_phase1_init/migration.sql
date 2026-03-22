CREATE TABLE files (
    id BIGSERIAL PRIMARY KEY,
    size BIGINT NULL,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE file_hashes (
    hash_type TEXT NOT NULL,
    hash_value TEXT NOT NULL,
    file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    PRIMARY KEY (hash_type, hash_value)
);

CREATE TABLE file_names (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (file_id, name)
);

CREATE TABLE file_tags (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL
);

CREATE TABLE sources (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    protocol TEXT NOT NULL,
    address TEXT NOT NULL,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE search_jobs (
    id TEXT PRIMARY KEY,
    protocol TEXT NOT NULL,
    kind TEXT NOT NULL,
    query TEXT NULL,
    file_hash JSONB NULL,
    file_size BIGINT NULL,
    status TEXT NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    cancel_requested_at TIMESTAMPTZ NULL
);

CREATE TABLE search_dispatches (
    id BIGSERIAL PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES search_jobs(id) ON DELETE CASCADE,
    indexer_id TEXT NOT NULL,
    status TEXT NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    batch_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    UNIQUE (job_id, indexer_id)
);

CREATE TABLE search_results (
    job_id TEXT NOT NULL REFERENCES search_jobs(id) ON DELETE CASCADE,
    file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    seen_count INTEGER NOT NULL DEFAULT 1,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (job_id, file_id)
);

CREATE TABLE snoop_entries (
    indexer_id TEXT NOT NULL,
    logical_key TEXT NOT NULL,
    family TEXT NOT NULL,
    target TEXT NOT NULL,
    start_position INTEGER NULL,
    size BIGINT NULL,
    restrictive_payload_hex TEXT NULL,
    hit_count INTEGER NOT NULL,
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    last_drained_at TIMESTAMPTZ NULL,
    PRIMARY KEY (indexer_id, logical_key)
);

CREATE TABLE snoop_log (
    id BIGSERIAL PRIMARY KEY,
    indexer_id TEXT NOT NULL,
    family TEXT NOT NULL,
    logical_key TEXT NOT NULL,
    target TEXT NOT NULL,
    start_position INTEGER NULL,
    size BIGINT NULL,
    restrictive_payload_hex TEXT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX snoop_log_observed_at_idx ON snoop_log(observed_at);
CREATE INDEX snoop_log_family_logical_key_observed_at_idx
    ON snoop_log(family, logical_key, observed_at);

CREATE TABLE harvest_replays (
    id TEXT PRIMARY KEY,
    indexer_id TEXT NOT NULL,
    family TEXT NOT NULL,
    logical_key TEXT NOT NULL,
    target TEXT NOT NULL,
    start_position INTEGER NULL,
    size BIGINT NULL,
    restrictive_payload_hex TEXT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    batch_count INTEGER NOT NULL DEFAULT 0,
    error TEXT NULL
);

CREATE INDEX harvest_replays_family_logical_key_idx ON harvest_replays(family, logical_key);
CREATE INDEX harvest_replays_completed_at_idx ON harvest_replays(completed_at);

CREATE TABLE harvest_replay_files (
    replay_id TEXT NOT NULL REFERENCES harvest_replays(id) ON DELETE CASCADE,
    file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    PRIMARY KEY (replay_id, file_id)
);

CREATE INDEX harvest_replay_files_file_id_idx ON harvest_replay_files(file_id);

CREATE TABLE stats_samples (
    id BIGSERIAL PRIMARY KEY,
    indexer_id TEXT NOT NULL,
    protocol TEXT NOT NULL,
    peers_connected INTEGER NOT NULL,
    crawl_rate DOUBLE PRECISION NOT NULL,
    snoop_queue_depth INTEGER NOT NULL,
    staging_queue_depth INTEGER NOT NULL,
    uptime_secs BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE indexer_registry (
    id TEXT PRIMARY KEY,
    protocol TEXT NOT NULL,
    url TEXT NOT NULL,
    hostname TEXT NOT NULL,
    version TEXT NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE raw_hashes (
    hash_type TEXT NOT NULL,
    hash_value TEXT NOT NULL,
    protocol TEXT NOT NULL,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending',
    PRIMARY KEY (hash_type, hash_value)
);
