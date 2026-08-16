# Architecture

Monorepo (`packages/*`) built with TypeScript + esbuild (WXT-class DX deferred; esbuild keeps the build deterministic and small).

## Shared

`@nick/shared` — tiny helpers (tab query, clipboard, storage). Bundled into each extension entry via alias; no runtime remote imports.

## ClearShield

- MV3 service worker manages `declarativeNetRequest` static rule_resources (`baseline`, `easylist`, `easyprivacy`) and dynamic allowlist rules.
- Popup / options talk via `chrome.runtime.sendMessage`.
- Content script injects a small cosmetic CSS list.
- Filter conversion happens **at build time** (`scripts/fetch-and-convert.mjs`), never by fetching rules inside the extension at runtime.

## InkShade

- Source-level fork of Dark Reader v4.9.129 pinned in `packages/inkshade/upstream`; provenance and license live beside the package.
- MV3 uses a dedicated MAIN-world stylesheet proxy plus isolated fallback, dynamic-engine, and color-scheme content scripts.
- The dynamic engine handles CSS variables, gradients, inline styles, shadow DOM, media analysis, dynamic DOM, iframes, and bundled per-site fixes.
- The downstream patch set owns InkShade branding and removes upstream news, donation, premium, uninstall-survey, remote-config, and default sync surfaces.
- The wrapper build produces `packages/inkshade/dist`, overlays InkShade icons, keeps only reviewed `en`/`ru`/`uk` locales, and copies the upstream MIT notice.
- Future engine updates are explicit reviewed source merges, never runtime code or configuration downloads.

## StudyNav

- Page access is limited to JW.org/WOL/Stream hosts; separate HTTPS `*.jw-cdn.org` access is used only for official verse timing and chapter audio.
- Feature flags live in `chrome.storage.sync`; bounded versioned annotations, saved places, and media progress live only in `chrome.storage.local`.
- Route/DOM support gates fail closed and teardown every owned node, style, and listener when disabled or unsupported.
- A guarded mutation coordinator disconnects the observer during reconciliation so StudyNav cannot trigger an endless teardown/remount loop from its own DOM writes.
- A bounded URL watcher catches site-owned `history.pushState` changes that an isolated content-script world cannot intercept reliably.
- Reading-width and table CSS target only article roots marked after support detection; similarly named site dialogs remain untouched.
- Language counting accepts only real `<select>` nodes, because live jw.org currently creates a same-ID autocomplete `<input>` beside the 564-option chooser.
- Command palette (Ctrl/Cmd+Shift+K) resolves public mnemonic/DOCID patterns to search/navigation URLs.
- Four-color annotations use the CSS Custom Highlight API and exact text selectors without rewriting source text nodes. Page/paragraph/verse saved places, review/search, merge-only JSON backup, additive v1-to-v2 migration, and orphan recovery share one serialized local storage adapter.
- Browser-locale catalogs provide complete English and Russian manifest, popup, injected, dialog, error, and accessibility UI.
- Citations and official Finder links are derived from validated current-page metadata. QR SVG generation is bundled and local; no QR request leaves the browser.
- Continue-watching records bounded local HTML-video progress and resumes only after an explicit click. Selected-verse audio is decoded and clipped as WAV in an MV3 offscreen document.

## Verification architecture

- Bun covers monorepo pure logic and lifecycle/concurrency regressions; the pinned InkShade fork retains its upstream Jest unit suite and release linter.
- Playwright Chromium uses disposable persistent contexts and temporary copies of each unpacked `dist/`.
- Local fixtures make baseline/enabled/off comparisons deterministic and mirror the live duplicate-ID language chooser; public ClearShield and StudyNav smokes are supplemental and transport failures are explicit skips.
