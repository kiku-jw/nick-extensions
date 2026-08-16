# InkShade privacy policy

Last updated: 2026-08-14

InkShade changes website colors locally in the browser. It does not collect,
sell, transmit, or use personal data for advertising, analytics, profiling, or
credit purposes.

## Data processed locally

InkShade needs access to visited web pages to read styles and apply a dark
theme. It may process page URLs, CSS, images referenced by CSS, and page
structure in memory. This data is used only to render the current page and is
not sent to InkShade or KikuAI servers.

Preferences, site lists, automation settings, and custom theme fixes are stored
in browser extension storage. Browser synchronization is disabled by default.
Users can explicitly export settings to a local file.

## Network behavior

InkShade does not include telemetry, analytics, ads, a news feed, premium
activation, remote configuration, or an uninstall survey. It may request
stylesheets and images already referenced by the page so the local theme engine
can analyze them. Those requests go to the websites that supplied the page
resources, not to InkShade infrastructure.

## Permissions

- `storage`: save local preferences and site rules.
- `scripting`: apply the theme in supported browser contexts.
- `alarms`: run user-configured time or location automation.
- `fontSettings`: apply user-selected font preferences.
- Broad website access: read and transform page styles on sites where InkShade
  is enabled.
- Optional `contextMenus`: add user-requested page toggle commands.

## Third-party code

The dynamic theme engine is derived from the MIT-licensed Dark Reader project.
The exact revision and license are recorded in `UPSTREAM.json` and
`THIRD_PARTY_NOTICES.txt`. InkShade is independently developed and is not
affiliated with or endorsed by Dark Reader Ltd.

## Contact

Privacy questions can be submitted through the KikuAI project contact surface
at https://kikuai.dev.
