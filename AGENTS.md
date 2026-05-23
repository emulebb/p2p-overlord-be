# Backend Repo Rules

- Follow the eMuleBB workspace policy in
  `../eMule-tooling/docs/WORKSPACE-POLICY.md` when this repo is checked out
  under `EMULE_WORKSPACE_ROOT\repos`.
- If the standalone p2p-overlord workspace is in use, also follow
  `../p2p-overlord-tooling/docs/WORKSPACE_POLICY.md`.
- Use `docs/README.md` as the canonical backend docs home.
- Use `BACKLOG.md` in this repo as the canonical active backlog.
- Target full stock eMule `v0.72a` Kad and ED2K parity, including deprecated
  legacy compatibility behavior. The only standing protocol exception is
  defunct ED2K PeerCache support.
- In this repo, `overlord-be-coordinator` is the only formal Node package.
  `overlord-be-db` remains a Windows-only backend helper.
- The conservative coordinator baseline is:
  - `npm run quality`
  - or equivalently:
  - `npm run check`
  - `npm run prisma:validate`
  - `npm run prisma:generate`
- Do not add new oversized tracked source files or grow baselined oversized
  files; the workspace source-size ratchet is enforced from tooling.
- When touching oversized or locally complex source, opportunistically split or
  simplify the touched area if the change is behavior-preserving, scoped, and
  covered by targeted checks.
- Keep tracked text files normalized to UTF-8 with LF endings; the workspace
  line-ending guard is enforced from tooling.
- For persisted-schema edits, also reset and rebuild the local DB through
  the `overlord-be-db` helper.
- Persisted coordinator database objects must remain `snake_case`.
- Prisma remains the coordinator schema source:
  - keep `schema.prisma` authoritative
  - use Prisma `db push`
  - do not treat incremental Prisma migrations as the schema workflow
- Do not add shell wrapper launchers.
