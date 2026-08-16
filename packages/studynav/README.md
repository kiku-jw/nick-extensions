# StudyNav — Unofficial Study Tools

Unofficial productivity helper for jw.org / wol.jw.org / stream.jw.org.
Clean-room original — not affiliated with Jehovah’s Witnesses or JW PubMedia One.

## Main workflows

- Open the extension popup for current-page status, a short usage guide, the master switch, and progressively disclosed feature settings.
- Select text inside one article paragraph or Bible verse to highlight it in yellow, green, blue, pink, purple, or orange. Add an optional private note and tags, then review, search, edit, delete, or reattach it from the non-overlapping notes rail or **Study library**. The selection limit is 10,000 characters.
- Save the current supported page, paragraph, or selected verse under **Saved places**. Exact targets are searchable, removable, and included in the same versioned merge-only JSON backup. Schema-v1 data migrates additively and the legacy key is preserved.
- Use the popup quick actions to copy a formatted online citation, show a locally generated QR for the precise page/paragraph/verse URL, or open a page-derived JW Finder link when the page supplies valid metadata. Shift-click two verse numbers in one chapter to copy, cite, save, or link that contiguous range.
- On a supported Bible chapter, select one verse number and choose **Download audio**. StudyNav uses the official JW.org verse marker and chapter audio, processes it locally, and downloads only that verse as PCM WAV. English and the canonical Russian and Ukrainian NWT chapter routes are live-verified.
- On supported articles, hover or focus text for Copy and Link. Image downloads are opt-in under **Feature settings** and use a labeled download button beside eligible images. The popup also has a shortcut to the dedicated Google image search for JW.org.
- Press Ctrl/Cmd+Shift+K for quick publication/DOCID search; it expands known mnemonics and IDs into the site's existing search and is not semantic or AI search. Media pages can copy the page URL plus current time, save up to two minutes of audio as WAV or record up to one minute of video as WebM, open a playback-only second window, keep Space play/pause reliable, remove player hover shading, and show explicit **Resume at…** controls. Video recording runs locally in real time. Transcript search is offered only when captions exist. Continue-watching progress stays local and never autoplays.
- Sticky header, wider reading column, and table restyling are off by default. Updating from 1.2.3 resets those inherited defaults once while preserving later explicit choices. WOL always keeps its native layout even when the flags are enabled; JW.org applies them only as explicit, narrowly scoped opt-ins.

Verse audio requires the MV3 `offscreen` permission for browser-native audio decoding and HTTPS access limited to `*.jw-cdn.org`. Local QR encoding uses the audited `qr@0.6.0` package bundled into the extension. StudyNav has no backend, telemetry, arbitrary URL proxy, remote sync, or MP3 encoder.

StudyNav uses `#43669F` as its restrained primary action and selection accent across the popup and injected controls. Chrome selects the complete English or Russian interface from the browser UI locale.

Pages rendered as JW.org `PageNotFound` are treated as unsupported, so StudyNav does not attach controls or dynamic styles to an error document.

Run `bun run build` at the repository root, then load `packages/studynav/dist` as an unpacked extension. Use `bun run verify` before relying on a new build. The public guide is at <https://kiku-jw.github.io/nick-extensions/>.
