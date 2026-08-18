# StudyNav Mobile Edge Add-ons release contract

Class: live release contract. Owner: `packages/studynav`. Canonical task:
`kiku-jw/nick-extensions#8`. Update whenever the Android package, permissions,
privacy behavior, store copy, testing boundary, or certification state changes.

## Product identity

- Name: **StudyNav Mobile — Unofficial Study Tools**
- Publisher: **KikuAI Lab**
- Platform: **Microsoft Edge on Android**
- Category: **Productivity**
- Website: `https://kiku-jw.github.io/nick-extensions/`
- Privacy: `https://kiku-jw.github.io/nick-extensions/privacy/`
- Support: `https://github.com/kiku-jw/nick-extensions/issues`
- Independent product: not produced, maintained, supported, or endorsed by
  Jehovah's Witnesses.

The August 18, 2026 physical-iPhone check opened Edge's Extensions catalog and
showed “Coming soon.” iPhone is not a supported or testable release target.

## Single purpose

Add local annotation, navigation, copying, and sharing tools to public JW.org
and WOL reading pages in Microsoft Edge on Android.

## Included behavior

- six-color highlights, notes, and tags;
- saved places and citations;
- local QR codes and clean official publication links;
- clean text copy and precise paragraph or verse links;
- full-image descriptions and available-language count;
- a user-triggered Google Custom Search for images from JW.org.

The Android archive excludes media and image downloads, audio/video clipping,
player controls, transcripts, second display, keyboard search, and page-layout
modifiers. Those handlers, permissions, files, and UI surfaces must be absent
from the submitted ZIP, not merely hidden.

## Permissions and privacy answers

- `storage`: save feature settings and user-created study data. Notes,
  highlights, tags, saved places, and citations remain in browser-local storage.
- `https://jw.org/*`, `https://www.jw.org/*`, `https://wol.jw.org/*`: read the
  currently opened public page and add the selected study controls. Page content
  is processed in the browser and is not sent to KikuAI Lab.
- Remote code: **No**.
- Publisher analytics, telemetry, ads, remote note sync, or account: **None**.
- Google image search: only after the user submits a query; the browser opens
  Google Custom Search and Google's policy applies.
- Browser settings sync: feature flags may be synchronized by Microsoft Edge if
  the user enables browser sync. KikuAI Lab does not receive them.

For a form that separates “access” from “collection,” disclose local access to
website content and user-provided notes. For a form that asks only what the
publisher collects, select no collection. Never claim that no data is handled:
the extension necessarily handles the page and user-created study text locally.

## Store listing copy

### English description

StudyNav Mobile adds local study tools to public JW.org and WOL reading pages
in Microsoft Edge on Android. Select text to highlight it or add a searchable
note with tags. Save an exact paragraph or verse, copy clean text, a precise
link, or a quotation with its source, and show a local QR code for the current
place. StudyNav can also display full-image descriptions and the number of
available languages.

Highlights, notes, tags, and saved places stay in browser-local storage. There
is no StudyNav account, advertising, analytics, telemetry, or remote note
service. A Google image search opens only after you submit a query.

This Android package deliberately excludes audio and video downloads, media
clipping, player controls, transcripts, second display, image downloads,
keyboard commands, and page-layout changes.

StudyNav is an independent, unofficial open-source project. It is not produced,
maintained, supported, or endorsed by Jehovah's Witnesses.

### Russian description

StudyNav Mobile добавляет локальные инструменты для изучения на открытые
страницы JW.org и WOL в Microsoft Edge на Android. Выделите текст, чтобы
отметить его одним из шести цветов или добавить заметку с тегами. Сохраняйте
точный абзац или стих, копируйте чистый текст, точную ссылку либо цитату вместе
с источником и показывайте локальный QR-код нужного места. StudyNav также может
показать описание полноразмерного изображения и число доступных языков.

Выделения, заметки, теги и сохранённые места остаются в локальном хранилище
браузера. У StudyNav нет аккаунта, рекламы, аналитики, телеметрии и удалённой
синхронизации заметок. Поиск изображений Google открывается только после
отправки запроса пользователем.

В пакет для Android намеренно не входят скачивание аудио и видео, обрезка
медиа, управление плеером, транскрипты, второй экран, скачивание изображений,
клавиатурные команды и изменение вёрстки страницы.

StudyNav — независимый неофициальный проект с открытым кодом. Он не выпускается,
не поддерживается и не одобряется Свидетелями Иеговы.

## Certification notes

1. Install on Microsoft Edge for Android.
2. Open a public Bible chapter or article at `https://www.jw.org/`, or an
   article at `https://wol.jw.org/`.
3. Select article text. Verify six highlight colors, Add note, Copy, and Link.
4. Save a note with a comma-separated tag, then reopen it in Study library.
5. Verify Save place, Copy citation, Show QR, and Open clean publication link.
6. Confirm that media download/player actions and page-layout modifiers are
   absent. No account or test credential is needed.

The popup follows the Edge display language for English and Russian. The
extension runs only on the three declared public origins.

## Release gate

```bash
bun install --frozen-lockfile
bun run verify
bun run package:studynav:edge-mobile
unzip -l packages/studynav/studynav-edge-mobile.zip
shasum -a 256 packages/studynav/studynav-edge-mobile.zip
```

Before submission, verify the public privacy URL, inspect every ZIP entry, and
run the `studynav-edge-mobile` browser scenario. Submission, certification, and
public availability are three separate states. Do not call the extension
published until Microsoft certifies it and the Edge Add-ons listing is public.
