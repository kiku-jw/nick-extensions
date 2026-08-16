# Local-first Chromium extensions

Три локальных Manifest V3 расширения для Brave/Chromium. Код и сборка остаются под контролем владельца: без телеметрии, remote code и магазинного auto-update. InkShade использует явно закреплённый MIT-лицензированный upstream source fork с отдельным брендом и квитанцией происхождения.

## Philosophy

**RU:** Код лежит у вас локально. Обновления — только когда вы сами пересобрали и перезагрузили unpacked. Нет телеметрии, remote code execution или обфускации. Лицензия нашего кода — MIT; сторонние MIT-компоненты и filter-листы сохраняют attribution.

**EN:** Owner-controlled source and builds. Load unpacked and update on your schedule. No telemetry, remote code, or obfuscation. Original code is MIT; third-party MIT components and filter lists retain attribution.

## Products

| Package / stable handle | Display name | Role and highlights |
|-------------------------|--------------|---------------------|
| `packages/clearshield` / ClearShield | **Ad & Tracker Blocker (ClearShield)** | DNR blocker: локальные списки, per-site allowlist, косметическая фильтрация, счётчик блокировок |
| `packages/inkshade` / InkShade | **InkShade – Dark Mode for Every Site** | Store-oriented local-first fork of the Dark Reader v4.9.129 MV3 engine and bundled site fixes; distinct branding, no news/telemetry/premium/remote config |
| `packages/studynav` / StudyNav | **StudyNav — Unofficial Study Tools** | Локальные подсветки/заметки/теги и сохранённые места, цитаты и QR, continue-watching, выбор стиха → локальный WAV только этого стиха, copy/link и reading/media helpers |

StudyNav — **неофициальный** helper, не связан с JW.org / Watch Tower / JW PubMedia One / JW Web Add-on.

Полное двуязычное руководство со скриншотами и видео: <https://kiku-jw.github.io/nick-extensions/>.

## Build

```bash
bun install --frozen-lockfile
bun run bootstrap:inkshade
bun run browser:install # один раз для browser matrix
bun run fetch:easylist   # optional but recommended for ClearShield
bun run build
bun run smoke-check
```

Полная проверка:

```bash
bun run verify
```

`verify` запускает TypeScript, unit-тесты монорепозитория и upstream InkShade, чистую сборку, проверку Manifest/DNR и browser matrix: без расширения, с ним, с off/allowlist, через popup/options и при совместной работе трёх расширений. Публичные smoke-сравнения добавляют ClearShield на `animevost.org` и StudyNav на `jw.org`; сетевой SKIP не выдаётся за продуктовый PASS.

`bun run package:dist` пересобирает и обновляет `dist-smoke.zip`, исключая Chromium-owned `_metadata`.

Artifacts:

- `packages/clearshield/dist`
- `packages/inkshade/dist`
- `packages/studynav/dist`

## Load in Brave

1. Open `brave://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select each package's `dist/` folder, not the package source folder
4. After code changes: rebuild, then click Reload on each card. InkShade 2.0 uses the card name `InkShade – Dark Mode for Every Site`; disable other dark-mode extensions on the same pages to avoid engine conflicts.

## Use StudyNav

1. Click the extension icon to see what is available on the current page. The main switch controls all StudyNav behavior; individual settings stay under **Feature settings**.
2. Select text inside one paragraph or verse to highlight it in one of six colors, optionally add a private note and tags, and review it in the non-overlapping notes rail or **Study library**. Save the current page, paragraph, or verse under **Saved places**. Notes, saved places, and watch progress stay in local extension storage; JSON export/import provides a manual backup.
3. Use **Copy citation**, **Show QR**, or **Open stable publication link** for page-derived sharing and research actions. Shift-click two verse numbers in one chapter to copy, cite, save, or link the whole contiguous range. QR generation is local and the displayed target URL remains visible.
4. On a JW.org Bible chapter, click one verse number. **Download audio** appears beside that selected verse. The extension reads JW.org's official timing marker, downloads the official chapter audio locally, and saves only the selected interval as WAV. No audio is uploaded. English and canonical Russian/Ukrainian routes are covered by live end-to-end checks.
5. On articles, hover or keyboard-focus supported text for Copy and Link. Image downloads are off by default; enable **Download article images** to add a labeled download button. The popup can also open the dedicated Google image search for JW.org. On media pages, copy the page and current time, download a chosen audio interval as WAV or record a video interval as WebM, open a playback-only second window, use reliable Space play/pause, remove hover shading, and resume from locally saved progress. Transcript search is offered only when the player exposes captions.
6. Layout-changing helpers are off by default. Updating from StudyNav 1.2.3 resets those three old defaults once; later explicit choices are preserved. StudyNav always preserves WOL's native layout even if the flags are enabled; on JW.org those helpers remain explicit opt-ins with narrow selectors.

## Updates policy

You control the local working copy. There is no extension-store auto-update channel in this workflow. Prefer reviewing source changes before rebuilding.

Current test contract and interpretation: `docs/SMOKE.md`.
InkShade store/privacy contract: `docs/INKSHADE-STORE.md`.
