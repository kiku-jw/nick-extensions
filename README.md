# Local-first browser extensions

Три расширения для Chrome, Edge, Brave и других Chromium-браузеров на компьютере. StudyNav 1.6.1 одобрен и доступен в Chrome Web Store. Mozilla подписала отдельную StudyNav Mobile 1.6.1 beta для Firefox 142+ на Android; её публичный XPI и инструкция находятся на странице руководства. Общий мобильный код прошёл полный прогон на Android 16 Emulator, но установка по публичной ссылке на физическом телефоне остаётся отдельной проверкой. Safari-пакет для iPhone/iPad проверен на симуляторах и всё ещё ожидает TestFlight. Код и сборка остаются под контролем владельца: без телеметрии и remote code. InkShade использует явно закреплённый MIT-лицензированный upstream source fork с отдельным брендом и квитанцией происхождения.

## Philosophy

**RU:** Код открыт и собирается локально. Магазинные сборки обновляются только после публикации проверенного релиза; unpacked-сборки — когда вы сами их пересобрали и перезагрузили. Нет телеметрии, remote code execution или обфускации. Лицензия нашего кода — MIT; сторонние MIT-компоненты и filter-листы сохраняют attribution.

**EN:** Owner-controlled source and builds. Store builds update only after a reviewed release is published; unpacked builds update on your schedule. No telemetry, remote code, or obfuscation. Original code is MIT; third-party MIT components and filter lists retain attribution.

## Products

| Package / stable handle | Display name | Role and highlights |
|-------------------------|--------------|---------------------|
| `packages/clearshield` / ClearShield | **Ad & Tracker Blocker (ClearShield)** | DNR blocker: локальные списки, per-site allowlist, косметическая фильтрация, счётчик блокировок |
| `packages/inkshade` / InkShade | **InkShade – Dark Mode for Every Site** | Store-oriented local-first fork of the Dark Reader v4.9.129 MV3 engine and bundled site fixes; distinct branding, no news/telemetry/premium/remote config |
| `packages/studynav` / StudyNav | **StudyNav — Unofficial Study Tools** | Локальные подсветки/заметки/теги и сохранённые места, цитаты и QR, continue-watching, выбор одного или нескольких стихов подряд → один локальный WAV, copy/link и reading/media helpers |
| `packages/studynav` / StudyNav Mobile | **StudyNav Mobile — Unofficial Study Tools** | Общий облегчённый профиль 1.6.1 для Safari на iPhone/iPad и Firefox на Android; подписанная Android beta опубликована как GitHub prerelease, TestFlight для iPhone/iPad ещё впереди |

StudyNav — **неофициальный** helper, не связан с JW.org / Watch Tower / JW PubMedia One / JW Web Add-on.

Установка настольной версии из Chrome Web Store: <https://chromewebstore.google.com/detail/bjgaghgbmghohpahonodejobgflpcbai>. Полное двуязычное руководство со скриншотами, видео и Android beta: <https://kiku-jw.github.io/nick-extensions/>.

## Установка StudyNav Mobile beta на Android

Нужен Firefox 142 или новее. Chrome, Edge и Brave на Android этот пакет не устанавливают.

1. Откройте <https://kiku-jw.github.io/nick-extensions/ru/#mobile-beta> в Firefox для Android и скачайте подписанный XPI.
2. Откройте **Настройки → О Firefox** и быстро нажмите логотип Firefox пять раз.
3. Вернитесь в Настройки и выберите **Установить расширение из файла**.
4. Откройте `StudyNav-Mobile-1.6.1-Firefox-Android.xpi`, проверьте доступ и нажмите **Добавить**.

Это самостоятельно распространяемая бета-версия, поэтому обновления устанавливаются вручную. Подписанный XPI имеет SHA-256 `9d54e32552ea048773b09bcbac926d155f60ec4f7d3db4625b15f8731fbb8c5c`.

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
- `packages/studynav/dist-safari-ios`
- `packages/studynav/dist-firefox-android`

Firefox Android ZIP для проверки и будущей отправки в AMO:

```bash
bun run package:studynav:firefox-android
```

Результат: `packages/studynav/studynav-firefox-android.zip`. Это воспроизводимый **неподписанный** пакет для отправки в AMO, а не пользовательская установка. Пользователям предназначен только Mozilla-подписанный XPI из публичного prerelease.

Safari‑приложение и расширение находятся в `packages/studynav/apple/StudyNav`. Команда ниже пересобирает веб‑часть, синхронизирует Xcode‑ресурсы, повторно проверяет их официальным упаковщиком Apple и выполняет unsigned Simulator build:

```bash
bun run verify:studynav:safari
```

Для обычной пользовательской установки на iPhone/iPad всё ещё нужны TestFlight или App Store. Более ранняя подписанная developer-сборка устанавливалась на физический iPhone 15 Pro, но текущая 1.6.1 пока проверена только на симуляторах и требует повторного прогона на устройстве через подписанный канал.

Проверенный ZIP настольной версии для Chrome Web Store:

```bash
bun run package:studynav:chrome
```

Результат: `packages/studynav/studynav-chrome-store.zip`. Архив содержит `manifest.json` в корне и не включает source maps или браузерный `_metadata`. Контракт карточки и проверки: `docs/STUDYNAV-CHROME-STORE.md`.

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
5. On articles, select the words you need; the action bar then offers highlight colors, Add note, Copy, and Link without covering the article on hover. Image downloads are off by default; enable **Download article images** to add a labeled button only to full article images, not compact publication previews. The popup can also open the dedicated Google image search for JW.org. On media pages, copy the page and current time, save up to five minutes of audio as WAV or three minutes of video as WebM, move playback to a separate window at the same point, use reliable Space play/pause, remove hover shading, and resume from locally saved progress. **Transcript** remains visible for video and explains when captions are unavailable.
6. Layout-changing helpers are off by default. Updating from StudyNav 1.2.3 resets those three old defaults once; later explicit choices are preserved. The sticky-header option changes JW.org articles; WOL already pins its own header. Wider text and clearer tables work on JW.org and WOL articles with narrow selectors.

## StudyNav Mobile beta preparation

Одна облегчённая версия собирается в два платформенных пакета: Manifest V3 внутри Safari‑приложения для iPhone/iPad и рекомендованный Mozilla Manifest V2 для Firefox на Android. Старый Edge Android пакет остаётся только архивным воспроизводимым target: обычная карточка Edge Add-ons не дала пользователям рабочей мобильной установки.

Жёсткий общий список из девяти проверяемых функций включает:

- выделения шести цветов, заметки и теги;
- сохранённые места;
- оформленные цитаты и QR;
- чистое копирование выделенного текста и точная ссылка;
- чистая ссылка публикации;
- описания крупных изображений и число доступных языков.

На сенсорном экране после выделения текста появляются **Цвет**, **Добавить заметку**, **Копировать** и **Ссылка**. Заметка открывается на весь экран, а её теги превращаются в отдельные чипы после запятой или Enter. Внешний поиск картинок остаётся только в настольном StudyNav: мобильный пакет не передаёт поисковые фразы стороннему сервису.

В мобильные пакеты намеренно не входят аудио стихов, обрезка аудио/видео, функции плеера, транскрипт, отдельное окно, скачивание изображений, клавиатурный поиск и изменения ширины/шапки/таблиц. Они используют только хранилище браузера и доступ к `jw.org`, `www.jw.org` и `wol.jw.org`; медиадомен и offscreen‑документ отсутствуют.

Автоматические проверки доказывают одинаковый runtime обоих пакетов, touch‑интерфейс, отсутствие настольных функций, Firefox lint без предупреждений, упаковку Apple и сборку для iOS Simulator. Safari 1.6.1 прошёл проверки на симуляторах iPhone и iPad. Firefox 142 на Android 16 Emulator прошёл все девять функций, поворот экрана, крупный текст, работу офлайн с сохранёнными данными, перезапуск и реальное обновление 1.6.0 → 1.6.1 без потери заметки, тегов и сохранённого места.

Android beta 1 подписана производственной службой Mozilla и опубликована как публичный GitHub prerelease. Подпись, манифест, разрешения, SHA-256 и анонимное скачивание проверяются как отдельные релизные доказательства; полный runtime уже прошёл на Firefox 142 в Android 16 Emulator. Установка этого публичного XPI на физическом Android ещё не подтверждена, поэтому доступность файла не выдаётся за доказанную работу на телефоне. Для iPhone/iPad выбран TestFlight: текущая 1.6.1 ещё не прошла повторный физический прогон и не загружалась в Apple.

## Updates policy

Unpacked builds update only when you rebuild and reload them. Store-installed builds update through their browser's extension-store channel after a reviewed release is published. The self-distributed Firefox Android beta has no automatic update route; install each newer signed XPI manually after exporting a Study library backup.

Current test contract and interpretation: `docs/SMOKE.md`.
InkShade store/privacy contract: `docs/INKSHADE-STORE.md`.
StudyNav Android Edge Add-ons contract: `docs/STUDYNAV-EDGE-STORE.md`.
StudyNav desktop Chrome Web Store contract: `docs/STUDYNAV-CHROME-STORE.md`.
