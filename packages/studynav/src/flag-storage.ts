import { MOBILE_BUILD } from './build-profile';
import type { FeatureFlags } from './features';
import { storageGet, storageSet } from './webext-compat';

type NormalizeFlags = (flags: Partial<FeatureFlags> | undefined) => FeatureFlags;

function validStoredFlags(value: unknown): Partial<FeatureFlags> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<FeatureFlags>
    : undefined;
}

export async function loadStoredFlags(normalize: NormalizeFlags): Promise<FeatureFlags> {
  const primary = MOBILE_BUILD ? chrome.storage.local : chrome.storage.sync;
  const current = validStoredFlags((await storageGet(primary, 'flags')).flags);
  if (current) return normalize(current);

  if (MOBILE_BUILD) {
    // 1.6.0 stored mobile settings in sync storage. Copy them once into the
    // local area without deleting the old value, then write only locally.
    const legacy = validStoredFlags((await storageGet(chrome.storage.sync, 'flags')).flags);
    if (legacy) {
      const migrated = normalize(legacy);
      await storageSet(chrome.storage.local, { flags: migrated });
      return migrated;
    }
  }

  return normalize(undefined);
}

export async function saveStoredFlags(flags: FeatureFlags): Promise<void> {
  const target = MOBILE_BUILD ? chrome.storage.local : chrome.storage.sync;
  await storageSet(target, { flags });
}
