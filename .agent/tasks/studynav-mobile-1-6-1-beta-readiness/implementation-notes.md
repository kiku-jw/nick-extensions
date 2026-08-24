# StudyNav Mobile 1.6.1 implementation notes

Date: 2026-08-24

Owning Issue: `kiku-jw/nick-extensions#8`

Release source: `dd014fc674f56a2cf5092b5cc3e8bcd80d37f113`

## Delivered slice

- Kept one shared TypeScript implementation and exactly nine mobile functions.
- Kept desktop-only media/download/player/transcript/second-display,
  image-download/search, keyboard, and layout handlers out of Safari iOS and
  Firefox Android outputs.
- Kept both mobile manifests on `storage` and the exact `jw.org`,
  `www.jw.org`, and `wol.jw.org` HTTPS origins.
- Stored mobile settings in local extension storage. A valid 1.6.0 sync value
  is copied and normalized once when no local value exists; the legacy value is
  never deleted or rewritten. Desktop settings remain in sync storage.
- Preserved notes, six-color highlights, tags, saved places, and the bounded
  local study-data envelope.
- Corrected Safari iPad popup sizing and prepared the Apple privacy,
  category/version, EN/RU onboarding, review, and screenshot material.
- Removed the unreferenced editable source SVG from mobile release outputs.
- Added deterministic migration, persistence, responsive, offline, stress,
  permission, Safari-regression, mobile-layering, and touch-toolbar coverage.

## Firefox Android fixes from the real emulator

Firefox Android 142 exposed two problems that Chromium/Safari fixtures did not:

1. Its `chrome.*` asynchronous APIs completed through callbacks while the
   mobile code awaited Promise returns. A small boundary adapter now supports
   both callback and Promise implementations, reports `runtime.lastError`, and
   prevents double settlement. Storage, runtime messaging, tab query/message,
   and tab creation all use it.
2. Its URLSearchParams implementation did not provide the iterable
   `keys()` behavior used by clean-link normalization. Query keys are now
   collected through `forEach`, preserving duplicate/tracking cleanup.

The Android add-on settings surface can become Firefox's active tab while the
JW page remains open. The popup now ranks only eligible JW tabs and remembers
the responding page, so actions do not silently target the settings UI.

Landscape touch devices now place verse controls above or below the verse
inside the reading column instead of docking them over JW's second pane.
The verse toolbar also stays below the note drawer's layer, so it cannot cover
the note editor.

## Verification boundary

The Safari iPhone 17 and iPad (A16) simulators received unsigned 1.6.1 builds.
StudyNav was enabled through Safari's extension controls and its Russian popup
opened over a live public JW.org Bible page. Provider-faithful browser
scenarios exercise the full nine-feature shared runtime and adverse states at
phone and tablet sizes.

Firefox 142.0 was installed from Mozilla's official ARM64 archive into an
Android 16/API 36 emulator. Live JW.org/WOL checks passed all nine functions,
portrait/landscape, large text, offline saved data, Firefox restart, feature
teardown, and the exact 1.6.0 to 1.6.1 migration with local-only later writes.

This is not a physical-device or Store/provider-acceptance claim. Firefox's
whole-add-on disable operation terminates scripts before DOM cleanup; refresh
an already-open JW tab once after re-enabling. StudyNav's own master switch
cleans immediately.

## Security review

The final mobile outputs contain no remote code, telemetry, third-party search,
desktop media handler, broad origin, or additional browser API permission.
Firefox reports that the developer requires no data collection. User values
are validated by the bounded study-data schema and rendered through
extension-owned text/DOM boundaries.

The generated Safari tree and Xcode resource tree match file-for-file. Firefox
and Safari ZIP contents reproduced across two builds, and the exact-commit
source archive reproduced byte-for-byte.

## Deliberate non-actions

- Did not connect to, mirror, automate, install onto, or otherwise occupy
  Nick's physical iPhone.
- Did not use a physical Android device.
- Did not sign for distribution, upload, submit, or publish an Apple or
  Mozilla artifact.
- Did not alter `packages/inkshade/upstream`; its pre-existing dirty state is
  preserved.

## Cleanup

The temporary Firefox development session and emulator were stopped. The two
task-created AVDs and isolated 1.6.0 worktree were removed. APK/build roots and
the superseded source archive were moved to Trash. The official Android SDK and
OpenJDK remain available for a later separately approved pass.

## Routing receipt

One bounded Luna worker was used for the earlier mobile
release/configuration/test slice. The primary agent independently reviewed the
diff, ran the repository and Safari verification, executed the Firefox Android
and migration checks, completed security/adversarial review, produced
reproducible exact-source artifacts, and retained final judgment. No second
execution or review control plane was added.
