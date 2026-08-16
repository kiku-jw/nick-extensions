import { COSMETIC_SELECTORS } from './cosmetic';
import { isAllowlistedHost } from './hosts';
import { coerceSettings, DEFAULT_SETTINGS, type ClearShieldSettings } from './types';

async function settings(): Promise<ClearShieldSettings> {
  return coerceSettings(await chrome.storage.local.get(DEFAULT_SETTINGS));
}

async function applyCosmetic() {
  try {
    const s = await settings();
    const styleId = 'clearshield-cosmetic';
    if (!s.enabled || !s.cosmetic || isAllowlistedHost(s.allowlist, location.hostname)) {
      document.getElementById(styleId)?.remove();
      return;
    }
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      (document.documentElement || document.head || document.body).appendChild(style);
    }
    style.textContent = COSMETIC_SELECTORS.map((sel) => `${sel}{display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;}`).join('\n');
  } catch {
    /* never break the page */
  }
}

applyCosmetic();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled || changes.cosmetic || changes.allowlist) {
    applyCosmetic();
  }
});
