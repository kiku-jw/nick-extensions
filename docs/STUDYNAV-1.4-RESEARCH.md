# StudyNav 1.4 product research

Class: decision record. Owner: `packages/studynav`. Reviewed: 2026-08-16.

## Decision

Add one feature: **local saved places** for the current supported page, paragraph, or Bible verse. Do not add passive history, AI search, feeds, broad downloads, remote/community notes, cross-device sync, or general playlists/trimming in this release.

## Evidence

Official JW Library help describes personal study through highlights, notes, and tags, plus separate bookmarks that can target an article or chapter, a paragraph, or a Bible verse. Its privacy explanation says personal choices and data stay in the app and can be exported for backup. StudyNav already covered the first half of that model in 1.3; an explicit saved-place list was the clearest remaining browser gap.

The JW Web Add-on and JWPUBS Toolbox emphasize context-aware text/media helpers, timestamps, transcripts, downloads, and control by feature. Focused extensions add player shortcuts or a separate multilingual player. Community scripts experiment with notes inside WOL. StudyNav already covers most of the useful in-page and media overlap, so duplicating it would add settings without adding a new workflow.

## Adoption matrix

| Candidate | Decision | Reason |
|---|---|---|
| Page/paragraph/verse saved places | Add | Explicit, low-noise, local, familiar, and not already covered by paragraph links alone |
| Highlights, notes, tags, backup | Keep | Already implemented locally with exact anchors and CSS highlights |
| Passive visit history | Reject | Collects more browsing behavior than needed; explicit saved places are clearer |
| Cross-device sync or community notes | Reject | Requires accounts, backend, conflict policy, and a different privacy boundary |
| AI search | Reject | Adds accuracy, privacy, and remote-processing ambiguity |
| RSS/“what is new” notifications | Reject | Narrower need and background noise; not core to in-page study |
| Bulk or broad media download | Reject | Adds content-handling and permission scope without improving focused study |
| Playlists/general trim | Reject | JW Library already has a mature workflow; StudyNav retains only the focused one-verse clip |
| More reading-layout mutations | Reject | Current compatibility priority is to preserve native JW.org/WOL geometry |

## Sources

- [JW Library feature overview](https://www.jw.org/en/online-help/jw-library/features/)
- [Set and manage bookmarks in JW Library](https://www.jw.org/en/online-help/jw-library/windows/bookmarks/)
- [How JW Library uses personal data](https://www.jw.org/en/privacy-policy/global-policy-personal-data/how-jw-library-uses-data/)
- [Use playlists and trim items](https://www.jw.org/en/online-help/jw-library/use-playlists/)
- [JW Web Add-on feature guide](https://www.jwpubs.org/addon/#addon-feature-guide)
- [JWPUBS Toolbox](https://www.jwpubs.org/tools)
- [JWPUBS Transcript Generator](https://www.jwpubs.org/tools/transcript)
- [JW video player Chrome extension](https://chromewebstore.google.com/detail/jw-video-player/llcdnhpkicpaohifijppfflfbkcblkib)
- [JW.ORG Video Player utility](https://v.jw-net.work/)
- [WOL JW Personal MOD userscript](https://greasyfork.org/scripts/572424-wol-jw-personal-mod)

No source code from third-party proprietary extensions was used. The comparison was limited to public behavior and product shape.
