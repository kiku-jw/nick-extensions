# StudyNav Mobile 1.6.1 — local release packet

This is the review packet for the Safari iPhone/iPad and Firefox Android
closed-beta candidates. It is a local source artifact, not a Store submission.
The mobile packages are not described as publicly available until a physical
device pass and the owner-controlled provider steps are complete.

## Product boundary

StudyNav Mobile is an unofficial, local-only helper for public reading pages
on exactly these HTTPS origins:

- `https://jw.org/*`
- `https://www.jw.org/*`
- `https://wol.jw.org/*`

The nine included tools are highlights and notes, saved places, citations,
local QR sharing, clean publication links, clean text copy, precise paragraph
or verse links, image descriptions, and the available-language count.

The mobile builds expose no media downloads or clipping, player controls,
transcripts, continue-watching, second display, image downloads, external
image search, keyboard palette, sticky header, wider column, or table styling;
their reachable handlers and UI are removed at build time. They use only the
browser `storage` API. There is no account, telemetry, analytics, remote note
sync, or remotely executed code.

## Build and local checks

Run from the repository root:

```bash
bun install --frozen-lockfile
bun run build:studynav
bun run lint:studynav:firefox-android
bun run verify:studynav:safari
bun run verify
bun run package:studynav:firefox-android
```

The generated package paths are:

- Safari extension resources: `packages/studynav/dist-safari-ios/`
- Firefox Android package: `packages/studynav/studynav-firefox-android.zip`
- Committed Safari wrapper: `packages/studynav/apple/StudyNav/`

For an AMO source archive, create it from the exact release commit so source
and generated output can be reproduced. Do not include private runtime state:

```bash
git archive --format=zip --prefix=studynav-mobile-1.6.1-source/ \
  HEAD -- \
  packages/studynav \
  scripts/build-extension.mjs scripts/sync-studynav-safari.mjs \
  scripts/verify-studynav-safari.mjs scripts/smoke-check.mjs \
  package.json bun.lock
```

The archive is source for review only. Signing, upload, submission, and public
distribution are separate owner actions.

## Local verification evidence

The current iOS Simulator run installed the same 1.6.1 containing app on an
iPhone 17 and an iPad (A16), enabled StudyNav through Safari's own extension
controls, granted only the requested JW.org/WOL page scope, and opened the
Russian popup over a live public Bible chapter. The iPhone popup recognized a
selected verse. The iPad run exposed and then verified the fix for a Safari
popover row-stretching regression.

The provider-faithful browser suite covers the nine included settings at phone
and tablet widths, portrait and landscape, light and dark appearance, large
text, a reduced-height keyboard viewport, permission teardown/reapply,
restart, offline access to saved data, repeated selections, and many local
records. This is simulator and fixture evidence, not a physical-device or
Store-review claim.

### Screenshot inventory

Store-safe onboarding candidates:

- `screenshots/en/iphone-onboarding.png`
- `screenshots/en/ipad-onboarding.png`
- `screenshots/ru/iphone-onboarding.png`

Local verification evidence:

- `screenshots/evidence/safari-iphone-popup-ru.png`
- `screenshots/evidence/safari-ipad-popup-ru.png`
- `screenshots/evidence/selection-tools.png`
- `screenshots/evidence/note-editor.png`
- `screenshots/evidence/popup.png`

The live-page Safari captures and internal browser fixtures are verification
evidence, not Store artwork.

## English listing copy

### Short description

Local highlights, notes, saved places, and exact links for public JW.org pages.
No telemetry.

### Full description

StudyNav Mobile adds practical local study tools to public JW.org and WOL
reading pages on supported phones and tablets. Highlight a thought in one of
six colors, add a private note with tags, and save an exact page, paragraph,
verse, or verse range. Copy clean text, a citation with its source, or a
precise link, and show a QR code generated on your device. Full article images
can show the description supplied by the page, and JW.org article pages can
show the available-language count.

Your notes, highlights, tags, saved places, and settings stay in browser-local
storage. StudyNav has no account, ads, analytics, telemetry, remote note
service, or third-party search. Page content is processed in the browser and
is not sent to the project. The extension runs only on `jw.org`, `www.jw.org`,
and `wol.jw.org`.

StudyNav Mobile is an independent, unofficial open-source project. It is not
produced, maintained, supported, or endorsed by Jehovah's Witnesses.

## Русский текст для публикации

### Краткое описание

Локальные выделения, заметки, сохранённые места и точные ссылки для открытых
страниц JW.org. Без телеметрии.

### Полное описание

StudyNav Mobile добавляет удобные локальные инструменты для изучения открытых
страниц JW.org и WOL на поддерживаемых телефонах и планшетах. Выделите мысль
одним из шести цветов, добавьте личную заметку с тегами и сохраните точную
страницу, абзац, стих или диапазон стихов. Можно скопировать чистый текст,
цитату с источником или точную ссылку, а также показать QR-код, созданный на
вашем устройстве. На полноразмерных иллюстрациях статьи можно увидеть
описание, которое предоставила сама страница, а на страницах статей JW.org —
количество доступных языков.

Заметки, выделения, теги, сохранённые места и настройки остаются в локальном
хранилище браузера. У StudyNav нет аккаунта, рекламы, аналитики, телеметрии,
удалённого сервиса заметок и стороннего поиска. Страница обрабатывается в
браузере и не отправляется проекту. Расширение работает только на `jw.org`,
`www.jw.org` и `wol.jw.org`.

StudyNav Mobile — независимый неофициальный проект с открытым исходным кодом.
Он не выпускается, не поддерживается и не одобряется Свидетелями Иеговы.

## Reviewer notes

No login or test account is required. Open a public article or Bible chapter
on one of the three declared origins, select a sentence, and verify the
highlight colors, note editor, tag chips, Copy, and Link actions. Save a place,
open the StudyNav library, and return to it. Verify the citation, QR, clean
link, image description, and language count actions where the page supplies
the required metadata. Reopen the browser and confirm the local records remain.

The extension should not attach to `stream.jw.org`, `hub.jw.org`, or any other
JW subdomain. Media and layout controls are intentionally absent from the
mobile package. No network endpoint other than the current declared JW.org or
WOL page is needed for the included tools.

## Apple checklist

- Product category: **Productivity** (owner-selected App Store Connect field).
- Version: **1.6.1**; build: **1**; device family: iPhone and iPad.
- Minimum iOS version: **15.4**; app and extension bundle IDs are stable.
- App icons are present in the universal asset catalog.
- Onboarding is available in English and Russian and explains enabling the
  extension on the three exact origins.
- `PrivacyInfo.xcprivacy` declares no tracking, collected data, or required
  reason API access; App Privacy answers must still match the current
  App Store Connect wording.
- Support: <https://github.com/kiku-jw/nick-extensions/issues>
- Privacy: <https://kiku-jw.github.io/nick-extensions/privacy/>

The local simulator build proves packaging, Safari enablement, live page
injection, localization, and the bounded mobile workflows on simulated iPhone
and iPad hardware. A repeat physical-device pass, signing, TestFlight, review,
and App Store publication remain owner-controlled gates.

## Mozilla checklist

- Manifest V2, stable ID `studynav-mobile@kikuai.dev`, Android minimum Firefox
  **142.0**, and `data_collection_permissions.required: ["none"]`.
- The package requests only `storage` plus the three exact page origins.
- `web-ext lint --warnings-as-errors` must finish with zero warnings.
- Submit the generated ZIP together with the reproducible source archive and
  the build commands above. The source archive must not contain private
  profiles, credentials, or generated machine state.
- AMO signing, upload, review, and public distribution are separate gates.

## Known limits before beta release

This packet does not claim a 1.6.1 physical-device pass, Android emulator
installation proof, provider approval, or public mobile availability. iPhone
and iPad simulator checks are complete. Android Emulator verification still
requires installation of the official Android SDK and acceptance of its
license by the owner; provider uploads and publication remain separate gates.
