ALTER TABLE snoop_entries
    ADD COLUMN request_shape JSONB NULL;

ALTER TABLE snoop_log
    ADD COLUMN request_shape JSONB NULL;

ALTER TABLE harvest_replays
    ADD COLUMN request_shape JSONB NULL;

UPDATE snoop_entries
SET request_shape = CASE family
    WHEN 'keyword' THEN jsonb_build_object(
        'family', 'keyword',
        'target', target,
        'start_position', COALESCE(start_position, 0),
        'restrictive_payload_hex', restrictive_payload_hex
    )
    WHEN 'source' THEN jsonb_build_object(
        'family', 'source',
        'target', target,
        'start_position', COALESCE(start_position, 0),
        'size', size
    )
    WHEN 'notes' THEN jsonb_build_object(
        'family', 'notes',
        'target', target,
        'size', size
    )
    ELSE NULL
END;

UPDATE snoop_log
SET request_shape = CASE family
    WHEN 'keyword' THEN jsonb_build_object(
        'family', 'keyword',
        'target', target,
        'start_position', COALESCE(start_position, 0),
        'restrictive_payload_hex', restrictive_payload_hex
    )
    WHEN 'source' THEN jsonb_build_object(
        'family', 'source',
        'target', target,
        'start_position', COALESCE(start_position, 0),
        'size', size
    )
    WHEN 'notes' THEN jsonb_build_object(
        'family', 'notes',
        'target', target,
        'size', size
    )
    ELSE NULL
END;

UPDATE harvest_replays
SET request_shape = CASE family
    WHEN 'keyword' THEN jsonb_build_object(
        'family', 'keyword',
        'target', target,
        'start_position', COALESCE(start_position, 0),
        'restrictive_payload_hex', restrictive_payload_hex
    )
    WHEN 'source' THEN jsonb_build_object(
        'family', 'source',
        'target', target,
        'start_position', COALESCE(start_position, 0),
        'size', size
    )
    WHEN 'notes' THEN jsonb_build_object(
        'family', 'notes',
        'target', target,
        'size', size
    )
    ELSE NULL
END;
