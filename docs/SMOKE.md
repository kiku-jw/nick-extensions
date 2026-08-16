# Verification contract

This is a live operator runbook. Source, tests, and manifests are authoritative; update this document whenever the verification surface changes.

## Full gate

```bash
cd nick-extensions
bun install --frozen-lockfile
bun run bootstrap:inkshade
bun run browser:install # first run, or after a Playwright browser-cache reset
bun run verify
```

The gate proves, in order:

1. package TypeScript compiles under the root strict configuration;
2. monorepo tests plus the pinned InkShade upstream unit suite pass;
3. all three `dist/` directories are rebuilt from source;
4. Manifest V3 files, entrypoints, permissions, icons, and DNR lists are structurally valid;
5. disposable Chromium profiles compare a no-extension baseline with each extension enabled and then disabled/allowlisted, exercising popup/options controls rather than mutating storage alone;
6. a combined profile loads all three extensions and checks DOM/storage isolation and extension-page errors;
7. a final artifact check confirms manifests, versions, entrypoints, permissions, and rules still match the source after the browser run.

The browser matrix loads temporary copies of `dist/` and checks that it did not mutate its source snapshots. It must not use Nick's normal browser profile, cookies, history, or credentials. A separately running Brave instance may create ignored `dist/_metadata/` beside an unpacked ClearShield build; `bun run package:dist` excludes that browser-owned cache from the release zip.

## Differential expectations

| Scenario | Expected difference from baseline | Reversal check |
|---|---|---|
| Ad & Tracker Blocker (ClearShield) | fixture ad script, image, frame, and cosmetic banner are blocked; popup counts/badge, list toggles, options counts, allowlist, export, and import work; first-party control remains usable | global off and allowlisting restore the baseline; settings/rules survive a forced service-worker stop and cold wake |
| InkShade – Dark Mode for Every Site | Full MV3 proxy/dynamic engine, CSS variables, cross-origin CSS, gradients, pseudo-elements, shadow DOM, dynamic content, forms, media, inherited frames, native-dark avoidance, tone controls, and distinct local-first popup branding are exercised against baseline geometry | global off and per-site off remove page and inherited-frame state without stale styles; repeated updates keep one engine instance |
| StudyNav — Unofficial Study Tools | all 23 exposed flags have a runtime surface; six-color local annotations and a non-overlapping notes rail, local page/paragraph/verse/range saved places, notes/tags, page/global search, schema-v2 backup/import and additive v1 migration, orphan recovery, citations, precise QR/Finder actions, complete Russian browser-locale UI, and explicit continue-watching are exercised; image downloads and all three layout-changing helpers remain off by default; WOL keeps native geometry; popup/injected accents resolve to `#43669F`; verse-number selection reveals verse audio; media pages can export validated WAV audio and WebM video intervals; live English plus canonical Russian and Ukrainian verse downloads match official marker durations | every flag is disabled/restored individually; rapid popup mutations, master off, `PageNotFound`, SPA changes, WOL, and 360 px overlays verify cleanup, retained local data, geometry, and listener safety; unsupported JW routes and ordinary hosts stay clean |
| Combined | each extension changes only its own surface | all workers/popups remain responsive and no DOM namespace collides |

The deterministic `studynav-study-suite` scenario covers annotation and saved-place storage/rendering/recovery, schema migration, JSON boundaries, citations, QR, Finder targets and ranges, progress lifecycle, all 23 per-flag reversals, WOL geometry, narrow viewports, and popup mutation serialization. `studynav-russian-locale` launches an isolated browser with the real Russian Chrome locale and checks manifest, popup, injected controls, dialogs, errors, and accessibility labels. The optional public smokes compare ClearShield on `animevost.org` and StudyNav on `jw.org` as supplemental current-site evidence. The StudyNav live smoke also forces the old layout flags on at a Russian WOL article and checks that the native header/main geometry and viewport width remain intact. The dedicated `studynav-verse-audio-live` group downloads one verse in English and directly from JW.org's canonical Russian and Ukrainian chapter routes in disposable profiles. The English live case additionally exports a one-second audio interval from the current official JW CDN source as RIFF/WAVE and records a one-second official video interval as an EBML WebM download. Each language case clears resource timings and removes page audio elements before verse selection, then verifies the WAV filename and duration against that language's current official marker. HTTP denial, DNS failure, timeout, or an error page is reported as `SKIP`, never as a product `PASS` or `FAIL`. The deterministic local matrix remains the repeatable acceptance gate.

`bun run smoke:browser` runs the full matrix and prints a compact receipt with scenario, assertion, skip, page-error, and extension-console-error counts. Run `node scripts/browser-differential.mjs` directly only when the complete diagnostic JSON is needed.

## Focused commands

```bash
bun run typecheck
bun run test
bun run build
bun run smoke-check
bun run smoke:browser
bun run package:dist
```

For a local diagnostic slice only, set `NICK_EXT_SCENARIOS` to comma-separated scenario IDs such as `studynav-only,studynav-study-suite,studynav-live-smoke,studynav-verse-audio-live`. Release evidence always runs the unfiltered full matrix.

## Honest limitations

- ClearShield is a bounded DNR blocker, not a full uBlock/Brave Shields replacement; it has no scriptlets or general redirect engine.
- InkShade derives from Dark Reader's pinned dynamic engine and bundled site fixes, but it is an independent fork; upstream improvements do not arrive until explicitly reviewed and merged.
- InkShade and any other dark-mode extension must not be enabled on the same page because their stylesheet engines can conflict.
- StudyNav depends on public JW DOM and media APIs. Verse clipping currently supports one selected verse at a time and intentionally exports WAV; MP3 encoding and multi-verse ranges would require disproportionate new machinery.
- Per-tab ClearShield counts depend on unpacked-extension DNR feedback availability.
- Native context-menu presentation is not observable through the Playwright API; the browser matrix proves the same toggle implementation through the popup and separately checks the manifest/listener structure.
