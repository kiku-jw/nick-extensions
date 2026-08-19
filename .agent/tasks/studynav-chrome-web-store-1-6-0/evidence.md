# Evidence — StudyNav Chrome Web Store 1.6.0

## Current verdict

Repository, archive, and provider-submission readiness pass. Chrome Web Store
item `bjgaghgbmghohpahonodejobgflpcbai` accepted version 1.6.0 and now shows
**Pending review**. Approval, public installability, and a Store-installed smoke
test remain separate post-review checks.

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
- **AC6 PASS:** Chrome Web Store Developer Dashboard shows item
  `bjgaghgbmghohpahonodejobgflpcbai`, version 1.6.0, English and Russian
  metadata, the declared permissions, and **Pending review** after submission.
- **AC7 PASS:** Issues #8 and #9, Project #3, and this receipt record the current
  release state; task-owned changes are published without touching the dirty
  InkShade submodule.

## Exact artifact

- Path: `packages/studynav/studynav-chrome-store.zip`
- Version: `1.6.0`
- SHA-256: `cefaa9fc4247451c795cd1ffd5ae28e2dda65cd54508765b10ea53e74deaf53e`

## Provider receipt

- Submitted: `2026-08-19`
- Publisher: `KikuAI Lab`
- Item ID: `bjgaghgbmghohpahonodejobgflpcbai`
- Dashboard state: **Pending review**
- Dashboard item:
  `https://chrome.google.com/webstore/devconsole/59451163-bbb8-454e-8759-70b5ef78c1ce/bjgaghgbmghohpahonodejobgflpcbai/edit`
- Public listing: not yet observed; do not claim publication until the Store URL
  is live and an installed Store build passes the desktop smoke test.

## Boundaries

- `packages/inkshade/upstream` is unrelated dirty user state and remains
  untouched.
- Payment, a new agreement, credentials, or 2-step verification are owner
  actions.
