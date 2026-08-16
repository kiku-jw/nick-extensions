import {
  buildAllowlistRuleSpecs,
  createSerialTaskQueue,
  type AllowlistRuleActionType,
  type DnrResourceTypeValue,
  isAllowlistedHost,
  normalizeHostname,
} from './hosts';
import { coerceSettings, DEFAULT_SETTINGS, LIST_IDS, type ClearShieldSettings } from './types';

const CTX_TOGGLE = 'clearshield-toggle-site';
const TAB_BLOCKED_STORAGE_KEY = 'tabBlockedCounts';
const mutateBlockedState = createSerialTaskQueue();

const DNR_RESOURCE_TYPE_MAP = {
  main_frame: chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
  sub_frame: chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
  stylesheet: chrome.declarativeNetRequest.ResourceType.STYLESHEET,
  script: chrome.declarativeNetRequest.ResourceType.SCRIPT,
  image: chrome.declarativeNetRequest.ResourceType.IMAGE,
  font: chrome.declarativeNetRequest.ResourceType.FONT,
  object: chrome.declarativeNetRequest.ResourceType.OBJECT,
  xmlhttprequest: chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
  ping: chrome.declarativeNetRequest.ResourceType.PING,
  media: chrome.declarativeNetRequest.ResourceType.MEDIA,
  websocket: chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
  other: chrome.declarativeNetRequest.ResourceType.OTHER,
} satisfies Record<DnrResourceTypeValue, chrome.declarativeNetRequest.ResourceType>;

const DNR_ACTION_TYPE_MAP = {
  allowAllRequests: chrome.declarativeNetRequest.RuleActionType.ALLOW_ALL_REQUESTS,
  allow: chrome.declarativeNetRequest.RuleActionType.ALLOW,
} satisfies Record<AllowlistRuleActionType, chrome.declarativeNetRequest.RuleActionType>;

async function loadSettings(): Promise<ClearShieldSettings> {
  return coerceSettings(await chrome.storage.local.get(DEFAULT_SETTINGS));
}

async function saveSettings(partial: Partial<ClearShieldSettings>): Promise<ClearShieldSettings> {
  const cur = await loadSettings();
  const next = coerceSettings({
    ...cur,
    ...partial,
    lists: { ...cur.lists, ...(partial.lists ?? {}) },
    allowlist: partial.allowlist ?? cur.allowlist,
  });
  await chrome.storage.local.set(next);
  return next;
}

function tabCountKey(tabId: number): string {
  return `tb_${tabId}`;
}

function readSessionCountBag(value: unknown): Record<string, number> {
  if (value === null || typeof value !== 'object') return {};
  const next: Record<string, number> = {};
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) next[key] = count;
  }
  return next;
}

async function loadTabBlockedCounts(): Promise<Record<string, number>> {
  const stored = await chrome.storage.session.get({ [TAB_BLOCKED_STORAGE_KEY]: {} });
  return readSessionCountBag(stored[TAB_BLOCKED_STORAGE_KEY]);
}

async function saveTabBlockedCounts(counts: Record<string, number>): Promise<void> {
  await chrome.storage.session.set({ [TAB_BLOCKED_STORAGE_KEY]: counts });
}

async function readTabBlockedCount(tabId: number): Promise<number> {
  const counts = await loadTabBlockedCounts();
  return counts[tabCountKey(tabId)] ?? 0;
}

async function resetTabBlockedCount(tabId: number): Promise<void> {
  await mutateBlockedState(async () => {
    const counts = await loadTabBlockedCounts();
    delete counts[tabCountKey(tabId)];
    await saveTabBlockedCounts(counts);
  });
}

function readBlockedTotal(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_SETTINGS.blockedTotal;
}

async function recordBlockedMatch(tabId: number): Promise<number> {
  return mutateBlockedState(async () => {
    const stored = await chrome.storage.local.get({ blockedTotal: DEFAULT_SETTINGS.blockedTotal });
    const blockedTotal = readBlockedTotal(stored.blockedTotal) + 1;
    await chrome.storage.local.set({ blockedTotal });

    if (tabId < 0) return 0;

    const counts = await loadTabBlockedCounts();
    const key = tabCountKey(tabId);
    const next = (counts[key] ?? 0) + 1;
    counts[key] = next;
    await saveTabBlockedCounts(counts);
    return next;
  });
}

function toChromeResourceTypes(
  resourceTypes: readonly DnrResourceTypeValue[],
): chrome.declarativeNetRequest.ResourceType[] {
  return resourceTypes.map((type) => DNR_RESOURCE_TYPE_MAP[type]);
}

async function applyEnabledState(settings: ClearShieldSettings): Promise<void> {
  const enable: string[] = [];
  const disable: string[] = [];
  for (const id of LIST_IDS) {
    const on = settings.enabled && !!settings.lists[id];
    (on ? enable : disable).push(id);
  }
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enable,
      disableRulesetIds: disable,
    });
  } catch (e) {
    console.warn('ClearShield ruleset update failed', e);
  }
  await syncAllowlist(settings);
  await updateBadge(settings);
}

async function syncAllowlist(settings: ClearShieldSettings): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  const addRules: chrome.declarativeNetRequest.Rule[] = settings.enabled
    ? buildAllowlistRuleSpecs(settings.allowlist).map((rule) => ({
        id: rule.id,
        priority: rule.priority,
        action: { type: DNR_ACTION_TYPE_MAP[rule.actionType] },
        condition: {
          initiatorDomains: rule.initiatorDomains,
          resourceTypes: toChromeResourceTypes(rule.resourceTypes),
        },
      }))
    : [];

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  } catch (e) {
    console.warn('ClearShield dynamic rules update failed', e);
  }
}

async function updateBadge(settings: ClearShieldSettings, tabId?: number, tabUrl?: string): Promise<void> {
  if (!settings.enabled) {
    if (tabId != null) {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#888' });
      await chrome.action.setBadgeText({ tabId, text: 'off' });
    } else {
      await chrome.action.setBadgeBackgroundColor({ color: '#888' });
      await chrome.action.setBadgeText({ text: 'off' });
    }
    return;
  }

  let host = '';
  if (tabUrl) host = normalizeHostname(tabUrl) ?? '';

  if (tabId != null && host && isAllowlistedHost(settings.allowlist, host)) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#3bb273' });
    await chrome.action.setBadgeText({ tabId, text: 'ok' });
    return;
  }

  const count = tabId != null ? await readTabBlockedCount(tabId) : 0;
  if (tabId != null) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#2478DC' });
    await chrome.action.setBadgeText({ tabId, text: count > 0 ? String(count) : 'on' });
  } else {
    await chrome.action.setBadgeBackgroundColor({ color: '#2478DC' });
    await chrome.action.setBadgeText({ text: 'on' });
  }
}

async function refreshActiveBadge(): Promise<void> {
  const s = await loadSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) await updateBadge(s, tab.id, tab.url);
  else await updateBadge(s);
}

async function toggleSite(hostRaw: string): Promise<ClearShieldSettings> {
  const host = normalizeHostname(hostRaw);
  const s = await loadSettings();
  if (!host) return s;
  const set = new Set(s.allowlist);
  if (set.has(host)) set.delete(host); else set.add(host);
  const next = await saveSettings({ allowlist: [...set].sort() });
  await applyEnabledState(next);
  return next;
}

async function ensureContextMenu(): Promise<void> {
  try {
    await chrome.contextMenus.removeAll();
    await chrome.contextMenus.create({
      id: CTX_TOGGLE,
      title: 'Toggle ClearShield on this site',
      contexts: ['action', 'page'],
    });
  } catch (e) {
    console.warn('ClearShield context menu setup failed', e);
  }
}

async function bootstrap(): Promise<void> {
  const s = await loadSettings();
  // Seed missing keys on install/update without wiping user data
  await chrome.storage.local.set(s);
  await applyEnabledState(s);
  await ensureContextMenu();
  await refreshActiveBadge();
}

chrome.runtime.onInstalled.addListener(async () => {
  try { await bootstrap(); } catch (e) { console.warn('ClearShield onInstalled failed', e); }
});

chrome.runtime.onStartup.addListener(async () => {
  try { await bootstrap(); } catch (e) { console.warn('ClearShield onStartup failed', e); }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled || changes.allowlist || changes.lists) {
    const s = await loadSettings();
    await applyEnabledState(s);
    await refreshActiveBadge();
  }
});

chrome.tabs.onActivated.addListener(async () => {
  await refreshActiveBadge();
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status === 'loading' || info.url) {
    if (info.status === 'loading') await resetTabBlockedCount(tabId);
    const s = await loadSettings();
    await updateBadge(s, tabId, tab.url);
  }
});

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    if (info.request.type === chrome.declarativeNetRequest.ResourceType.MAIN_FRAME) return;
    if (info.rule.rulesetId === '_dynamic' && info.rule.ruleId >= 10000) return;
    const s = await loadSettings();
    if (!s.enabled) return;
    const host = normalizeHostname(info.request.initiator || info.request.url);
    if (host && isAllowlistedHost(s.allowlist, host)) return;
    const tabId = info.request.tabId;
    try {
      const count = await recordBlockedMatch(tabId);
      if (tabId >= 0) {
        await chrome.action.setBadgeText({ tabId, text: String(count) });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#2478DC' });
      }
    } catch { /* ignore */ }
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  void resetTabBlockedCount(tabId);
});

chrome.contextMenus?.onClicked?.addListener(async (info, tab) => {
  if (info.menuItemId !== CTX_TOGGLE) return;
  const host = normalizeHostname(tab?.url || info.pageUrl || '');
  if (!host) return;
  const next = await toggleSite(host);
  if (tab?.id != null) await updateBadge(next, tab.id, tab.url);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'GET_SETTINGS') {
        sendResponse(await loadSettings());
        return;
      }
      if (msg?.type === 'SET_SETTINGS') {
        const s = await saveSettings(msg.partial ?? {});
        await applyEnabledState(s);
        await refreshActiveBadge();
        sendResponse(s);
        return;
      }
      if (msg?.type === 'TOGGLE_SITE') {
        const next = await toggleSite(String(msg.host || ''));
        await refreshActiveBadge();
        sendResponse(next);
        return;
      }
      if (msg?.type === 'GET_TAB_BLOCKED') {
        const tabId = typeof msg.tabId === 'number' ? msg.tabId : -1;
        sendResponse({ count: tabId >= 0 ? await readTabBlockedCount(tabId) : 0 });
        return;
      }
      if (msg?.type === 'GET_RULE_COUNTS') {
        const counts: Record<string, number> = {};
        for (const id of LIST_IDS) {
          try {
            const url = chrome.runtime.getURL(`rules/${id}.json`);
            const res = await fetch(url);
            const rules = await res.json();
            counts[id] = Array.isArray(rules) ? rules.length : 0;
          } catch {
            counts[id] = 0;
          }
        }
        sendResponse({ counts, cosmeticSelectors: 0 });
        return;
      }
      if (msg?.type === 'EXPORT') {
        sendResponse(await loadSettings());
        return;
      }
      if (msg?.type === 'IMPORT') {
        const s = await saveSettings(coerceSettings(msg.settings));
        await applyEnabledState(s);
        await refreshActiveBadge();
        sendResponse(s);
        return;
      }
    } catch (e) {
      console.warn('ClearShield message handler error', e);
      sendResponse({ error: String(e) });
    }
  })();
  return true;
});

// Warm defaults if SW wakes without install event
bootstrap().catch(() => {});
