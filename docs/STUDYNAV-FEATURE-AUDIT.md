# StudyNav feature audit

Date: 2026-08-15

Historical 1.3 decision record. The current 1.4 comparison and saved-place decision live in `docs/STUDYNAV-1.4-RESEARCH.md`.

## Decision

The next substantial StudyNav feature should be local annotations: text highlights, notes, tags, review/search, and JSON backup/restore. This is more useful and more differentiated than copying another download or search utility. It must be a separate release after the 1.2.4 layout-safety repair.

## Compared surfaces

- [JW Web Add-on feature guide](https://www.jwpubs.org/addon/#addon-feature-guide)
- [JWPUBS Toolbox](https://www.jwpubs.org/tools)
- [JWPUBS Text Marker](https://www.jwpubs.org/tools/textmarker)
- [JWPUBS Transcript Generator](https://www.jwpubs.org/tools/transcript)
- [JWPUBS Bulk Download](https://www.jwpubs.org/tools/bulkdownload)
- [JWPUBS AI Search](https://www.jwpubs.org/tools/ai)

The add-on guide currently groups its features into text, media, and general helpers. StudyNav already overlaps the most useful reading and media surfaces: publication search, alt text, copy, table/width options, language count, paragraph links, sticky header, image download, player/subtitle/keyboard helpers, timestamp links, second display, and transcripts. StudyNav also has a distinct selected-verse audio workflow.

The most useful gaps are:

1. Local highlights, notes, and tags.
2. A formatted online citation action.
3. Continue-watching state for media.
4. Lower-priority QR/open-in-app shortcuts.

JWPUBS Text Marker is not an annotation system: it creates a URL to a counted paragraph for later navigation or sharing and explicitly does not support Online Bible pages. StudyNav already has paragraph links, so duplicating Text Marker would add little value.

## Local annotations: proposed 1.3 contract

### User workflow

1. Select text, a paragraph, or a Bible verse.
2. Choose one of four restrained marker colors.
3. Optionally attach a note and one or more tags.
4. Reopen, edit, or delete it from the page or a review panel.
5. Search/filter by text, note, tag, publication, language, or date.
6. Export and import a versioned JSON backup.

### Storage and privacy

- Store annotations in `chrome.storage.local`; do not send them to a server or telemetry endpoint.
- Do not use `storage.sync` for the annotation corpus. Chrome documents `storage.local` as approximately 10 MB and `storage.sync` as approximately 100 KB total with an 8 KB per-item quota.
- Explain that uninstalling the extension clears extension-local storage, so export/import is part of the first release, not a later extra.
- Store only anchors, selected text, note text, tags, color, timestamps, and document identity. Do not cache article bodies, audio, or images.

Reference: [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage).

### Stable anchoring

Use a versioned record with:

- canonical document URL plus locale and available JW document/fragment identifiers;
- paragraph or verse fragment ID when available;
- exact selected quote plus short prefix/suffix context;
- text position only as a fallback;
- color, note, tags, created/updated timestamps.

This follows the resilience model of W3C `TextQuoteSelector`: exact text plus prefix/suffix survives more document edits than a bare character offset. Reference: [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/).

### Rendering without layout drift

Render ranges with the CSS Custom Highlight API where supported. It styles `Range` objects without inserting wrapper elements into the article DOM, so highlighting does not change line boxes or document structure. Reference: [CSS Custom Highlight API](https://www.w3.org/TR/css-highlight-api-1/).

Acceptance must cover reload, Russian and Ukrainian pages, text changes, duplicate quotes, missing/orphaned anchors, SPA navigation, deletion, and JSON round-trip recovery.

## Do not prioritize next

- AI Search: it leaves the official-site context, adds accuracy/privacy ambiguity, and JWPUBS itself warns users to verify results.
- Bulk Download and Image Search: broad download/search scope does not strengthen the core study workflow and raises more permission and content-handling questions.
- A second Text Marker implementation: paragraph links already cover the useful part.
- RSS subscriptions: useful for a narrower audience, but weaker than annotations and continue-watching.

## Delivery order

1. StudyNav 1.2.4: layout isolation and safe defaults.
2. StudyNav 1.3: local annotations with backup/recovery.
3. A small follow-up: online citation and continue-watching, only after annotation behavior is stable.
