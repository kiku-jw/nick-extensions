import { afterEach, describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  EN_MESSAGES,
  featureBlurbKey,
  featureNameKey,
  t,
  uiLanguage,
} from '../packages/studynav/src/i18n.ts';
import { FEATURE_META } from '../packages/studynav/src/features.ts';

const ROOT = resolve(import.meta.dir, '..');
const originalChrome = globalThis.chrome;

afterEach(() => {
  if (originalChrome === undefined) delete globalThis.chrome;
  else globalThis.chrome = originalChrome;
});

async function json(path) {
  return JSON.parse(await readFile(resolve(ROOT, path), 'utf8'));
}

describe('StudyNav localization contract', () => {
  test('ships complete English and Russian Chrome locale catalogs', async () => {
    const english = await json('packages/studynav/public/_locales/en/messages.json');
    const russian = await json('packages/studynav/public/_locales/ru/messages.json');
    const expected = Object.keys(EN_MESSAGES).sort();
    expect(Object.keys(english).sort()).toEqual(expected);
    expect(Object.keys(russian).sort()).toEqual(expected);
    for (const key of expected) {
      expect(english[key]?.message).toBe(EN_MESSAGES[key]);
      expect(typeof russian[key]?.message).toBe('string');
      expect(russian[key].message.trim().length).toBeGreaterThan(0);
    }
  });

  test('keeps every localized manifest description within the 132-character platform limit', async () => {
    const english = await json('packages/studynav/public/_locales/en/messages.json');
    const russian = await json('packages/studynav/public/_locales/ru/messages.json');
    for (const locale of [english, russian]) {
      expect(locale.extension_description.message.length).toBeLessThanOrEqual(132);
      expect(locale.extension_mobile_description.message.length).toBeLessThanOrEqual(132);
    }
  });

  test('keeps shared mobile copy platform-neutral for Safari and Firefox', async () => {
    const english = await json('packages/studynav/public/_locales/en/messages.json');
    const russian = await json('packages/studynav/public/_locales/ru/messages.json');
    const sharedMobileKeys = [
      'extension_mobile_description',
      'popup_mobile_header_subtitle',
      'status_media_mobile_hint',
    ];
    for (const locale of [english, russian]) {
      const mobileCopy = sharedMobileKeys.map((key) => locale[key].message).join(' ');
      expect(mobileCopy).not.toMatch(/Edge|Android|Safari|Firefox|Эдж|Андроид|Сафари|Файрфокс/i);
    }
  });

  test('has localized metadata keys for all 23 feature flags', () => {
    expect(FEATURE_META).toHaveLength(23);
    for (const feature of FEATURE_META) {
      expect(EN_MESSAGES[featureNameKey(feature.id)]).toBeTruthy();
      expect(EN_MESSAGES[featureBlurbKey(feature.id)]).toBeTruthy();
    }
  });

  test('uses English fallback and numbered substitutions without Chrome APIs', () => {
    delete globalThis.chrome;
    expect(t('status_bible_selected', ['3', '16'])).toBe(
      'Verse 3:16 is selected. Choose Select several to include the verses that follow.',
    );
    expect(uiLanguage()).toBe('en');
  });

  test('uses the browser locale catalog and detects Russian UI locale', () => {
    globalThis.chrome = {
      i18n: {
        getMessage(key, substitutions) {
          if (key === 'enabled_count') return `Включено: ${substitutions}`;
          return '';
        },
        getUILanguage() {
          return 'ru-RU';
        },
      },
    };
    expect(t('enabled_count', '23')).toBe('Включено: 23');
    expect(uiLanguage()).toBe('ru');
  });

  test('finishes numbered substitutions when Safari returns an untranslated placeholder', () => {
    globalThis.chrome = {
      i18n: {
        getMessage(key) {
          return key === 'status_bible_selected'
            ? 'Выбран стих $1:$2. Нажмите «Выбрать несколько», чтобы добавить следующие стихи.'
            : '';
        },
        getUILanguage() {
          return 'ru-RU';
        },
      },
    };
    expect(t('status_bible_selected', ['1', '3'])).toBe(
      'Выбран стих 1:3. Нажмите «Выбрать несколько», чтобы добавить следующие стихи.',
    );
  });

  test('localizes manifest identity and command metadata through Chrome i18n', async () => {
    const manifest = await json('packages/studynav/manifest.json');
    expect(manifest.version).toBe('1.6.2');
    expect(manifest.default_locale).toBe('en');
    expect(manifest.name).toBe('__MSG_extension_name__');
    expect(manifest.short_name).toBe('__MSG_extension_short_name__');
    expect(manifest.description).toBe('__MSG_extension_description__');
    expect(manifest.action.default_title).toBe('__MSG_extension_name__');
    expect(manifest.commands['adv-search'].description).toBe('__MSG_command_adv_search__');
  });

  test('ships platform manifests with one localized mobile identity and exact site access', async () => {
    const safari = await json('packages/studynav/manifest.safari-ios.json');
    const firefox = await json('packages/studynav/manifest.firefox-android.json');
    const expectedHosts = [
      'https://jw.org/*',
      'https://www.jw.org/*',
      'https://wol.jw.org/*',
    ];

    for (const manifest of [safari, firefox]) {
      expect(manifest.version).toBe('1.6.1');
      expect(manifest.name).toBe('__MSG_extension_mobile_name__');
      expect(manifest.description).toBe('__MSG_extension_mobile_description__');
      expect(manifest.commands).toBeUndefined();
      expect(JSON.stringify(manifest)).not.toContain('offscreen');
      expect(JSON.stringify(manifest)).not.toContain('jw-cdn.org');
      expect(manifest.content_scripts[0].matches).toEqual(expectedHosts);
    }

    expect(safari.manifest_version).toBe(3);
    expect(safari.permissions).toEqual(['storage']);
    expect(safari.host_permissions).toEqual(expectedHosts);
    expect(safari.background.service_worker).toBe('background.js');
    expect(safari.browser_specific_settings.safari.strict_min_version).toBe('15.4');

    expect(firefox.manifest_version).toBe(2);
    expect(firefox.permissions).toEqual(['storage', ...expectedHosts]);
    expect(firefox.background).toEqual({ scripts: ['background.js'], persistent: false });
    expect(firefox.browser_specific_settings.gecko.id).toBe('studynav-mobile@kikuai.dev');
    expect(firefox.browser_specific_settings.gecko.strict_min_version).toBe('142.0');
    expect(firefox.browser_specific_settings.gecko.data_collection_permissions.required).toEqual(['none']);
    expect(firefox.browser_specific_settings.gecko_android.strict_min_version).toBe('142.0');
  });

  test('retains the archived Edge Mobile manifest as a reproducible historical target', async () => {
    const manifest = await json('packages/studynav/manifest.edge-mobile.json');
    expect(manifest.version).toBe('1.6.0');
    expect(manifest.version_name).toBe('1.6.0 Edge Android');
    expect(manifest.name).toBe('__MSG_extension_mobile_name__');
    expect(manifest.description).toBe('__MSG_extension_mobile_description__');
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions).toEqual([
      'https://jw.org/*',
      'https://www.jw.org/*',
      'https://wol.jw.org/*',
    ]);
    expect(manifest.commands).toBeUndefined();
    expect(JSON.stringify(manifest)).not.toContain('offscreen');
    expect(JSON.stringify(manifest)).not.toContain('jw-cdn.org');
  });
});
