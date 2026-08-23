# StudyNav Mobile 1.6.1 evidence

Evidence date: 2026-08-23

Release source: `a89c9fcf90167bfa2e4827c66f9b4f402f51e349`

## Acceptance matrix

| Criterion | Result | Fresh evidence |
| --- | --- | --- |
| AC1 — full regression | PASS | `bun run verify`: 121 project tests, 75 pinned InkShade upstream tests, 13 browser scenarios, 200 assertions, 0 failures, 0 skips, 0 page errors, 0 extension-console errors. |
| AC2 — Safari build matrix | PASS | Apple packager accepted the extension. Unsigned Simulator builds passed for iPhone 17 and StudyNav iPad (A16); the final generic iOS Simulator verification also passed after the release package cleanup. Both simulators are shut down. |
| AC3 — Safari workflows | PASS, simulator/provider-faithful | Safari Simulator enabled the extension and opened the Russian popup on a live JW.org Bible chapter on iPhone and iPad. The iPhone recognized a selected verse; iPad popover sizing was rechecked. The browser matrix covers all nine settings plus phone/tablet, portrait/landscape, light/dark, large text, reduced keyboard height, denial/regrant, restart, and the five 1.6.1 regressions. No physical-device claim. |
| AC4 — Firefox Android | OWNER GATE | Package build and `web-ext lint --warnings-as-errors` pass with zero findings. Android Emulator installation/runtime checks have not run because the official Android SDK and its license are not installed/accepted. |
| AC5 — upgrade/persistence | PASS | Deterministic tests and the mobile browser scenario preserve notes, tags, saved places, other supported study data, and normalized settings across 1.6.0 to 1.6.1. The original sync value remains unchanged while the mobile copy moves to local storage. |
| AC6 — reliability | PASS for shared runtime; Android install pending under AC4 | Browser evidence covers repeated selections, long content, many records, restart, denied/regranted permission, offline local data, rotation/responsive bounds, reduced-height keyboard viewport, and teardown without stale controls. |
| AC7 — security/privacy | PASS | Exact three HTTPS origins, `storage` only, no excluded handlers, remote code, telemetry, third-party search, source SVG, or network client in the mobile runtime. Privacy/no-data copy matches the implementation. |
| AC8 — Apple configuration | PASS locally | Productivity category, version 1.6.1/build 1, universal iPhone/iPad family, iOS 15.4 floor, icons, EN/RU onboarding, privacy manifest, support/privacy URLs, and local review notes are present. Provider fields are not submitted. |
| AC9 — Mozilla configuration | PASS locally; emulator pending under AC4 | Reproducible Firefox ZIP and exact-commit source ZIP, build instructions, Android compatibility, no-data declaration, permissions explanation, EN/RU copy, reviewer notes, and limits are ready. No AMO upload/signing occurred. |
| AC10 — local beta packet | PARTIAL | Artifacts, hashes, screenshots/copy, checklists, links, and this proof bundle are present. The packet cannot receive an all-PASS verdict until AC4 has Android Emulator evidence. InkShade dirt remains untouched. |

## Commands and receipts

### Repository regression

```text
bun run verify
PASS
121 project tests
75 pinned InkShade upstream tests
13 browser scenarios
200 browser assertions
0 failures; 0 skips; 0 page errors; 0 extension-console errors
```

The mobile scenario contributes 20 assertions and covers additive 1.6.0
settings migration, local-only writes, all nine features, the five Safari
regressions, persistence, permission teardown/reapply, offline local records,
stress records, responsive variants, and WOL behavior.

### Safari packaging and builds

```text
bun run verify:studynav:safari
PASS — Apple conversion check and unsigned generic iOS Simulator build

xcodebuild ... -destination 'platform=iOS Simulator,id=1C56B0CD-451C-44DD-8356-D32C5A618BB2' ...
PASS — iPhone 17

xcodebuild ... -destination 'platform=iOS Simulator,id=EB71C16A-A5FC-4731-8817-9E7E58A164C3' ...
PASS — StudyNav iPad (A16)
```

Environment: macOS 26.5.1, Xcode 26.6. Simulator state at handoff:
`Shutdown` for both destinations.

Safari preference captures retained under `raw/safari/` show denial,
regrant, iPhone enablement, and iPad enablement. Store-safe and evidence
screenshots are committed under `packages/studynav/store/mobile/screenshots/`.

### Firefox and reproducibility

```text
bun run package:studynav:firefox-android
PASS

bun run lint:studynav:firefox-android
PASS — 0 errors, 0 notices, 0 warnings
```

The Firefox package was generated twice. Its normalized entry list and every
entry content hash matched between builds.

| Artifact | SHA-256 |
| --- | --- |
| `studynav-firefox-android-1.6.1.zip` | `bf1a3cba0eddef56a10f2853258fec8b3c65a7cb1329d91e5beea38951d59f72` |
| `studynav-safari-ios-extension-1.6.1.zip` | `3328db196c18fb8d96f14f363f57042a3322c6ab6408ad29095694fae492adc9` |
| `studynav-mobile-1.6.1-source-a89c9fc.zip` | `4435357734e3ca97545fc32d82cd94e94f935157bf16aaf8f7a42e64565784c4` |

The source archive was generated twice with `git archive` from exact release
commit `a89c9fc` and compared byte-for-byte. It contains no working-tree or
runtime state. Generated Safari resource-tree SHA-256:
`757aa82623d21490a2437da1564718b3fa4d143356745f8b7e6b9816df8b4f4e`.
Committed Xcode extension resource-tree SHA-256:
`ed3109de414d94c86dfeeb6e1217204d493ae9bfb3ddd738ad73cc83b0e59053`.
The different tree hashes reflect the generated and committed trees being
hashed with different path prefixes; Safari verification performs the required
file-by-file resource equality check.

### Public references

Fresh direct checks returned HTTP 200 for:

- `https://github.com/kiku-jw/nick-extensions/issues`
- `https://kiku-jw.github.io/nick-extensions/privacy/`
- `https://kiku-jw.github.io/nick-extensions/ru/privacy/`

These checks prove the support/privacy pages are reachable, not that a mobile
Store listing exists.

## Remaining gate

No Android SDK, `adb`, emulator, or Firefox Android runtime is currently
installed. The next step would install official Android command-line tools and
OpenJDK, accept the Android SDK License Agreement, create one modest emulator,
install Firefox, load the package through Mozilla's supported development
workflow, and run the critical JW.org/WOL scenarios. Agreement acceptance and
system-tool installation require Nick's explicit approval. The exact bounded
procedure and pass matrix are recorded in `android-emulator-runbook.md`; it
uses Firefox 142.0 from Mozilla's official archive, an ARM64 image without
Google Play, and no account or physical device.
