# StudyNav Mobile 1.6.1 beta readiness

Status: frozen

Owning Issue: `kiku-jw/nick-extensions#8`

Goal thread: `01a00545-ec69-7cd0-91f8-efaeb48f3dbc`

## Original task

Complete every phone-free StudyNav Mobile readiness item from the accepted
plan without using Nick's physical iPhone. Stop before provider uploads,
agreements, credentials, signing submissions, or publication.

## Outcome

StudyNav Mobile 1.6.1 is a locally reproducible, security/privacy-reviewed,
simulator/emulator-validated closed-beta candidate for Safari on iPhone/iPad
and Firefox on Android. All user-facing release materials are ready locally,
and only explicit physical-device/provider gates remain.

## Acceptance criteria

- **AC1 — Current full regression:** Final source passes `bun run verify` with
  zero failures, skips, page errors, or extension-console errors. Existing
  desktop behavior and packages remain unchanged except where the accepted
  mobile work requires a shared fix.
- **AC2 — Safari build matrix:** Apple's Safari packager accepts the extension,
  and the containing app plus extension build for current iPhone and iPad
  simulator destinations without signing or physical-device access.
- **AC3 — Safari simulator workflows:** Live or provider-faithful Safari
  simulator evidence covers all nine mobile settings on both phone and tablet
  layouts, including portrait/landscape, light/dark appearance, large text,
  keyboard/safe-area behavior, permission denial/regrant, restart persistence,
  and the five Safari defects fixed in 1.6.1.
- **AC4 — Firefox Android emulator:** The MV2 Android package builds, passes
  `web-ext lint --warnings-as-errors`, installs in a supported Android Emulator
  Firefox workflow, and exercises the same critical JW.org/WOL study paths.
- **AC5 — Upgrade and persistence:** A deterministic 1.6.0 → 1.6.1 check proves
  supported notes, tags, bookmarks, settings, and other study data retain their
  schema and values across the update.
- **AC6 — Reliability boundaries:** Automated or simulator/emulator evidence
  covers repeated selections, long pages, many local records, restart, revoked
  permissions, offline access to saved data, rotation, responsive boundaries,
  and teardown without stale UI.
- **AC7 — Security and privacy:** Static and review evidence proves exact site
  origins, `storage` as the only browser API permission, no remote code,
  telemetry, excluded media/layout handlers, or third-party search, accurate
  no-data claims, and correct escaping/sanitization at extension-owned DOM and
  storage boundaries.
- **AC8 — Apple release configuration:** App category, versions/build numbers,
  universal device family, icons, EN/RU onboarding, support/privacy references,
  and App Privacy/required-reason API handling are valid and review-ready.
- **AC9 — Mozilla release configuration:** The package, source archive, build
  instructions, Android compatibility declaration, no-data declaration,
  permissions explanation, EN/RU listing, review notes, and known limitations
  are reproducible and accurate.
- **AC10 — Local beta packet:** Safari and Firefox artifacts, hashes, EN/RU
  screenshots/copy, review checklist, support/privacy links, and a fresh proof
  bundle are present. The unrelated InkShade upstream submodule is untouched.

## Constraints

- Do not connect to, mirror, automate, install onto, or otherwise occupy Nick's
  physical iPhone.
- Do not upload to TestFlight, App Store Connect, AMO, or another provider.
- Do not accept agreements, enter credentials/OTP, change provider accounts,
  sign for distribution, publish, or claim public mobile availability.
- Preserve `packages/inkshade/upstream` and all unrelated worktree state.
- Use the existing shared TypeScript codebase and the nine-feature mobile
  allowlist. No new backend, telemetry, sync service, native rewrite, Edge
  Mobile revival, or desktop-only media feature port.
- Add no dependency or large wrapper unless existing tools cannot prove an
  acceptance criterion and the dependency is separately justified.

## Assumptions

- Xcode/iOS Simulator and an Android Emulator can provide all current-goal
  evidence; physical-device feel and Store/provider acceptance remain later
  gates.
- Real JW.org/WOL pages may reject an automation transport. Such a rejection is
  recorded separately from product behavior and replaced with direct public
  route evidence plus provider-faithful browser fixtures where necessary.
- Simulator screenshots may be used for local Store material preparation; no
  asset is externally uploaded in this goal.

## Verification plan

1. Inventory installed Apple/Android tooling, current repo state, manifests,
   store docs, and generated artifacts.
2. Establish a fresh baseline with focused mobile checks and the full suite.
3. Implement the smallest changes needed for AC2–AC10, keeping release-only
   data in canonical live contracts or deterministic generators.
4. Run iPhone and iPad simulator checks and Android Emulator Firefox checks;
   retain logs and screenshots under `raw/`.
5. Build release/source archives twice where practical and compare hashes or
   normalized contents.
6. Run security/privacy and adversarial review, fix concrete failures, rerun
   all affected evidence, and obtain a fresh independent verdict.

## Stop and ask

Stop before any provider-side action, legal agreement, credential/keychain or
OTP requirement, physical-iPhone access, unexpected permission expansion,
paid dependency, destructive system change, or material product-scope change.
