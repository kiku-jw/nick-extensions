# Local-first Chromium and Edge extensions

Три локальных Manifest V3 расширения для Brave/Chromium и отдельная осторожная сборка StudyNav для Edge Mobile. Код и сборка остаются под контролем владельца: без телеметрии и remote code. InkShade использует явно закреплённый MIT-лицензированный upstream source fork с отдельным брендом и квитанцией происхождения.

## Philosophy

**RU:** Код лежит у вас локально. Обновления — только когда вы сами пересобрали и перезагрузили unpacked. Нет телеметрии, remote code execution или обфускации. Лицензия нашего кода — MIT; сторонние MIT-компоненты и filter-листы сохраняют attribution.

**EN:** Owner-controlled source and builds. Load unpacked and update on your schedule. No telemetry, remote code, or obfuscation. Original code is MIT; third-party MIT components and filter lists retain attribution.

## Products

| Package / stable handle | Display name | Role and highlights |
|-------------------------|--------------|---------------------|
| `packages/clearshield` / ClearShield | **Ad & Tracker Blocker (ClearShield)** | DNR blocker: локальные списки, per-site allowlist, косметическая фильтрация, счётчик блокировок |
| `packages/inkshade` / InkShade | **InkShade – Dark Mode for Every Site** | Store-oriented local-first fork of the Dark Reader v4.9.129 MV3 engine and bundled site fixes; distinct branding, no news/telemetry/premium/remote config |
| `packages/studynav` / StudyNav | **StudyNav — Unofficial Study Tools** | Локальные подсветки/заметки/теги и сохранённые места, цитаты и QR, continue-watching, выбор одного или нескольких стихов подряд → один локальный WAV, copy/link и reading/media helpers |
| `packages/studynav` / StudyNav Mobile | **StudyNav Mobile — Unofficial Study Tools** | Отдельный пакет для Edge на телефонах: подсветки, заметки и теги, сохранённые места, цитаты, QR, чистое копирование, точные ссылки, описания изображений и число языков; без медиазагрузок и изменений вёрстки |

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
- `packages/studynav/dist-edge-mobile`

Мобильный пакет и ZIP для отправки в Edge Add-ons:

```bash
bun run package:studynav:edge-mobile
```

Результат: `packages/studynav/studynav-edge-mobile.zip`. Это пакет для проверки и отправки в магазин, а не готовый способ установки на телефон. Друзья смогут поставить расширение на мобильный Edge после публикации в Edge Add-ons.

## Load in Brave

1. Open `brave://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select each package's `dist/` folder, not the package source folder
4. After code changes: rebuild, then click Reload on each card. InkShade 2.0 uses the card name `InkShade – Dark Mode for Every Site`; disable other dark-mode extensions on the same pages to avoid engine conflicts.

## Use StudyNav

1. Click the extension icon to see what is available on the current page. The main switch controls all StudyNav behavior; individual settings stay under **Feature settings**.
2. Select text inside one paragraph or verse to highlight it in one of six colors. Click the highlight to add or edit its note in the right rail; comma or Enter turns each tag into a chip, and edit/delete controls stay visible beside the note. **Study library** provides search and JSON backup. Save the current page, paragraph, or verse under **Saved places**. Notes, saved places, and watch progress stay in local extension storage.
3. Use **Copy citation**, **Show QR**, or **Open clean publication link** for page-derived sharing and research actions. Select the first verse, choose **Select several**, then select the last verse to copy, cite, save, or link the whole contiguous range. Shift-click remains an optional shortcut. QR generation is local and the displayed target URL remains visible.
4. On a JW.org Bible chapter, select one verse or a contiguous range. **Download audio** saves the selected narration as one WAV. The extension reads JW.org's official timing markers and processes the official chapter audio locally; no audio is uploaded. English and canonical Russian/Ukrainian routes are covered by live end-to-end checks.
5. On articles, hover or keyboard-focus supported text for Copy and Link. Image downloads are off by default; enable **Download article images** to add a labeled button only to full article images, not compact publication previews. The popup can also open the dedicated Google image search for JW.org. On media pages, copy the page and current time, save up to five minutes of audio as WAV or three minutes of video as WebM, move playback to a separate window at the same point, use reliable Space play/pause, remove hover shading, and resume from locally saved progress. **Transcript** remains visible for video and explains when captions are unavailable.
6. Layout-changing helpers are off by default. Updating from StudyNav 1.2.3 resets those three old defaults once; later explicit choices are preserved. The sticky-header option changes JW.org articles; WOL already pins its own header. Wider text and clearer tables work on JW.org and WOL articles with narrow selectors.

## StudyNav Mobile for Edge

Мобильная версия собирается из того же кода, но имеет отдельный manifest и жёсткий список из девяти проверяемых функций:

- выделения шести цветов, заметки и теги;
- сохранённые места;
- оформленные цитаты и QR;
- чистое копирование выделенного текста и точная ссылка;
- чистая ссылка публикации;
- описания крупных изображений и число доступных языков.

Поиск картинок JW через Google остаётся отдельной кнопкой в меню. На сенсорном экране после выделения текста появляются **Цвет**, **Добавить заметку**, **Копировать** и **Ссылка**. Заметка открывается на весь экран, а её теги превращаются в отдельные чипы после запятой или Enter.

В мобильный пакет намеренно не входят аудио стихов, обрезка аудио/видео, функции плеера, транскрипт, отдельное окно, скачивание изображений, клавиатурный поиск и изменения ширины/шапки/таблиц. Manifest запрашивает только `storage` и доступ к `jw.org`, `www.jw.org` и `wol.jw.org`; медиадомен и offscreen-документ отсутствуют.

Microsoft публикует мобильные расширения Edge для Android и iOS. Официальная таблица API явно перечисляет Android для `action`, `runtime`, `storage`, `tabs` и `i18n`, но не содержит отдельной колонки iOS. Поэтому автоматическая Chromium-проверка не заменяет финальный smoke на настоящем Android и iPhone. Публичную инструкцию и магазинную ссылку нужно добавлять только после этих двух проверок и одобрения владельца на отправку в Edge Add-ons.

## Updates policy

You control the local working copy. There is no extension-store auto-update channel in this workflow. Prefer reviewing source changes before rebuilding.

Current test contract and interpretation: `docs/SMOKE.md`.
InkShade store/privacy contract: `docs/INKSHADE-STORE.md`.
