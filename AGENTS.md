# Backend Repo Rules

- Follow the shared workspace guidance from `../AGENTS.md` in addition to this file.
- Use `docs/README.md` as the canonical backend docs home.
- Use `BACKLOG.md` in this repo as the canonical active backlog.
- Use `overlord-be-coordinator/scripts/windows/coordinator_quality.ps1` as the canonical local quality gate for coordinator changes.
- The conservative coordinator baseline is:
  - `npm run check`
  - `npm run prisma:validate`
  - `npm run prisma:generate`
- For coordinator persisted-schema edits, also reset and rebuild the local DB through `overlord-be-db` after the schema change.
- Persisted coordinator database objects must remain `snake_case`.
- Prisma is the translation layer and the only coordinator schema source in this phase:
  - keep `schema.prisma` authoritative
  - use Prisma `db push`
  - do not treat incremental Prisma migrations as the schema workflow
- Keep reusable operational tooling in `../overlord-tooling`, not inline in issue-specific commands.
- Respect the workspace line-ending policy:
  - tracked text files use LF by default
  - `.ps1`, `.cmd`, and `.bat` may use CRLF
