# StudyNav — Unofficial Study Tools

Unofficial productivity helper for jw.org and wol.jw.org.
Clean-room original — not affiliated with Jehovah’s Witnesses or JW PubMedia One.

## Main workflows

- Open the extension popup for current-page status, a short usage guide, the master switch, and progressively disclosed feature settings.
- Select text inside one article paragraph or Bible verse to highlight it in yellow, green, blue, pink, purple, or orange. Click an existing highlight to add or change its private note in the right rail, create tag chips with comma or Enter, and edit or delete the entry there. **Study library** remains available for searching, backup, and reattaching entries. The selection limit is 10,000 characters.
- Save the current supported page, paragraph, or selected verse under **Saved places**. Exact targets are searchable, removable, and included in the same versioned merge-only JSON backup. Schema-v1 data migrates additively and the legacy key is preserved.
- Use the popup quick actions to copy a formatted online citation, show a locally generated QR for the precise page/paragraph/verse URL, or open a page-derived JW Finder link when the page supplies valid metadata. Select the first verse, choose **Select several**, then select the last verse to copy, cite, save, or link the contiguous range. Shift-click remains an optional shortcut.
- On a supported Bible chapter, select one verse or a contiguous range and choose **Download audio**. StudyNav uses the official JW.org verse markers and chapter audio, processes it locally, and downloads the selected interval as one PCM WAV. English and the canonical Russian and Ukrainian NWT chapter routes are live-verified.
- On supported articles, hover or focus text for Copy and Link. Image downloads are opt-in under **Feature settings** and use a labeled download button beside eligible images. The popup also has a shortcut to the dedicated Google image search for JW.org.
- Press Ctrl/Cmd+Shift+K for quick publication/DOCID search; it expands known mnemonics and IDs into the site's existing search and is not semantic or AI search. Media pages can copy the page URL plus current time, save up to five minutes of audio as WAV or record up to three minutes of video as WebM, move current playback into a second window at the same time, keep Space play/pause reliable, remove player hover shading, and show explicit **Resume at…** controls. Video recording runs locally in real time. The video menu keeps **Transcript** visible and reports clearly when captions are unavailable. Continue-watching progress stays local and never autoplays.
- Sticky header, wider reading column, and table restyling are off by default. Updating from 1.2.3 resets those inherited defaults once while preserving later explicit choices. The sticky option affects JW.org articles; WOL already fixes its own header. Wider text and clearer tables work on both article surfaces with narrowly scoped rules.

Verse audio requires the MV3 `offscreen` permission for browser-native audio decoding and HTTPS access limited to `*.jw-cdn.org`. Local QR encoding uses the audited `qr@0.6.0` package bundled into the extension. StudyNav has no backend, telemetry, arbitrary URL proxy, remote sync, or MP3 encoder.

StudyNav uses `#43669F` as its restrained primary action and selection accent across the popup and injected controls. Chrome selects the complete English or Russian interface from the browser UI locale.

Pages rendered as JW.org `PageNotFound` are treated as unsupported, so StudyNav does not attach controls or dynamic styles to an error document.

Run `bun run build` at the repository root, then load `packages/studynav/dist` as an unpacked extension. Use `bun run verify` before relying on a new build. The public guide is at <https://kiku-jw.github.io/nick-extensions/>.

## Parked Edge on Android package

`bun run build:studynav` creates both `dist/` and `dist-edge-mobile/`. The mobile release was parked by owner decision on August 19, 2026 because the normal Edge Add-ons listing is not installable through ordinary mobile Edge and iPhone support is unavailable. The build remains reproducible reference code, not a supported product. Run `bun run package:studynav:edge-mobile` only when auditing that historical target.

The mobile package intentionally includes only:

- highlights, notes, tag chips, and saved places;
- citations, local QR, and a page-derived clean publication link;
- clean selection copy and precise paragraph/verse links;
- full-article image descriptions and the available-language count;
- the external JW image-search shortcut in the popup.

It compiles out verse audio, media clipping, player controls, transcript, continue-watching, separate-window playback, image downloads, the keyboard palette, and all page-layout modifiers. Its only API permission is `storage`, and its host scope is exactly `jw.org`, `www.jw.org`, and `wol.jw.org`.

The popup and injected panels use safe-area padding, 44–48 px touch targets, 16 px mobile inputs, and full-screen note/library layouts. Text selection exposes Copy and Link alongside the six highlight colors and Add note, so article actions do not depend on hover.

The ZIP is a QA artifact. It must not be described as available on Android or iPhone. Any future return to this lane requires a fresh distribution decision and real-device installation evidence.

## Chrome Web Store desktop package

Run `bun run package:studynav:chrome` at the repository root to rebuild the desktop target and create `studynav-chrome-store.zip`. This Store archive places `manifest.json` at the root and excludes source maps and browser-owned metadata. Listing copy, permission/privacy answers, image assets, certification steps, and release-state boundaries are owned by `docs/STUDYNAV-CHROME-STORE.md`.
