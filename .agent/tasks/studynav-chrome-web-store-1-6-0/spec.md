# StudyNav Chrome Web Store 1.6.0 release

## Original task

Publish the existing desktop StudyNav extension in Chrome Web Store. Park the
mobile release lane because current mobile Chromium stores do not provide a
reliable supported installation path.

## Success condition

The exact verified StudyNav 1.6.0 desktop archive is submitted to Chrome Web
Store with accurate English and Russian metadata, privacy disclosures, and
visual assets. The repository, public guide, and canonical GitHub Issues record
the real release state without mobile-support claims.

## Acceptance criteria

- **AC1 — Store archive:** a reproducible command creates a ZIP whose root
  contains the desktop Manifest V3 package, excludes source maps and browser
  metadata, and retains only the declared StudyNav files and permissions.
- **AC2 — Store contract:** the repository contains accurate listing copy,
  single-purpose text, permission/privacy justifications, support/privacy URLs,
  asset requirements, certification steps, archive hash, and release-state
  boundaries for Chrome Web Store.
- **AC3 — Public policy and guidance:** English and Russian public privacy and
  guide content describe the supported desktop release and do not promise a
  current mobile installation path.
- **AC4 — Listing assets:** all submitted screenshots and promotional assets
  meet current Chrome Web Store dimensions, are readable, and do not imply
  official JW.org affiliation.
- **AC5 — Functional verification:** typecheck, unit tests, upstream tests,
  builds, smoke checks, browser differential checks, archive inspection, and
  targeted Chrome Store contract checks pass on the final source state.
- **AC6 — Provider state:** Chrome Web Store Developer Dashboard records the
  verified archive and metadata in an observable submitted, in-review, or
  published state. Payment, new agreement, credential, or 2FA gates require
  owner action and are reported separately.
- **AC7 — Durable status:** the Chrome release Issue and Project #3 item record
  current evidence; the mobile Issue is closed as not planned; task-owned Git
  changes are published without touching the dirty InkShade submodule.

## Constraints

- Desktop Chromium only; no Android or iPhone compatibility claim.
- Keep the existing StudyNav 1.6.0 feature behavior and permissions unchanged.
- No telemetry, remote code, advertising, remote note service, or new account.
- No claim of being produced, maintained, supported, or endorsed by
  Jehovah's Witnesses.
- Public JW.org/WOL page content and user-created study data are processed
  locally except for explicit user actions that open official media or Google
  image search.
- Do not pay a fee, accept a new legal agreement, expose credentials, or enter
  an OTP on the owner's behalf.
- Preserve unrelated worktree changes, especially
  `packages/inkshade/upstream`.

## Non-goals

- Mobile web app, native app, or mobile browser package.
- New StudyNav product features or permissions.
- Paid promotion or claims about adoption/install volume.
- Reworking the Edge Add-ons listing beyond recording that mobile is parked.

## Release experiment

- Experiment ID: `studynav-cws-release-2026-08`
- Lane: proof readiness / distribution
- Audience: desktop Chromium users who study public JW.org and WOL pages
- Resource: one verified Chrome Web Store listing
- Hypothesis: a Store listing removes the developer-mode and manual ZIP install
  barrier for desktop users.
- Primary measurable outcome: the listing reaches submitted/in-review state,
  followed by a separately observed publication state.
- Baseline: no Chrome Web Store listing exists at task start.
- Attribution: Developer Dashboard state and the resulting listing URL.
- Guardrails: no new permissions, remote code, telemetry, mobile claims,
  official-affiliation implication, or spending without owner approval.
- Observation trigger: Google certification state changes or the listing becomes
  publicly available.

## Assumptions

- Version 1.6.0 has not previously been uploaded to Chrome Web Store.
- Existing real-product screenshots can be reused if they meet current Store
  dimensions and remain legible.
- The user's instruction to publish authorizes upload and submission of this
  listing, but not payment, new agreements, credential disclosure, or OTP entry.

## Verification plan

1. Verify current official Chrome Web Store package, image, privacy, and
   publication requirements from primary Google documentation.
2. Inspect the manifest, generated archive, permissions, files, image
   dimensions, and privacy claims.
3. Run the repository's full `bun run verify` contract on final source state.
4. Run targeted Store-package checks and capture outputs under `raw/`.
5. Upload the exact archive by hash, fill the listing, submit it, and read back
   the provider state.
6. Record evidence per AC, run a fresh read-only verification, and finalize the
   task bundle.
