# Backend Repo Rules

- Follow the shared workspace policy in
  `../p2p-overlord-tooling/docs/WORKSPACE_POLICY.md`.
- Use `docs/README.md` as the canonical backend docs home.
- Use `BACKLOG.md` in this repo as the canonical active backlog.
- In this repo, `overlord-be-coordinator` is the only formal Node package.
  `overlord-be-db` remains a Windows-only backend helper.
- The conservative coordinator baseline is:
  - `npm run check`
  - `npm run prisma:validate`
  - `npm run prisma:generate`
- For persisted-schema edits, also reset and rebuild the local DB through
  the `overlord-be-db` helper.
- Persisted coordinator database objects must remain `snake_case`.
- Prisma remains the coordinator schema source:
  - keep `schema.prisma` authoritative
  - use Prisma `db push`
  - do not treat incremental Prisma migrations as the schema workflow
- Do not add shell wrapper launchers.
