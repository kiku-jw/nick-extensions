# Firefox Android Emulator runbook and receipt

Status: executed and passed on 2026-08-24.

This run completed AC4 without a physical phone, Google Play account,
provider upload, signing, or publication. It used Android 16/API 36 and the
official Firefox 142.0 ARM64 APK, matching StudyNav's declared minimum Firefox
version.

## Official basis

- Android command-line tools and SDK license:
  <https://developer.android.com/studio#command-line-tools-only>
- Android Virtual Device and emulator commands:
  <https://developer.android.com/tools/avdmanager>
  <https://developer.android.com/studio/run/emulator-commandline>
- Mozilla's supported Firefox Android development workflow:
  <https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/>
- Mozilla Firefox 142.0 ARM64 release archive:
  <https://archive.mozilla.org/pub/fenix/releases/142.0/android/fenix-142.0-android-arm64-v8a/fenix-142.0.multi.android-arm64-v8a.apk>

## Executed environment

- Host architecture: Apple Silicon ARM64.
- OpenJDK: 17.0.20.1.
- Android emulator: 37.1.11.
- Platform Tools: 37.0.1; ADB protocol 1.0.41.
- AVD: `StudyNav_API_36`, Android 16/API 36, `default` ARM64 image without
  Google Play or Google APIs, Pixel-9-like 1080 x 2424 display at density 420.
- Firefox: official release 142.0, package `org.mozilla.firefox`.
- Firefox APK SHA-256:
  `f5fe6a300cc5fc5286ef5efcd65daddc1166b1c74a6f5f7873381d48a01e2a9c`.
- Extension: temporary development install through `web-ext` 10.6.0.
- No physical Android/iPhone, account, credentials, Store, or remote test
  service was used.

The initial API 35 preparation was superseded by API 36 after Nick correctly
questioned whether the planned OS was current enough. Android 16/API 36 became
the executed test surface.

## Installation and load receipt

The SDK license was accepted only after Nick's explicit authorization. The
official APK was downloaded over HTTPS, hashed, inspected, and installed with
ADB. Firefox accepted the unsigned temporary extension through Mozilla's
documented command:

```text
bunx web-ext@10.6.0 run \
  --target=firefox-android \
  --android-device=emulator-5554 \
  --firefox-apk=org.mozilla.firefox \
  --source-dir=packages/studynav/dist-firefox-android
```

The installed add-on reported StudyNav Mobile 1.6.1. Firefox displayed exactly
the three required site-access entries (`jw.org`, `www.jw.org`, and
`wol.jw.org`) and declared that the developer requires no data collection.

## Runtime matrix result

All nine phone-safe functions passed on live public JW.org/WOL content:

1. Six highlight colors, notes, comma/space tag chips, edit, delete, and locate.
2. Save/open/remove place, including an exact Genesis 1:1-31 page record.
3. Citation copy with public title and official URL.
4. Local QR generation and exact official URL.
5. Clean official publication link.
6. Clean text copy without verse numbers, reference letters, or StudyNav UI.
7. Precise link for one verse, consecutive verses, and a paragraph.
8. Wrapped image descriptions below full images, not thumbnails.
9. Compact language count beside JW.org's language chooser.

The same pass covered portrait and landscape, consecutive verse selection,
master and individual feature teardown/restoration, large text, popup scrolling
without clipping, offline access to a saved place, Firefox force-stop/restart,
and touch-toolbar placement inside the reading column. Screenshots are retained
under `raw/android/01-bible-portrait.png` through
`raw/android/13-final-runtime-popup.png`.

## 1.6.0 to 1.6.1 migration result

Release commit `012700a` was built in an isolated temporary worktree and loaded
as StudyNav Mobile 1.6.0 in the same Firefox profile. The fixture contained a
purple annotation, note text, two tags, a Genesis saved place, and a disabled
clean-link setting in legacy sync storage.

After replacing it with release source `dd014fc`:

- Firefox reported version 1.6.1;
- the highlight, note, both tags, and saved place remained and rendered;
- the legacy sync value remained unchanged;
- the normalized settings were copied to local storage;
- a subsequent real `SET_FLAG` action changed only local storage;
- the popup moved from `8 on` to `9 on`, and the clean-link action became
  available.

This proves the temporary-development-profile migration path. It does not claim
AMO-signed upgrade behavior or provider approval.

## Firefox system-disable limitation

Firefox Android exposes these host permissions as required add-on permissions,
not as individually revocable site toggles. Disabling the whole add-on stops
its JavaScript before it can undo DOM changes already inserted into an open JW
tab. After enabling the add-on again, refresh that tab once. StudyNav's own
`Tools` switch does perform immediate clean teardown and restoration without a
refresh. The observed pre-refresh state is retained as
`raw/android/12-firefox-disable-before-refresh.png` and is not presented as a
pass for immediate system-disable cleanup.

## Cleanup receipt

After retaining proof, the `web-ext` session and emulator were stopped. Both
task-created AVDs (`StudyNav_API_35` and `StudyNav_API_36`) and the isolated
1.6.0 worktree were removed. Temporary APK/build roots and the superseded source
archive were moved to the macOS Trash, so they remain recoverable. The official
Android SDK/OpenJDK installation was left intact; no unrelated Android or
repository state was removed.
