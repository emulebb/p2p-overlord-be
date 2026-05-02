# Backend Docs

Canonical documentation home for `overlord-be`.

Current repo surfaces:

- `../overlord-be-coordinator/` is the only formal Node package in this repo.
- `../overlord-be-db/` is a backend-owned Windows helper for local PostgreSQL bootstrap and runtime control.
- Architecture docs still describe the broader target-state service lineup, but only current packages are present in the tree today.

## Read First

- [Architecture](./ARCHITECTURE.md)
- [Coordinator](./COORDINATOR.md)
- [Indexers](./INDEXERS.md)
- [Frontend](./FRONTEND.md)

## Interfaces And Operations

- [Configuration](./CONFIGURATION.md)
- [Containerization](./CONTAINERIZATION.md)
- [Roadmap](./ROADMAP.md)
- [ID Index](./ID_INDEX.md)

## Backlog

- [Active Backlog](../BACKLOG.md)
- [Backlog Archive](../BACKLOG_ARCHIVE.md)

## Repo Guards

- Shared workspace quality and opportunistic-refactoring policy lives in
  `../../p2p-overlord-tooling/docs/WORKSPACE_POLICY.md`; this section keeps the
  backend-specific guard notes.
- From `../p2p-overlord-tooling`, run
  `python -m overlord_tooling guard-tracked-files --repo-root ../p2p-overlord-be`
  to validate tracked files for local path leaks and configured personal-name
  filename leaks.
