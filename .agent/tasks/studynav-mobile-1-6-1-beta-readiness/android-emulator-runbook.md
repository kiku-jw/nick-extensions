# Firefox Android Emulator runbook

Status: prepared; execution requires Nick's explicit Android SDK license
approval.

This runbook completes AC4 without a physical phone, Google Play account,
provider upload, signing, or publication. It uses one ARM64 emulator and the
official Firefox 142.0 APK, matching StudyNav's declared minimum Firefox
version.

## Official basis

- Android command-line tools require prior acceptance of the Android SDK
  License Agreement:
  <https://developer.android.com/studio#command-line-tools-only>
- Android documents `avdmanager` as the command-line AVD manager and the
  emulator as the supported phone-free test surface:
  <https://developer.android.com/tools/avdmanager>
  <https://developer.android.com/studio/run/emulator-commandline>
- Mozilla requires `web-ext` 7.12 or later, Android Platform Tools/ADB,
  Firefox remote debugging, and temporary loading with
  `web-ext run -t firefox-android`:
  <https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/>
- Mozilla's official Firefox 142.0 ARM64 APK is archived at:
  <https://archive.mozilla.org/pub/fenix/releases/142.0/android/fenix-142.0-android-arm64-v8a/fenix-142.0.multi.android-arm64-v8a.apk>

## Bounded environment

- Host architecture: Apple Silicon ARM64.
- One AVD only: `StudyNav_API_35`.
- Android image: API 35 `default` ARM64, without Google Play or Google APIs.
- AVD budget: two CPU cores, 2 GB RAM, no audio, no saved snapshot.
- Firefox: official release 142.0, package `org.mozilla.firefox`.
- Extension: temporary development install through `web-ext` 10.6.0.
- No physical Android/iPhone, account, credentials, Store, or remote test
  service.

## Owner-gated setup

Do not run this section until Nick explicitly approves the Android SDK license.

1. Install Homebrew `openjdk@17` and `android-commandlinetools`. Use the keg-only
   JDK by an explicit `JAVA_HOME`; do not add a system Java symlink.
2. Run `sdkmanager` interactively for exactly:

   ```text
   platform-tools
   emulator
   system-images;android-35;default;arm64-v8a
   ```

   Read the presented license identifier and accept only the licenses required
   by these packages. Do not pipe an unconditional `yes` into all SDK licenses.
3. Create `StudyNav_API_35` with `avdmanager`, using a compact phone hardware
   profile and no custom SD card.
4. Start the visible emulator with two cores, 2 GB RAM, no audio, and no
   snapshot save. Wait for `adb shell getprop sys.boot_completed` to return
   `1`, then confirm `adb devices` reports exactly the intended emulator.
5. Download the APK from the Mozilla HTTPS archive above into a validated
   task-temporary directory, record its SHA-256, inspect it with `apkanalyzer`,
   and install it with `adb install`.
6. In Firefox, enable remote debugging, open one ordinary tab, and use:

   ```text
   bunx web-ext@10.6.0 run \
     --target=firefox-android \
     --android-device=emulator-5554 \
     --firefox-apk=org.mozilla.firefox \
     --source-dir=packages/studynav/dist-firefox-android
   ```

   Use the actual ADB serial if it differs. Do not sign or upload the add-on.

## Runtime matrix

Run on live public JW.org and WOL pages in both portrait and landscape. Capture
a screenshot after each numbered result and retain filtered extension/Firefox
logs without page text or private data.

1. Highlight a short public fixture thought in each of the six colors.
2. Add, edit, and delete a note; enter tags with comma/space and verify chips.
3. Save, open, and remove a page/paragraph/verse place.
4. Copy a citation and verify the pasted text contains the selected fixture
   text and source, without StudyNav controls.
5. Generate the local QR, copy/open it, and close the sheet.
6. Open the clean publication link and confirm it stays on one of the three
   exact allowed origins.
7. Copy clean article/verse text and verify verse numbers, footnote markers,
   and extension UI are omitted only where the product contract says so.
8. Copy precise links for one verse, consecutive verses, and a paragraph; open
   each result and confirm the intended target is selected.
9. Verify an image description on a full article image and language count on a
   JW.org article that supplies those metadata.

Then verify master-off teardown, individual feature-off teardown, rapid
repeated selection without flicker, popup scrolling/no horizontal overflow,
large text, reduced-height keyboard viewport, denied/regranted site access,
offline access to saved local notes/places, Firefox restart, and an article
with many seeded local records.

## 1.6.0 to 1.6.1 emulator check

1. Export release commit `012700a` into a task-temporary directory and build
   its Firefox Android 1.6.0 target without modifying the current worktree.
2. Load 1.6.0 temporarily with the same extension ID. Create one note with two
   tags, one saved place, a non-default feature selection, and representative
   supported local study records.
3. Replace only the temporary extension source with the current 1.6.1 build
   and trigger `web-ext` reload in the same Firefox profile.
4. Confirm the manifest reports 1.6.1; all seeded records and values remain;
   mobile settings exist in local storage; the legacy sync value remains
   unchanged; new setting writes affect local storage only.
5. Restart Firefox while the temporary development session remains active and
   reconfirm the records. Record any temporary-addon limitation separately
   rather than presenting it as AMO-signed upgrade proof.

## Pass criteria and cleanup

AC4 passes only when package/lint remain green, Firefox 142.0 accepts the
temporary add-on, all nine critical flows pass on live JW.org/WOL pages, the
upgrade/persistence check passes in the emulator profile, and captured logs
contain no extension errors or unexpected network/permission behavior.

After evidence is retained, stop the `web-ext` session and emulator. Keep the
single AVD only if another approved Android pass is imminent; otherwise remove
the task-created AVD and SDK image through their supported managers after
previewing the exact targets. Never remove unrelated Android state.
