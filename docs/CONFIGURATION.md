# Configuration

Configuration ownership and full reference for the current phase.

## 11. Configuration [F001] [F014]

### 11.1 Ownership

`overlord.toml` owned exclusively by `SVC-001`. Indexers have zero local config.
Only input: `OVERLORD_COORDINATOR_URL=http://coordinator:13300`.

Download clients are configured via the API (`A029`–`A031`) and stored in `T018` —
they are **not** in `overlord.toml`.

Auto-generated on first run with all defaults and inline comments.

### 11.2 Full Config Reference

```toml
# overlord.toml — p2p-overlord central configuration
# All values shown are defaults. Coordinator hot-reloads most of these [F014].

[coordinator]
bind_addr                          = "0.0.0.0:13300"
database_url                       = "postgresql://overlord:overlord@localhost:5432/overlord"
active_search_duration_secs        = 60
stats_sample_interval_secs         = 60       # [W004]
dht_seed_interval_secs             = 600      # [W005]
dht_seed_top_n                     = 1000     # [F008]
correlation_interval_secs          = 300      # [W002]
torrent_correlation_min_confidence = 0.8      # [F006]
cross_protocol_fuzzy_size          = false    # [F005]
indexer_offline_threshold_secs     = 300      # [F030] [W009]

[coordinator.search]
default_strategy                   = "broadcast"  # broadcast | round_robin | least_busy [F030]

[coordinator.staging]
require_name                       = true
require_size                       = true
require_source                     = true
dead_hash_max_attempts             = 10
dead_hash_max_days                 = 30
retry_backoff_base_secs            = 3600

[coordinator.retention]
snoop_log_days                     = 30
stats_samples_days                 = 7

[coordinator.auth]
enabled                            = false    # [F033] set true to enforce login

# ──────────────────────────────────────────────────────────────────
[emule]                                       # pushed to all SVC-002 instances [F014]
[emule.control]
listen_port                        = 13301

[emule.p2p]
bind_iface                         = ""
bind_ip                            = ""

[emule.p2p.kad]
listen_port                        = 41000
nodes_dat_path                     = "./nodes.dat"
servers_met_path                   = "./servers.met"
routing_table_max                  = 12000
obfuscation                        = true

[emule.p2p.ed2k]
listen_port                        = 41001

ed2k_server_pool                   = 5

[emule.snoop_queue]
dedup_window_secs                  = 28800
max_depth                          = 10000
random_pick_probability            = 0.05
max_queries_per_600s               = 60

[emule.wordlist]
path                               = ""       # empty = bundled default (~5000 terms)

# ──────────────────────────────────────────────────────────────────
[mainline]
rest_addr                          = "0.0.0.0:13302"
dht_bind_addr                      = "0.0.0.0:41002"
routing_table_max                  = 20000
enrich_concurrency                 = 50       # [F023] max concurrent BEP-9 fetches

[mainline.snoop_queue]
dedup_window_secs                  = 28800
max_depth                          = 50000
random_pick_probability            = 0.05
max_enrichments_per_600s           = 200

# ──────────────────────────────────────────────────────────────────
[gnutella]
rest_addr                          = "0.0.0.0:13303"
bind_addr                          = "0.0.0.0:41003"
hub_pool_size                      = 5

[gnutella.snoop_queue]
dedup_window_secs                  = 28800
max_depth                          = 10000
random_pick_probability            = 0.05
max_queries_per_600s               = 30

# ──────────────────────────────────────────────────────────────────
[ipfs]
rest_addr                          = "0.0.0.0:13304"
libp2p_addr                        = "0.0.0.0:41004"
enable_crawl                       = true     # [F025]
enable_pubsub                      = true     # [F026]
enable_dir_walk                    = true     # [F027]

# ──────────────────────────────────────────────────────────────────
[api]
default_sort                       = "availability"
weight_availability                = 1.0
weight_recency                     = 0.3
weight_protocol_count              = 0.5
weight_fts_rank                    = 0.8      # [F017]
```

---
