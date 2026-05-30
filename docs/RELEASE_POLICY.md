# p2p-overlord Release Policy

This policy aligns p2p-overlord release naming with the eMuleBB release style
while keeping p2p-overlord version numbers independent.

## Version Flow

Use dotted SemVer prerelease identifiers for public unstable builds:

```text
0.1.1-rc.1
0.1.1-rc.2
0.1.1
0.1.2
0.1.3-beta.1
0.1.3-rc.1
0.1.3
```

The first planned p2p-overlord release candidate is `0.1.1-rc.1`. The
non-dotted spelling `0.1.1-rc1` is not canonical and should not be used in
metadata, tags, package names, milestones, or release notes.

## Dev Mode And Release Mode

The workspace is in dev mode by default. In dev mode:

- document planned versions and release gates;
- keep active work on `develop`;
- do not create release branches;
- do not create Git tags or GitHub releases;
- do not bump tracked version metadata to a release candidate.

Release mode starts only when the operator explicitly confirms that release prep
should begin. A general request to continue development is not release-mode
authorization.

## Branches

Create a release branch only after release mode is confirmed:

```text
release/0.1.1
```

Release branches are stabilization branches. Accept only:

- blocker and high-confidence bug fixes;
- release proof and packaging fixes;
- release documentation, changelog, and version metadata;
- fixes needed to satisfy RC evidence gates.

Do not add new features or broad refactors directly on a release branch. Every
applicable fix made on a release branch must be merged or cherry-picked back to
`develop`.

## Tags

Published tags are immutable annotated tags. Do not move a published tag; if a
candidate is bad, publish the next candidate number.

Tag shape:

```text
p2p-overlord-v0.1.1-rc.1
p2p-overlord-v0.1.1-rc.2
p2p-overlord-v0.1.1
p2p-overlord-v0.1.2
```

The same product tag is applied to the exact commits used for the release in all
active p2p-overlord repos:

- `%OVERLORD_PROJECT_DIR%/p2p-overlord-be`
- `%OVERLORD_PROJECT_DIR%/p2p-overlord-agents`
- `%OVERLORD_PROJECT_DIR%/p2p-overlord-tooling`

Tags are created only after release proof passes and the operator gives a
separate tagging instruction.

## GitHub

Use `p2p-overlord-0.1.1` as the GitHub milestone for the first RC and stable
line. Use issue labels to distinguish candidate-specific work:

```text
rc1
release-blocker
p1
ed2k
kad
backend
agent
tooling
evidence
```

GitHub issues should keep the canonical backlog item in the title:

```text
[ITEM_039] Add active eD2K source-search offer-file settle and source-attempt observability
```

`%OVERLORD_PROJECT_DIR%/p2p-overlord-be/BACKLOG.md` remains the canonical active
backlog. GitHub issues and projects mirror or expose backlog items; they do not
replace the backlog.

## Release Metadata

When release mode starts for `0.1.1-rc.1`, update version metadata together:

- Rust workspace package version: `0.1.1-rc.1`;
- coordinator `package.json` and `package-lock.json`: `0.1.1-rc.1`;
- coordinator internal OpenAPI `info.version`: `0.1.1-rc.1`;
- tooling `pyproject.toml`: `0.1.1-rc.1`.

Before release proof, confirm no stale release metadata remains:

```console
rg "0\\.1\\.0|0\\.1\\.1-rc1" %OVERLORD_PROJECT_DIR%/p2p-overlord-be %OVERLORD_PROJECT_DIR%/p2p-overlord-agents %OVERLORD_PROJECT_DIR%/p2p-overlord-tooling
```

Historical notes may mention old values, but active metadata, docs, package
names, tags, and release notes must use the canonical version spelling.
