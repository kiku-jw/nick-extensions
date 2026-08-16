# Threat model

## Why self-owned extensions

Browser extensions are high privilege. Upstream auto-update is a supply-chain trust decision. This repository favors code users can read, build, and pin.

## Assets

- Browsing traffic metadata / blocked network requests (ClearShield)
- Page DOM on visited sites (InkShade, StudyNav on jw.org only)
- Settings in `chrome.storage.sync`
- StudyNav highlights, notes, tags, saved places, and media progress in `chrome.storage.local`

## Non-goals / hard rules

- No telemetry endpoints
- No remote code execution / eval of remote scripts
- No obfuscated bundles
- No `<all_urls>` for StudyNav
- Filter lists and InkShade site-fix catalogs are bundled at build time, not silently swapped at runtime

## Update policy

1. Review the source diff or the public Git history.
2. Rebuild
3. Reload the unpacked extension in Brave/Chrome
4. Optional: keep a previous `dist/` zip as rollback

## Residual risks

- Site DOM changes can break StudyNav selectors (maintenance required)
- StudyNav treats public JW DOM as untrusted input: duplicate IDs and non-select autocomplete nodes must not abort a feature pass
- StudyNav personal study data is local to the browser profile, is not encrypted by the extension, and is not remotely synchronized. Its versioned JSON export is an explicit user-controlled backup file; v1 migration is additive and the legacy key is retained.
- StudyNav fetches only page-selected official JW CDN metadata/audio for verse clipping. Audio decoding, WAV clipping, annotation rendering, citation formatting, QR generation, and progress tracking remain local.
- DNR feedback / badge counts are best-effort and may require Chrome’s debug event (not always available)
- EasyList conversion is a subset — not equivalent to a full blocker engine
- InkShade and ClearShield require broad page access to perform their stated functions; they keep processing local and make no telemetry requests
- InkShade tracks a pinned MIT-licensed upstream source revision. Its release removes upstream news, donation, premium, uninstall-survey, and remote-config surfaces; updates require explicit review and a fresh full gate
- InkShade requests page-owned stylesheets and images when required for local color analysis. These requests target resources already referenced by the visited page, not KikuAI infrastructure
- The automated browser matrix uses disposable profiles and temporary extension copies; it must never point at a personal browser profile
- Chrome automation cannot inspect the native context-menu surface directly; the menu registration/listener is structural evidence, while its shared site-toggle path is exercised through the popup
