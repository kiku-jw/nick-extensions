# StudyNav implementation notes

Document class: Live contract

Owner sources: `manifest.safari-ios.json`, `manifest.firefox-android.json`, `src/features.ts`, `src/build-profile.ts`, `src/content.mobile.css`, `scripts/build-extension.mjs`, and `apple/StudyNav`.

Update this note whenever the mobile feature boundary, platform manifests, build profile, Xcode wrapper, or release status changes.

## Platform decision

The normal Edge Add-ons listing did not provide a usable mobile installation
path. The current lane therefore uses Safari Web Extensions for iPhone/iPad and
Firefox extensions for Android. The historical Edge target remains available
only for reproducibility and is excluded from the default build.

StudyNav Mobile is one compile-time profile of the existing StudyNav codebase,
not a fork, web app, or runtime device mode. Safari and Firefox receive
byte-identical runtime and UI files with platform-specific manifests. Both
packages share the study-data schema and core study tools with desktop.

The mobile allowlist is owned by `MOBILE_FEATURE_IDS`. It contains exactly nine
settings: annotations, bookmarks, citations, QR sharing, clean publication
links, clean text copy, precise links, image descriptions, and language count.
External image search remains desktop-only so the mobile package never sends a
user's search terms to a third party.

Desktop-only blocks use the `STUDYNAV_DESKTOP_ONLY` label. Every mobile build
passes that label to esbuild's `dropLabels`, then tree-shakes and minifies the
result. This is a security and reliability boundary: do not remove or rename
the labels without proving that both mobile bundles still lack the excluded
handlers.

## Excluded mobile behavior

Neither mobile package may contain reachable handlers or UI for:

- verse audio or media audio/video clipping;
- media keyboard controls, player shading/subtitles, transcripts, continue-watching, or separate-window playback;
- image downloads, external image search, or the keyboard publication palette;
- sticky headers, wider article columns, or table restyling;
- offscreen documents, command shortcuts, or JW media-CDN host permission.

Stored desktop flags are normalized through `mobileFlags`. A desktop-only flag
cannot activate a mobile surface even when old settings contain `true`. The next
mobile setting change writes the normalized set back to browser settings
storage. Version 1.6.1 also copies valid 1.6.0 mobile settings once from the old
sync area into local storage without deleting the legacy value; all later
mobile setting writes use local storage.

## Touch behavior

Selecting text on an article or verse shows six colors, Add note, Copy, and Link according to enabled settings. Article actions do not depend on hover. Phone note editors, the study library, and the note drawer fill the viewport without shifting source content. Controls are at least 44 px; popup primary controls are at least 48 px and remain content-sized in Safari's iPad popover; text inputs are at least 16 px to avoid mobile zoom.

## Platform manifests

Safari uses Manifest V3 and an Apple-generated iOS-only Xcode wrapper. Its
extension permissions are `storage` plus the three exact HTTPS site origins.
`bun run verify:studynav:safari` rebuilds the profile, synchronizes the Xcode
resources, runs Apple's packager, and produces an unsigned iOS Simulator build
in disposable DerivedData.

Firefox Android uses non-persistent Manifest V2 because Mozilla recommends that
format for Android extensions and does not support MV3 background service
workers there. The manifest has a stable Gecko ID, Firefox/Android minimum 142,
and the required no-data-collection declaration. `bun run
package:studynav:firefox-android` creates the unsigned AMO upload ZIP.

## Build and release gates

Build desktop and both active mobile packages with `bun run build:studynav`.

Automated acceptance requires:

- TypeScript and unit/localization tests;
- static checks proving both manifests' exact origins and the absence of excluded code, files, and permissions;
- byte-identical Safari/Firefox runtime and UI output;
- Firefox `web-ext lint --warnings-as-errors` with zero warnings;
- the `studynav-mobile` browser scenario with touch input at 390 × 844 and 768 × 1024 on JW and WOL fixtures;
- Apple packager acceptance and an unsigned iOS Simulator build;
- the existing full desktop verification to catch shared-code regressions.

The Firefox Android target is now a Mozilla-signed, self-distributed 1.6.1
prerelease. Its public XPI route, manual install steps, SHA-256, and physical
test boundary are owned by the Pages mobile-beta section and Issue #10. The
signed package content matches the verified candidate and adds only Mozilla
signature records; Firefox 142 on Android 16 Emulator passed the full workflow.
An install from the public asset on physical Android remains mandatory before
claiming device proof, and self-distributed beta updates are manual. AMO listed
distribution remains disabled. A signed 1.6.0 developer build was installed on
an iPhone 15 Pro and exercised against live JW.org, which exposed the multiline
saved-place title, Safari clipboard/new-tab, localization placeholder, and
selection-toolbar stability defects fixed in 1.6.1. The 1.6.1 containing app is
verified in Safari on iPhone 17 and iPad (A16) simulators, including live
Russian-page injection and the iPad popover sizing fix. TestFlight/App Store
and a repeat physical iPhone/iPad pass remain separate Apple gates.

## Local beta release packet

The bilingual listing copy, reviewer steps, exact permissions and origins,
source-archive command, Apple checklist, Mozilla checklist, support/privacy
links, and known provider/device gates live in
`store/mobile/RELEASE-CANDIDATE.md`. The containing Safari app includes
`PrivacyInfo.xcprivacy` with tracking, collected-data, and required-reason API
declarations all empty/disabled. App Store Connect still owns the final
Productivity category and App Privacy form choices; this local packet does not
claim that those provider fields were submitted or approved.
