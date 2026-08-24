# StudyNav Mobile 1.6.1 evidence

Evidence date: 2026-08-24

Release source: `dd014fc674f56a2cf5092b5cc3e8bcd80d37f113`

## Acceptance matrix

| Criterion | Result | Fresh evidence |
| --- | --- | --- |
| AC1 — full regression | PASS | `bun run verify`: 127 project tests, 75 pinned InkShade upstream tests, 13 browser scenarios, 200 assertions, 0 failures, 0 skips, 0 page errors, 0 extension-console errors. |
| AC2 — Safari build matrix | PASS | Apple packager accepted the extension. Unsigned Simulator builds passed for iPhone 17, StudyNav iPad (A16), and the final generic iOS Simulator verification. |
| AC3 — Safari workflows | PASS, simulator/provider-faithful | Safari Simulator enabled StudyNav and opened the Russian popup over a live JW.org Bible chapter on iPhone and iPad. The shared browser matrix covers all nine functions, phone/tablet layouts, portrait/landscape, light/dark, large text, reduced keyboard height, denial/regrant, restart, and the five 1.6.1 Safari regressions. No physical-device claim. |
| AC4 — Firefox Android | PASS | Firefox 142.0 accepted the temporary 1.6.1 add-on on Android 16/API 36. All nine live JW.org/WOL workflows, portrait/landscape, feature teardown, large text, offline local data, and restart passed. |
| AC5 — upgrade/persistence | PASS | A real same-profile Firefox Android 1.6.0 → 1.6.1 replacement preserved the seeded highlight, note, two tags, saved place, and non-default setting. Settings were copied additively from sync to local; the legacy value remained unchanged and later writes changed local only. |
| AC6 — reliability | PASS with documented Firefox system-toggle behavior | Automated and Android evidence cover repeated selections, long content, many records, restart, offline local data, rotation, responsive bounds, master/individual teardown, and no stale StudyNav UI after its own switch. Firefox kills extension JavaScript when the whole add-on is disabled, so an already-open tab needs one refresh after re-enabling. |
| AC7 — security/privacy | PASS | Exact three HTTPS origins, `storage` only, no excluded handlers, remote code, telemetry, third-party search, source SVG, or general network client in the mobile runtime. Firefox reports no required data collection. |
| AC8 — Apple configuration | PASS locally | Productivity category, version 1.6.1/build 1, universal iPhone/iPad family, iOS 15.4 floor, icons, EN/RU onboarding, privacy manifest, support/privacy URLs, and local review notes are present. Provider fields are not submitted. |
| AC9 — Mozilla configuration | PASS locally | Reproducible Firefox ZIP and exact-commit source ZIP, build instructions, Android compatibility, no-data declaration, permissions explanation, EN/RU copy, reviewer notes, and truthful limits are ready. No AMO upload/signing occurred. |
| AC10 — local beta packet | PASS | Current Safari/Firefox packages, hashes, screenshots, EN/RU copy, review material, implementation notes, runbook/receipt, and this proof bundle are present. InkShade dirt remains untouched. |

## Commands and receipts

### Repository regression

```text
bun run verify
PASS
127 project tests
75 pinned InkShade upstream tests
13 browser scenarios
200 browser assertions
0 failures; 0 skips; 0 page errors; 0 extension-console errors
```

The mobile scenario contributes 20 top-level assertions. It covers additive
1.6.0 settings migration, local-only writes, all nine functions, the five
Safari regressions, note/tag/saved-place persistence, permission teardown and
reapply, offline local records, stress records, responsive variants, mobile
layering, touch toolbar placement, and WOL behavior.

### Safari packaging and builds

```text
bun run verify:studynav:safari
PASS — Apple conversion check and unsigned generic iOS Simulator build

xcodebuild ... iPhone 17 ...
PASS

xcodebuild ... StudyNav iPad (A16) ...
PASS
```

Environment: macOS 26.5.1 and Xcode 26.6. Both simulator destinations were
shut down after evidence. Safari preference captures under `raw/safari/` show
denial, regrant, iPhone enablement, and iPad enablement. Store-safe screenshots
remain under `packages/studynav/store/mobile/screenshots/`.

The generated Safari extension tree and committed Xcode extension-resource tree
have the same relative-content digest:
`8034b1d7ae7a72993448c29267054550c6efd1de7cbdf59d5efe21f1785a7623`.

### Firefox Android runtime

```text
bun run package:studynav:firefox-android
PASS

bun run lint:studynav:firefox-android
PASS — 0 errors, 0 notices, 0 warnings

Firefox 142.0 / org.mozilla.firefox
Android 16 / API 36 / ARM64
StudyNav Mobile 1.6.1 temporary add-on
PASS
```

The official Mozilla APK SHA-256 was
`f5fe6a300cc5fc5286ef5efcd65daddc1166b1c74a6f5f7873381d48a01e2a9c`.
Firefox's permission surface listed access only to `jw.org`, `www.jw.org`,
and `wol.jw.org`, plus the no-data-collection declaration.

Direct device evidence retained under `raw/android/` includes:

- Bible portrait and fixed landscape toolbar placement;
- large-text popup and offline/restart saved-place persistence;
- exact Firefox permissions;
- full-image descriptions and compact language count;
- migrated 1.6.0 setting, note, and tag chips;
- local-only setting mutation;
- the honest system-disable-before-refresh limitation;
- final 1.6.1 popup with all nine functions on.

All six note colors, tag chip creation on comma/space, edit/delete/locate,
saved places, citations, QR, clean official link, clean copy, one/range/paragraph
precise links, image descriptions, and language count passed on live public
JW.org/WOL content.

### Real 1.6.0 to 1.6.1 migration

Commit `012700a` supplied the exact 1.6.0 package. In the same Firefox profile,
the test seeded a purple highlight, a note named `Migration 1.6.0 note`, tags
`migration-160` and `android`, a Genesis saved place, and
`officialOpen: false` in legacy sync storage.

After installing `dd014fc` as 1.6.1, the annotation and saved place rendered,
both tag chips remained, local flags matched the legacy value, and sync remained
unchanged. A real `SET_FLAG officialOpen:true` message then changed local
storage only and the reopened popup moved from eight to nine enabled functions.

### Artifact reproducibility

Firefox and Safari packages were each generated twice. The sorted entry lists
and every entry-content hash matched between builds. The source archive was
generated twice with `git archive` from exact release commit `dd014fc` and
matched byte-for-byte.

| Artifact | SHA-256 |
| --- | --- |
| `studynav-firefox-android-1.6.1.zip` | `cf8aea80e6b33d8d83ad0f8d14072950ddbaef0ec973807b03664f2a2f3b567c` |
| `studynav-safari-ios-extension-1.6.1.zip` | `5c887733a28b197be491e46e1bd2d48020d75b38766ae3b1ecbbc02b729cf29b` |
| `studynav-mobile-1.6.1-source-dd014fc.zip` | `dc7d49e97c4abf1aed77aa5151afbab1340c3d5b48b8af9c439b2f30be15060e` |

The ignored local artifacts are retained under `raw/artifacts/`; the tracked
proof records their exact hashes without committing the large binaries.

## Security and privacy receipt

The active mobile manifests contain only the `storage` browser API permission
and the three exact HTTPS origins. Static inspection and the final build smoke
found no remote code, `eval`, telemetry, external image search, desktop media
or download handlers, broad wildcard origin, or editable source icon in the
mobile outputs. Personal study records and mobile settings stay in local
extension storage. The 1.6.0 settings migration is additive and never deletes
or rewrites the legacy sync value.

## Known boundary and later gates

Firefox Android treats the three host permissions as required add-on
permissions rather than individual site toggles. Disabling the entire add-on
terminates its scripts before cleanup, so refresh an already-open JW tab once
after re-enabling. StudyNav's own `Tools` switch tears down immediately.

No physical iPhone/Android, TestFlight, App Store, AMO signing/upload,
provider agreement, credential, submission, or publication is claimed. Those
remain separate owner/provider gates. Public documentation must continue to say
that mobile packages are not publicly available until those gates pass.

After proof retention, the temporary `web-ext` session, emulator, both
task-created AVDs, and isolated 1.6.0 worktree were removed. Temporary build/APK
roots were moved to Trash. The Android SDK/OpenJDK installation remains; no
unrelated state was removed.
