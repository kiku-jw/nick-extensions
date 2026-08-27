# StudyNav Chrome Web Store release contract

Class: live release contract. Owner: `packages/studynav`. Canonical task:
`kiku-jw/nick-extensions#9`. Update whenever the desktop package, permissions,
privacy behavior, Store copy, assets, testing boundary, or provider state
changes.

## Product identity

- Name: **StudyNav — Unofficial Study Tools**
- Publisher: **KikuAI Lab**
- Public Store version: **1.6.1**
- Provider state: **approved, public, and installed Store build verified**
- Platform: Chrome, Edge, Brave, and compatible Chromium browsers on a computer
- Category: **Productivity**
- Language: English default; Russian localized listing and interface
- Website: `https://kiku-jw.github.io/nick-extensions/`
- Privacy: `https://kiku-jw.github.io/nick-extensions/privacy/`
- Support: `https://github.com/kiku-jw/nick-extensions/issues`
- Source: `https://github.com/kiku-jw/nick-extensions`
- Independent product: not produced, maintained, supported, or endorsed by
  Jehovah's Witnesses.

Next desktop candidate: **1.6.2**, not yet uploaded or submitted. It removes
paragraph actions that appeared on hover over reading text. The same highlight,
note, Copy, and Link actions now appear only after a deliberate text selection;
the selection action bar stays at the opposite viewport edge. Element-boundary
selections are normalized against clean source text, so a valid short selection
no longer receives the 10,000-character error. Issue:
`https://github.com/kiku-jw/nick-extensions/issues/11`.

## Current release state

Record these independently; never infer a later state from an earlier one:

1. source verified;
2. Store ZIP generated and hashed;
3. item created in the Developer Dashboard;
4. listing and privacy fields saved;
5. submitted for review;
6. approved;
7. publicly installable;
8. installed Store build passes a desktop smoke test.

The exact current provider state and item URL belong in GitHub Issue #9. Do not
put a guessed Store URL in the public guide.

Submission receipt (2026-08-25): the verified 1.6.1 ZIP from
source commit `bd78c5f0d11d3618b8bb02baf58d66e0948ed437` was uploaded and
submitted as dashboard revision `00002`. The submitted archive is 132,011
bytes with SHA-256
`5e72ed4f4fd14299a9cda9f461186ed6d0471de41d0d0fb544d53c6c20da2644`.
The dashboard readback identifies version 1.6.1, English and Russian, and the
same `storage`, `offscreen`, and host-permission boundary. It confirmed that the
extension was submitted and reported **Awaiting review** / **Draft is awaiting
review**. The automatic-publication checkbox was selected in the submission
dialog. This dated receipt records the submission boundary; the current public
state is recorded separately below.

Latest public-provider receipt (2026-08-27): Chrome Web Store item
`bjgaghgbmghohpahonodejobgflpcbai` is approved and publicly installable. A
logged-out request to the item-ID URL returns HTTP 200, identifies version
1.6.1, and exposes **Add to Chrome**. Google's production update service also
returns version 1.6.1 and a public CRX update. The Store-installed copy in Brave
reports version 1.6.1. Its executable files and localized content match the
submitted ZIP; Chrome added only its signing key, update URL, browser metadata,
and JSON formatting. A fresh smoke run from those installed Store files passed
the `studynav-only`, `studynav-study-suite`, and `studynav-russian-locale`
scenarios: 84 assertions, zero failures, zero skips, zero page errors, and zero
extension-console errors. Public item:
`https://chromewebstore.google.com/detail/bjgaghgbmghohpahonodejobgflpcbai`.

## Single purpose

Add local annotation, navigation, copying, and user-requested media tools to
public JW.org and WOL study pages.

## English listing

### Short summary

Local highlights, notes, exact links, verse audio, and media tools for public
JW.org and WOL pages. No telemetry.

### Detailed description

StudyNav adds practical study tools to public JW.org and WOL pages on your
computer.

Select text to highlight it in one of six colors, then add a private note and
tags beside the page. Save the exact page, paragraph, verse, or consecutive
verse range and find it later in Study library. Copy clean text, a formatted
citation, or a precise link, and show a local QR code for the current place.

On a Bible chapter, select one verse or several consecutive verses and download
their narration as one WAV file. On supported media pages, copy a link at the
current time, save a short audio or video segment, search an available
transcript, continue from locally saved progress, or move playback to a separate
window. StudyNav also provides optional image and reading-layout helpers.

Highlights, notes, tags, saved places, settings, and media progress remain in
browser storage. StudyNav has no account, advertising, analytics, telemetry, or
remote note service. Official image and media files are requested only after
you press the corresponding action and are processed locally. Google image
search opens only after you submit a query.

StudyNav works only on jw.org, www.jw.org, and wol.jw.org, with official
JW media-host access limited to user-requested downloads and clips. It contains
no remotely executed code.

StudyNav is an independent, unofficial open-source project. It is not produced,
maintained, supported, or endorsed by Jehovah's Witnesses.

## Russian listing

### Short summary

Выделения, заметки, точные ссылки, аудио стихов и медиа-инструменты для открытых
страниц JW.org и WOL. Без телеметрии.

### Detailed description

StudyNav добавляет удобные инструменты для изучения на открытые страницы
JW.org и WOL в браузере на компьютере.

Выделите текст одним из шести цветов, а затем добавьте к нему личную заметку и
теги рядом со страницей. Сохраняйте точную страницу, абзац, стих или несколько
стихов подряд и находите их позже в библиотеке StudyNav. Копируйте чистый текст,
оформленную цитату или точную ссылку и показывайте локальный QR-код нужного
места.

В главе Библии можно выбрать один стих или несколько стихов подряд и скачать их
озвучку одним WAV-файлом. На страницах с медиа можно скопировать ссылку на
текущий момент, сохранить короткий фрагмент аудио или видео, найти строку в
доступном транскрипте, продолжить просмотр с сохранённого места или открыть
воспроизведение в отдельном окне. Также есть отключаемые инструменты для
изображений и удобства чтения.

Выделения, заметки, теги, сохранённые места, настройки и прогресс остаются в
хранилище браузера. У StudyNav нет аккаунта, рекламы, аналитики, телеметрии и
удалённого сервиса заметок. Официальные изображения и медиа запрашиваются только
после нажатия соответствующей кнопки и обрабатываются на вашем устройстве.
Поиск изображений Google открывается только после отправки запроса.

StudyNav работает только на jw.org, www.jw.org и wol.jw.org. Доступ к
официальному медиа-хосту JW используется только для запрошенных скачиваний и
фрагментов. Удалённого исполняемого кода нет.

StudyNav — независимый неофициальный проект с открытым кодом. Он не выпускается,
не поддерживается и не одобряется Свидетелями Иеговы.

## Privacy-practices answers

### Permission justifications

- `storage`: save feature settings and study records that the user creates.
  Highlights, notes, tags, saved places, and media progress remain in browser
  storage. Settings may be synchronized by the browser if the user enables
  browser sync; KikuAI Lab does not receive them.
- `offscreen`: use browser-native document media APIs while the MV3 service
  worker is running, solely to create a local WAV or WebM file after the user
  requests a verse or media segment.
- `https://jw.org/*`, `https://www.jw.org/*`, `https://wol.jw.org/*`: read the
  public page currently opened by the user and add the enabled study controls.
  The page is processed in the browser and is not sent to KikuAI Lab.
- `https://*.jw-cdn.org/*`: fetch an official image, audio file, or video file
  only after the user requests a download or clip. The extension rejects media
  URLs outside this official host boundary.

### Remote code

**No.** All executable code is bundled in the submitted ZIP. Network responses
are treated as page or media data and are never evaluated as code.

### Data-use disclosure

StudyNav accesses website content, the current page URL, and user-created study
text locally to provide its visible features. It does not transmit this data to
KikuAI Lab or another StudyNav service. If the Dashboard asks what the publisher
collects or transmits off the device, select **no user data collected**. If a
review field instead asks what data the extension accesses or handles locally,
disclose **website content**, **web history limited to the three declared study
sites**, and **user-provided content** with the local-only explanation above.
Keep the selected checkboxes consistent with the exact wording shown by the
current Dashboard.

Certify all applicable Limited Use statements: the data is used only for the
listed single purpose; it is not sold, used for advertising or credit decisions,
or made available for human reading. The public privacy policy contains the
matching Limited Use statement.

## Distribution and testing

- Free item; no in-app purchases.
- Public visibility in all countries where Chrome Web Store is available.
- Automatic publication after review unless the owner explicitly requests a
  staged release.
- No account or test credential is required.

Reviewer steps:

1. Open `https://www.jw.org/en/library/bible/nwt/books/genesis/1/` or any public
   JW.org article, then open the StudyNav popup.
2. Select text in one paragraph or verse and verify the color toolbar, local
   note editor, Copy, and Link.
3. Select a verse number and verify the visible verse actions. Media downloads
   require an available official audio source and are user-triggered.
4. Open a public WOL article and verify that the popup identifies an article
   page without placing media-only controls on it.
5. No login, purchase, private content, or special test account is needed.

## Store assets

- Package icon: `packages/studynav/public/icons/icon128.png` (128 × 128).
- Small promotional image:
  `packages/studynav/store/chrome/promo-440x280.png` (440 × 280).
- English screenshots: five PNG files under
  `packages/studynav/store/chrome/screenshots/en/` (1280 × 800).
- Russian screenshots: five PNG files under
  `packages/studynav/store/chrome/screenshots/ru/` (1280 × 800).

The screenshot source is the repository's deterministic browser fixture using
the same built content script and controls as the release. It contains no
official publication text, logo, or artwork and does not imply affiliation.

## Package and verification gate

```bash
bun install --frozen-lockfile
bun run verify
bun run package:studynav:chrome
unzip -t packages/studynav/studynav-chrome-store.zip
unzip -l packages/studynav/studynav-chrome-store.zip
shasum -a 256 packages/studynav/studynav-chrome-store.zip
```

The archive must have `manifest.json` at its root, contain both locales and all
runtime assets, contain no `*.map`, `_metadata`, source-only icon SVG, or
`.DS_Store`, and request exactly the permissions declared above. The ZIP hash
uploaded to the Dashboard must match the hash recorded in Issue #9.

Google account registration, a registration payment, a new legal agreement,
email verification, credentials, and 2-step verification are owner actions.
Upload and submission were explicitly authorized for Issue #9; do not treat a
successful upload as submission, approval, publication, or working Store
installation.
