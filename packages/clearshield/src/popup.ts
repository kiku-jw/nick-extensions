import { getActiveTab } from '@nick/shared';
import { isAllowlistedHost, siteHostFromUrl } from './hosts';
import type { ClearShieldSettings } from './types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function msg<T>(payload: Record<string, unknown>): Promise<T> {
  return chrome.runtime.sendMessage(payload);
}

function restrictedHost(host: string | null): boolean {
  if (!host) return true;
  return /^(chrome|brave|edge|about|devtools|chrome-extension|moz-extension)/i.test(host);
}

async function refresh() {
  const settings = await msg<ClearShieldSettings>({ type: 'GET_SETTINGS' });
  const tab = await getActiveTab();
  const host = siteHostFromUrl(tab?.url);
  ($('enabled') as HTMLInputElement).checked = settings.enabled;
  $('host').textContent = host ?? '(no site)';
  $('totalBlocked').textContent = String(settings.blockedTotal || 0);

  const status = $('statusLine');
  const allowed = !!(host && isAllowlistedHost(settings.allowlist, host));
  if (!settings.enabled) {
    status.textContent = 'Protection off';
    status.className = 'status off';
  } else if (allowed) {
    status.textContent = 'Site allowlisted';
    status.className = 'status ok';
  } else {
    status.textContent = 'Blocking active';
    status.className = 'status on';
  }

  ($('list-easylist') as HTMLInputElement).checked = !!settings.lists.easylist;
  ($('list-easyprivacy') as HTMLInputElement).checked = !!settings.lists.easyprivacy;
  ($('list-baseline') as HTMLInputElement).checked = !!settings.lists.baseline;
  ($('cosmetic') as HTMLInputElement).checked = !!settings.cosmetic;

  const siteBtn = $('siteToggle') as HTMLButtonElement;
  if (restrictedHost(host)) {
    siteBtn.disabled = true;
    siteBtn.textContent = 'n/a';
    siteBtn.classList.remove('allowlisted', 'blocking');
  } else {
    siteBtn.disabled = false;
    siteBtn.textContent = allowed ? 'Allowed — click to block' : 'Blocking — click to allow';
    siteBtn.classList.toggle('allowlisted', allowed);
    siteBtn.classList.toggle('blocking', !allowed);
    siteBtn.onclick = async () => {
      await msg({ type: 'TOGGLE_SITE', host });
      await refresh();
    };
  }

  if (tab?.id != null) {
    const r = await msg<{ count: number }>({ type: 'GET_TAB_BLOCKED', tabId: tab.id });
    $('tabBlocked').textContent = String(r?.count ?? 0);
  }
}

async function persistLists() {
  await msg({
    type: 'SET_SETTINGS',
    partial: {
      cosmetic: ($('cosmetic') as HTMLInputElement).checked,
      lists: {
        easylist: ($('list-easylist') as HTMLInputElement).checked,
        easyprivacy: ($('list-easyprivacy') as HTMLInputElement).checked,
        baseline: ($('list-baseline') as HTMLInputElement).checked,
      },
    },
  });
  await refresh();
}

($('enabled') as HTMLInputElement).addEventListener('change', async (e) => {
  await msg({ type: 'SET_SETTINGS', partial: { enabled: (e.target as HTMLInputElement).checked } });
  await refresh();
});

for (const id of ['list-easylist', 'list-easyprivacy', 'list-baseline', 'cosmetic']) {
  $(id).addEventListener('change', persistLists);
}

$('openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

refresh();
