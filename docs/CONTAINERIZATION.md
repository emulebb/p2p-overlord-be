# Containerization

Current containerization status and boundaries.

## 12. Containerization Status

Docker is not part of the active workflow right now.

The current Phase 1 setup assumes:
- `overlord-agent-*` services are run directly from the Rust workspace during development
- `overlord-be-coordinator` is run directly from the Node.js app workspace
- PostgreSQL is provisioned separately when persistence is needed

Container definitions can be added later once the local service boundaries and runtime flow
have settled.
  # aria2:
  #   image: p3terx/aria2-pro
  #   ports:
  #     - "6800:6800"
  #   environment:
  #     - RPC_SECRET=changeme

volumes:
  postgres_data:
```

**Scale path:** same images → K8s manifests. Multiple indexer instances per protocol: run
more containers with the same `OVERLORD_COORDINATOR_URL` — they self-register and the
coordinator fans out automatically [F030]. SQLite → Postgres already done; coordinator HA
and indexer sharding by hash prefix range remain in backlog [B004].

---
