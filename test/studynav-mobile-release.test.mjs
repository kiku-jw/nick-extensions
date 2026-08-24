import { describe, expect, test } from 'bun:test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

async function text(path) {
  return readFile(resolve(ROOT, path), 'utf8');
}

async function json(path) {
  return JSON.parse(await text(path));
}

async function pngSize(path) {
  const bytes = await readFile(resolve(ROOT, path));
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe('StudyNav Mobile 1.6.1 provider-ready beta packet', () => {
  test('keeps the release packet aligned with the exact mobile boundary', async () => {
    const packet = await text('packages/studynav/store/mobile/RELEASE-CANDIDATE.md');
    const compactPacket = packet.replace(/\s+/g, ' ');
    for (const origin of ['https://jw.org/*', 'https://www.jw.org/*', 'https://wol.jw.org/*']) {
      expect(packet).toContain(origin);
    }
    for (const deniedHost of ['stream.jw.org', 'hub.jw.org']) expect(packet).toContain(deniedHost);
    for (const included of ['highlights and notes', 'saved places', 'citations', 'local QR sharing', 'clean text copy', 'precise paragraph or verse links', 'image descriptions', 'available-language count']) {
      expect(compactPacket).toContain(included);
    }
    for (const excluded of ['media downloads or clipping', 'player controls', 'transcripts', 'external image search', 'remotely executed code']) {
      expect(compactPacket).toContain(excluded);
    }
    expect(packet).toContain('PrivacyInfo.xcprivacy');
    expect(packet).toContain('Support: <https://github.com/kiku-jw/nick-extensions/issues>');
    expect(packet).toContain('Privacy: <https://kiku-jw.github.io/nick-extensions/privacy/>');
    expect(packet).toContain('Mozilla-signed unlisted beta');
    expect(packet).toContain('TestFlight beta');
    expect(packet).toContain('Firefox 142');
    expect(packet).toContain('Android 16/API 36 Emulator');
    expect(packet).toContain('--output=packages/studynav/studynav-mobile-1.6.1-source.zip');
    expect(packet).toContain('shasum -a 256');
    expect(packet).not.toContain('screenshots/evidence/safari-iphone-popup-ru.png');
    expect(packet).not.toContain('screenshots/evidence/safari-ipad-popup-ru.png');
    expect(packet).not.toContain('requires installation of the official Android SDK');
  });

  test('ships an Apple privacy manifest wired into the containing app', async () => {
    const privacy = await text('packages/studynav/apple/StudyNav/StudyNav/PrivacyInfo.xcprivacy');
    const project = await text('packages/studynav/apple/StudyNav/StudyNav.xcodeproj/project.pbxproj');
    expect(privacy).toContain('<key>NSPrivacyTracking</key>\n\t<false/>');
    expect(privacy).toContain('<key>NSPrivacyCollectedDataTypes</key>\n\t<array/>');
    expect(privacy).toContain('<key>NSPrivacyAccessedAPITypes</key>\n\t<array/>');
    expect(project).toContain('PrivacyInfo.xcprivacy in Resources');
    expect(project).toContain('PrivacyInfo.xcprivacy */');
  });

  test('keeps both platform manifests at the beta version and exact permissions', async () => {
    const safari = await json('packages/studynav/manifest.safari-ios.json');
    const firefox = await json('packages/studynav/manifest.firefox-android.json');
    const hosts = ['https://jw.org/*', 'https://www.jw.org/*', 'https://wol.jw.org/*'];
    expect(safari.version).toBe('1.6.1');
    expect(safari.permissions).toEqual(['storage']);
    expect(safari.host_permissions).toEqual(hosts);
    expect(firefox.version).toBe('1.6.1');
    expect(firefox.permissions).toEqual(['storage', ...hosts]);
    expect(firefox.browser_specific_settings.gecko.data_collection_permissions.required).toEqual(['none']);
  });

  test('keeps only public-safe mobile screenshots at their verified dimensions', async () => {
    const screenshots = new Map([
      ['packages/studynav/store/mobile/screenshots/en/iphone-onboarding.png', { width: 1206, height: 2622 }],
      ['packages/studynav/store/mobile/screenshots/en/ipad-onboarding.png', { width: 1640, height: 2360 }],
      ['packages/studynav/store/mobile/screenshots/ru/iphone-onboarding.png', { width: 1206, height: 2622 }],
      ['packages/studynav/store/mobile/screenshots/evidence/selection-tools.png', { width: 780, height: 1688 }],
      ['packages/studynav/store/mobile/screenshots/evidence/note-editor.png', { width: 780, height: 1688 }],
      ['packages/studynav/store/mobile/screenshots/evidence/popup.png', { width: 780, height: 3034 }],
    ]);
    for (const [path, dimensions] of screenshots) {
      expect(await pngSize(path)).toEqual(dimensions);
    }

    const inventory = [
      ...(await readdir(resolve(ROOT, 'packages/studynav/store/mobile/screenshots/en'))).map((name) => `en/${name}`),
      ...(await readdir(resolve(ROOT, 'packages/studynav/store/mobile/screenshots/ru'))).map((name) => `ru/${name}`),
      ...(await readdir(resolve(ROOT, 'packages/studynav/store/mobile/screenshots/evidence'))).map((name) => `evidence/${name}`),
    ].sort();
    expect(inventory).toEqual([
      'en/ipad-onboarding.png',
      'en/iphone-onboarding.png',
      'evidence/note-editor.png',
      'evidence/popup.png',
      'evidence/selection-tools.png',
      'ru/iphone-onboarding.png',
    ]);
  });
});
