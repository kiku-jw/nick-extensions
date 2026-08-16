# InkShade Chrome Web Store readiness

Class: live release contract. Owner: `packages/inkshade`. Update whenever the
manifest, permissions, privacy behavior, branding, listing copy, or store
artifact changes.

## Product identity

- Name: **InkShade – Dark Mode for Every Site**
- Single purpose: generate adaptive dark themes for websites.
- Publisher: KikuAI Lab.
- Independent product: not affiliated with or endorsed by Dark Reader Ltd.
- Upstream attribution: `packages/inkshade/UPSTREAM.json` and
  `packages/inkshade/THIRD_PARTY_NOTICES.txt`.

InkShade's distinct value is a local-first distribution of a proven dynamic
theme engine: no ads, telemetry, news feed, donation prompts, premium
activation, uninstall survey, or remote configuration.

## Permissions

- `storage`: local preferences, site rules, and user-authored fixes.
- `scripting`: supported-page injection and PDF handling.
- `alarms`: user-configured automation and bounded resource-cache cleanup.
- `fontSettings`: optional user-selected font preferences.
- `*://*/*`: analyze and transform styles on user-visited websites.
- Optional `contextMenus`: user-enabled page toggle commands.

The MAIN-world proxy is a declared MV3 content script. No string-built inline
script or remote executable code is used.

## Data disclosure

The extension handles website content locally to transform page colors. It does
not collect or transmit user data to KikuAI infrastructure. Theme processing
can request stylesheets and images already referenced by the current page.
Browser sync is disabled by default. See `packages/inkshade/PRIVACY.md`.

## Release gate

```bash
bun install --frozen-lockfile
bun run bootstrap:inkshade
bun run test:inkshade-upstream
bun run build:inkshade
bun run smoke-check
NICK_EXT_SCENARIOS=inkshade-only bun run smoke:browser
bun run package:inkshade
```

The final ZIP must have `manifest.json` at its root and contain only `en`, `ru`,
and `uk` locales. Audit it for upstream brand assets, marketing endpoints,
remote config, `eval`, `new Function`, `update_url`, and external messaging.

## Publication blocker

Publish `packages/inkshade/PRIVACY.md` at a stable public URL before submitting
the extension. `https://kikuai.dev/privacy` currently returns 404 and must not
be used. Store screenshots, promotional images, support URL, developer account
enrollment, and the actual upload remain separate owner-approved publication
steps.
