# StudyNav Mobile 1.6.1 implementation notes

Date: 2026-08-23

Owning Issue: `kiku-jw/nick-extensions#8`

Release source: `a89c9fcf90167bfa2e4827c66f9b4f402f51e349`

## Delivered slice

- Kept one shared TypeScript implementation and the existing nine-feature
  mobile allowlist.
- Kept desktop-only media, download, player, transcript, second-display,
  image-download/search, keyboard, and layout handlers out of Safari iOS and
  Firefox Android outputs.
- Added a small storage adapter so mobile settings are written to
  `chrome.storage.local`. A valid 1.6.0 `storage.sync` value is copied and
  normalized once when no local value exists; the legacy value is not deleted.
  Desktop settings continue to use `storage.sync`.
- Preserved notes, highlights, tags, saved places, and other study data in the
  bounded local study-data envelope.
- Corrected the Safari iPad popup layout so rows and controls remain usable in
  the extension popover.
- Added Apple privacy manifest/category/version configuration and English and
  Russian onboarding/reviewer material.
- Removed the unreferenced editable `icon-source.svg` from both mobile release
  outputs and added a static assertion that it cannot return unnoticed.
- Added deterministic 1.6.0 to 1.6.1 migration, persistence, responsive,
  offline, stress, permission, and Safari-regression coverage to the existing
  test harness without a new runtime dependency.

## Verification boundary

The iPhone 17 and iPad (A16) simulators received unsigned builds of the same
1.6.1 containing app. StudyNav was enabled through Safari's extension controls
and its Russian popup was opened over a live public JW.org Bible page. The
iPhone popup recognized a selected verse; the iPad run verified the corrected
popover sizing. Provider-faithful browser scenarios exercise the complete
nine-feature shared runtime and adverse states at phone and tablet sizes.

This is not a physical-device claim. It is also not yet Android Emulator proof:
the official Android SDK is not installed on this Mac, and accepting the
Android SDK License Agreement requires a fresh owner decision.

## Review changes

Security review found and fixed two concrete release defects:

1. Mobile copy promised device-local settings while the 1.6.0 path still wrote
   feature flags to sync storage. The new adapter migrates additively and keeps
   all subsequent mobile writes local.
2. Mobile packages contained an unused source SVG. The build now removes it;
   release packages contain only the raster icons referenced by the manifests.

The final static/runtime review found no remaining remote code, telemetry,
third-party search, media handler, broad origin, or additional API permission
in either active mobile target. User-controlled values are parsed through the
bounded study-data schema and rendered with text nodes at extension-owned DOM
boundaries.

## Deliberate non-actions

- Did not connect to, mirror, automate, or install anything on Nick's physical
  iPhone.
- Did not accept an Android or provider agreement.
- Did not sign for distribution, upload, submit, or publish an Apple or Mozilla
  artifact.
- Did not alter `packages/inkshade/upstream`; its pre-existing dirty state is
  preserved.

## Routing receipt

One bounded Luna worker was used for the mobile release/configuration/test
slice. The primary agent independently reviewed the resulting diff, ran the
full repository verification and Safari packaging/build checks, performed the
security and adversarial review, created the exact-commit source archive, and
retained final judgment. No second execution or review control plane was added.
