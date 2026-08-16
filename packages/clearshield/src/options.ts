import { COSMETIC_SELECTORS } from './cosmetic';
import { normalizeAllowlistHosts } from './hosts';
import type { ClearShieldSettings } from './types';

async function msg<T>(payload: Record<string, unknown>): Promise<T> {
  return chrome.runtime.sendMessage(payload);
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function loadCounts() {
  try {
    const res = await msg<{ counts: Record<string, number> }>({ type: 'GET_RULE_COUNTS' });
    const counts = res?.counts || {};
    for (const id of ['baseline', 'easylist', 'easyprivacy'] as const) {
      const el = $(`count-${id}`);
      if (el) el.textContent = `${counts[id] ?? 0} rules`;
    }
    $('count-cosmetic').textContent = `${COSMETIC_SELECTORS.length} selectors`;
    const total = (counts.baseline || 0) + (counts.easylist || 0) + (counts.easyprivacy || 0);
    $('ruleSummary').textContent = `Bundled static rules: ${total.toLocaleString()} (caps: EasyList 12k, EasyPrivacy 8k, Baseline small).`;
  } catch {
    $('ruleSummary').textContent = 'Rule counts unavailable.';
  }
}

async function load() {
  const s = await msg<ClearShieldSettings>({ type: 'GET_SETTINGS' });
  ($('list-baseline') as HTMLInputElement).checked = s.lists.baseline;
  ($('list-easylist') as HTMLInputElement).checked = s.lists.easylist;
  ($('list-easyprivacy') as HTMLInputElement).checked = s.lists.easyprivacy;
  ($('cosmetic') as HTMLInputElement).checked = s.cosmetic;
  ($('allowlist') as HTMLTextAreaElement).value = s.allowlist.join('\n');
  $('allowMeta').textContent = `${s.allowlist.length} host(s)`;
  await loadCounts();
}

async function saveLists() {
  await msg({
    type: 'SET_SETTINGS',
    partial: {
      cosmetic: ($('cosmetic') as HTMLInputElement).checked,
      lists: {
        baseline: ($('list-baseline') as HTMLInputElement).checked,
        easylist: ($('list-easylist') as HTMLInputElement).checked,
        easyprivacy: ($('list-easyprivacy') as HTMLInputElement).checked,
      },
    },
  });
  $('status').textContent = 'Saved lists.';
}

for (const id of ['list-baseline', 'list-easylist', 'list-easyprivacy', 'cosmetic']) {
  $(id).addEventListener('change', saveLists);
}

$('saveAllow').addEventListener('click', async () => {
  const unique = normalizeAllowlistHosts(($('allowlist') as HTMLTextAreaElement).value.split(/\n+/));
  await msg({ type: 'SET_SETTINGS', partial: { allowlist: unique } });
  $('status').textContent = `Saved ${unique.length} allowlist host(s).`;
  await load();
});

$('exportBtn').addEventListener('click', async () => {
  const s = await msg<ClearShieldSettings>({ type: 'EXPORT' });
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clearshield-settings.json';
  a.click();
  URL.revokeObjectURL(url);
  $('status').textContent = 'Exported settings JSON.';
});

$('importFile').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const settings = JSON.parse(await file.text());
    await msg({ type: 'IMPORT', settings });
    $('status').textContent = 'Imported settings.';
    await load();
  } catch (err) {
    $('status').textContent = 'Import failed: ' + String(err);
  }
});

load();
