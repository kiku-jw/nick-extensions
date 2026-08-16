# InkShade – Dark Mode for Every Site

InkShade is a local-first Manifest V3 dark-mode extension. Version 2.0 replaces
the original blanket CSS override with a source-level fork of Dark Reader's
dynamic engine, MAIN-world stylesheet proxy, and bundled site-fix catalog.

## Product boundary

- Distinct InkShade name, icons, UI copy, and store identity.
- No ads, telemetry, news feed, donation prompts, premium activation,
  uninstall survey, or remote configuration.
- Settings are local by default. Import and export remain user-controlled.
- English, Russian, and Ukrainian are the reviewed release locales.
- Broad website access is required to analyze and transform page styles.

InkShade is independently developed and is not affiliated with or endorsed by
Dark Reader Ltd. See `UPSTREAM.json`, `THIRD_PARTY_NOTICES.txt`, and
`PRIVACY.md`.

## Build

From the monorepo root:

```bash
bun run bootstrap:inkshade
bun run test:inkshade-upstream
bun run build:inkshade
NICK_EXT_SCENARIOS=inkshade-only bun run smoke:browser
bun run package:inkshade
```

Load `packages/inkshade/dist` as an unpacked extension. The Chrome Web Store
artifact is `packages/inkshade/inkshade-store.zip`.

Before store submission, use the repository copy of [`PRIVACY.md`](PRIVACY.md)
as the reviewed privacy disclosure and provide its stable public GitHub URL in
the Chrome Web Store privacy field. Store submission or publication is a
separate owner-controlled step and is not implied by this source repository.
