# StudyNav 1.4 release receipt

Class: release evidence. Owner: `packages/studynav`. Release date: 2026-08-16.

## Shipped contract

- Study data schema v2 with bounded local page, paragraph, and verse saved places.
- Additive migration from schema v1; the legacy key is retained byte-for-byte.
- Merge-only JSON export/import for annotations, saved places, and bounded media progress.
- Complete English and Russian Chrome locale catalogs covering manifest, popup, injected UI, dialogs, errors, and accessibility labels.
- 22 independent feature flags. Image download and the three layout-changing flags remain off by default.
- Toggle-to-deselect Bible verse behavior so page-level actions remain reachable after a verse action.
- Unofficial naming and a public synthetic-only documentation/media policy.

## Verification receipt

Fresh release gate on 2026-08-16:

- Root tests: **101 passed**, **0 failed**, **1,167 assertions**.
- Pinned InkShade upstream: **16 suites / 75 tests passed**.
- Browser matrix: **12 scenarios / 168 assertions passed**, **0 skipped**, **0 page errors**, **0 extension-origin console errors**.
- Study-data focused browser suite: **48 assertions passed**.
- Russian browser-locale scenario: manifest, popup, article controls, editor, library, QR, errors, and accessibility UI passed through the real Chrome i18n pipeline.
- Live verse-audio cases passed for current canonical English, Russian, and Ukrainian chapter routes and produced WAV clips consistent with the official marker duration.
- WOL geometry remained stable with all layout flags forced on, including the narrow-viewport editor case.
- Tutorial media: **44 feature clips** assembled into English and Russian H.264/AAC guides, each **1920×1080 at 30 fps, 76.73 seconds**, with synthetic silent audio and embedded localized scene cards.
- Local Pages QA: both languages expose 22 reference rows and 22 seekable chapters; video metadata loads at desktop and 390 px mobile widths with zero horizontal overflow or page/console errors.

The repeatable command is `bun run verify`. Live public-site checks are supplemental and must remain distinguishable from deterministic fixture evidence.

## Public content boundary

The GitHub Pages guide, screenshots, and tutorials use a synthetic fixture. They do not reproduce official publication text, artwork, logos, or site design. Live JW.org pages are used only in private disposable-profile QA.

Tutorial source is the shared `scripts/studynav-tutorial-scenes.json` manifest. `bun run media:studynav` uses the existing Video Builder renderer (override with `STUDYNAV_VIDEO_RENDERER`) plus system FFmpeg; it adds no project dependency. Narration mode is intentionally silent, with English or Russian copy embedded in every scene.

## Activation boundary

A successful build does not update an already loaded unpacked extension. Existing Brave/Chrome installations still require **Reload** on the extension card followed by a refresh of open supported pages.
