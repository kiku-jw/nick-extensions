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

  test('has localized metadata keys for all 22 feature flags', () => {
    expect(FEATURE_META).toHaveLength(22);
    for (const feature of FEATURE_META) {
      expect(EN_MESSAGES[featureNameKey(feature.id)]).toBeTruthy();
      expect(EN_MESSAGES[featureBlurbKey(feature.id)]).toBeTruthy();
    }
  });

  test('uses English fallback and numbered substitutions without Chrome APIs', () => {
    delete globalThis.chrome;
    expect(t('status_bible_selected', ['3', '16'])).toBe(
      'Verse 3:16 is selected. Choose Download audio beside it.',
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
    expect(t('enabled_count', '22')).toBe('Включено: 22');
    expect(uiLanguage()).toBe('ru');
  });

  test('localizes manifest identity and command metadata through Chrome i18n', async () => {
    const manifest = await json('packages/studynav/manifest.json');
    expect(manifest.version).toBe('1.4.0');
    expect(manifest.default_locale).toBe('en');
    expect(manifest.name).toBe('__MSG_extension_name__');
    expect(manifest.short_name).toBe('__MSG_extension_short_name__');
    expect(manifest.description).toBe('__MSG_extension_description__');
    expect(manifest.action.default_title).toBe('__MSG_extension_name__');
    expect(manifest.commands['adv-search'].description).toBe('__MSG_command_adv_search__');
  });
});
