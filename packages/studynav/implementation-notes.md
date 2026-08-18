# StudyNav implementation notes

Document class: Live contract

Owner sources: `manifest.edge-mobile.json`, `src/features.ts`, `src/build-profile.ts`, `src/content.edge-mobile.css`, and `scripts/build-extension.mjs`.

Update this note whenever the Edge Mobile feature boundary, manifest permissions, build profile, or device-release gate changes.

## Edge Mobile decision

StudyNav Mobile is a second build target of the existing StudyNav codebase, not a fork, web app, or runtime device mode. Both packages share the study-data schema and core study tools. The separate manifest and compile-time profile keep unsupported desktop behavior out of the mobile archive.

The mobile allowlist is owned by `EDGE_MOBILE_FEATURE_IDS`. It contains exactly nine settings: annotations, bookmarks, citations, QR sharing, clean publication links, clean text copy, precise links, image descriptions, and language count. The popup also retains the external JW image-search action.

Desktop-only blocks use the `STUDYNAV_DESKTOP_ONLY` label. The Edge build passes that label to esbuild's `dropLabels`, then tree-shakes and minifies the result. This is a security and reliability boundary: do not remove or rename the labels without proving that the mobile bundle still lacks the excluded handlers.

## Excluded mobile behavior

The Edge Mobile archive must not contain reachable handlers or UI for:

- verse audio or media audio/video clipping;
- media keyboard controls, player shading/subtitles, transcripts, continue-watching, or separate-window playback;
- image downloads or the keyboard publication palette;
- sticky headers, wider article columns, or table restyling;
- offscreen documents, command shortcuts, or JW media-CDN host permission.

Stored desktop flags are normalized through `edgeMobileFlags`. A desktop-only flag cannot activate a mobile surface even when old settings contain `true`. The next mobile setting change writes the normalized set back to sync storage.

## Touch behavior

Selecting text on an article or verse shows six colors, Add note, Copy, and Link according to enabled settings. Article actions do not depend on hover. Phone note editors, the study library, and the note drawer fill the viewport without shifting source content. Controls are at least 44 px; popup primary controls are at least 48 px; text inputs are at least 16 px to avoid mobile zoom.

## Build and release gates

Build both packages with `bun run build:studynav`. Create the Edge Add-ons archive with `bun run package:studynav:edge-mobile`.

Automated acceptance requires:

- TypeScript and unit/localization tests;
- static manifest and bundle checks proving excluded code and permissions are absent;
- the `studynav-edge-mobile` browser scenario at a 390 × 844 viewport on JW and WOL fixtures;
- the existing full desktop verification to catch shared-code regressions.

Publishing is a separate owner-approved action. Before submission, smoke the store package on one current Android device and one current iPhone. Android extension API coverage is documented by Microsoft; iOS is advertised in the mobile collection but is not listed in Microsoft's detailed API platform matrix. Until both device smokes pass, describe the package as prepared for mobile testing—not released or confirmed on iPhone.
