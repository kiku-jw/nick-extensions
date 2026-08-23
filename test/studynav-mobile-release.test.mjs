import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
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

describe('StudyNav Mobile 1.6.1 local release packet', () => {
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
    expect(packet).toContain('AMO signing, upload, review, and public distribution are separate gates.');
    expect(packet).toContain('screenshots/evidence/safari-iphone-popup-ru.png');
    expect(packet).toContain('screenshots/evidence/safari-ipad-popup-ru.png');
    expect(packet).toContain('requires installation of the official Android SDK');
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

  test('keeps the mobile screenshot evidence present at its verified dimensions', async () => {
    const screenshots = new Map([
      ['packages/studynav/store/mobile/screenshots/en/iphone-onboarding.png', { width: 1206, height: 2622 }],
      ['packages/studynav/store/mobile/screenshots/en/ipad-onboarding.png', { width: 1640, height: 2360 }],
      ['packages/studynav/store/mobile/screenshots/ru/iphone-onboarding.png', { width: 1206, height: 2622 }],
      ['packages/studynav/store/mobile/screenshots/evidence/safari-iphone-popup-ru.png', { width: 1206, height: 2622 }],
      ['packages/studynav/store/mobile/screenshots/evidence/safari-ipad-popup-ru.png', { width: 1640, height: 2360 }],
    ]);
    for (const [path, dimensions] of screenshots) {
      expect(await pngSize(path)).toEqual(dimensions);
    }
  });
});
