# Evidence — StudyNav Chrome Web Store 1.6.0

## Current verdict

Repository and archive readiness pass. Chrome Web Store provider state is
pending the Dashboard upload and submission step.

## Acceptance criteria

- **AC1 PASS:** `bun run package:studynav:chrome` creates a Manifest V3 ZIP with
  `manifest.json` at the root and no maps, browser metadata, source-only icon,
  or `.DS_Store` files.
- **AC2 PASS:** `docs/STUDYNAV-CHROME-STORE.md` owns EN/RU copy, single purpose,
  permission and privacy answers, URLs, certifications, test instructions, and
  release-state boundaries.
- **AC3 PASS:** the EN/RU privacy pages describe the computer release, local
  processing, explicit external actions, Limited Use, and the parked mobile
  lane.
- **AC4 PASS:** the promo is 440 x 280; five screenshots per locale are
  1280 x 800, legible, synthetic, and carry no official JW.org branding.
- **AC5 PASS:** the complete verification passed 113 unit tests, 75 upstream
  tests, 13 browser scenarios, and 191 assertions with no failures or skips;
  archive inspection and the final smoke check also passed.
- **AC6 PENDING:** the exact archive has not yet been read back from Chrome Web
  Store Developer Dashboard.
- **AC7 PARTIAL:** Issues #8 and #9 and Project #3 record the release decision;
  the task-owned commit, push, and final provider receipt remain pending.

## Exact artifact

- Path: `packages/studynav/studynav-chrome-store.zip`
- Version: `1.6.0`
- SHA-256: `cefaa9fc4247451c795cd1ffd5ae28e2dda65cd54508765b10ea53e74deaf53e`

## Boundaries

- `packages/inkshade/upstream` is unrelated dirty user state and remains
  untouched.
- Payment, a new agreement, credentials, or 2-step verification are owner
  actions.
