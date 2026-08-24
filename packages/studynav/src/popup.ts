import {
  DEFAULT_FLAGS,
  MOBILE_DEFAULT_FLAGS,
  mobileFlags,
  FEATURE_META,
  isMobileFeature,
  type FeatureFlags,
  type FeatureGroup,
  type FeatureId,
} from './features';
import { featureBlurbKey, featureNameKey, localizeDocument, t, type MessageKey } from './i18n';
import { buildImageSearchUrl } from './document-actions';
import { MOBILE_BUILD } from './build-profile';
import { copyToClipboard } from '@nick/shared';
import { rankStudyNavPageTabs } from './page-tab';
import {
  createTab,
  queryTabs,
  runtimeMessage,
  sendTabMessage,
} from './webext-compat';

const list = document.getElementById('list')!;
const filterEl = document.getElementById('filter') as HTMLInputElement;
const masterEl = document.getElementById('master') as HTMLInputElement;
const enabledCountEl = document.getElementById('enabled-count')!;
const statusEl = document.getElementById('page-status')!;
const statusTitleEl = document.getElementById('status-title')!;
const statusHintEl = document.getElementById('status-hint')!;
const actionFeedbackEl = document.getElementById('action-feedback')!;
const actionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.action-grid button'));
let currentFlags: FeatureFlags = { ...DEFAULT_FLAGS };
let currentPageStatus: PageStatus | null = null;
let currentPageTabId: number | null = null;
const BUILD_DEFAULT_FLAGS = MOBILE_BUILD ? MOBILE_DEFAULT_FLAGS : DEFAULT_FLAGS;
const BUILD_FEATURE_META = MOBILE_BUILD
  ? FEATURE_META.filter((meta) => isMobileFeature(meta.id))
  : FEATURE_META;

function normalizeBuildFlags(value: Partial<FeatureFlags> | undefined): FeatureFlags {
  const flags = { ...BUILD_DEFAULT_FLAGS, ...value };
  return MOBILE_BUILD ? mobileFlags(flags) : flags;
}

async function load(): Promise<FeatureFlags> {
  return normalizeBuildFlags(await runtimeMessage({ type: 'GET_FLAGS' }));
}

function enabledCount(flags: FeatureFlags): number {
  return BUILD_FEATURE_META.filter((meta) => flags[meta.id]).length;
}

function updateEnabledCount() {
  enabledCountEl.textContent = t('enabled_count', String(enabledCount(currentFlags)));
}

function row(meta: typeof FEATURE_META[number], on: boolean) {
  const el = document.createElement('div');
  el.className = 'row';
  const name = t(featureNameKey(meta.id));
  const blurb = t(featureBlurbKey(meta.id));
  el.dataset.name = `${name} ${blurb} ${meta.group}`.toLocaleLowerCase();

  const copy = document.createElement('div');
  const nameEl = document.createElement('div');
  nameEl.className = 'name';
  nameEl.textContent = name;
  const blurbEl = document.createElement('div');
  blurbEl.className = 'blurb';
  blurbEl.textContent = blurb;
  copy.append(nameEl, blurbEl);

  const label = document.createElement('label');
  label.className = 'switch';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.dataset.id = meta.id;
  input.setAttribute('aria-label', name);
  input.checked = on;
  label.append(input, document.createElement('span'));
  el.append(copy, label);

  input.addEventListener('change', async (e) => {
    const id = meta.id as FeatureId;
    const value = (e.target as HTMLInputElement).checked;
    await runtimeMessage({ type: 'SET_FLAG', id, value });
    currentFlags = { ...currentFlags, [id]: value };
    updateEnabledCount();
    updateActionAvailability();
  });
  return el;
}

function applyFilter() {
  const q = filterEl.value.trim().toLowerCase();
  list.querySelectorAll('.row').forEach((el) => {
    const hay = (el as HTMLElement).dataset.name || '';
    el.classList.toggle('hidden', !!q && !hay.includes(q));
  });
}

type PageStatus = {
  active?: unknown;
  kind?: unknown;
  masterEnabled?: unknown;
  selectedVerse?: unknown;
  selectedVerseRange?: unknown;
  supported?: unknown;
  officialOpenAvailable?: unknown;
  bookmarkAvailable?: unknown;
  bookmarkSaved?: unknown;
};

async function pageMessageTabs(): Promise<chrome.tabs.Tab[]> {
  const current = await queryTabs({ active: true, currentWindow: true });
  if (!MOBILE_BUILD) return current;
  const active = await queryTabs({ active: true });
  const all = await queryTabs({});
  return rankStudyNavPageTabs([current, active, all]) as chrome.tabs.Tab[];
}

async function sendPageMessage(message: { type: string }): Promise<unknown> {
  const queried = await pageMessageTabs();
  const tabs = currentPageTabId == null
    ? queried
    : [{ id: currentPageTabId } as chrome.tabs.Tab, ...queried.filter((tab) => tab.id !== currentPageTabId)];
  for (const tab of tabs) {
    if (typeof tab.id !== 'number') continue;
    try {
      const response: unknown = await sendTabMessage(tab.id, message);
      if (response && typeof response === 'object') {
        currentPageTabId = tab.id;
        return response;
      }
    } catch {
      if (tab.id === currentPageTabId) currentPageTabId = null;
    }
  }
  return null;
}

async function readPageStatus(): Promise<PageStatus | null> {
  try {
    const status = await sendPageMessage({ type: 'GET_STUDYNAV_STATUS' });
    return status && typeof status === 'object' ? status as PageStatus : null;
  } catch {
    return null;
  }
}

async function renderPageStatus() {
  const status = await readPageStatus();
  currentPageStatus = status;
  updateActionAvailability();
  if (currentFlags.masterEnabled === false || status?.masterEnabled === false) {
    statusEl.dataset.state = 'off';
    statusTitleEl.textContent = t('status_tools_off_title');
    statusHintEl.textContent = t('status_tools_off_hint');
    return;
  }
  if (!status || status.supported !== true || status.active !== true) {
    statusEl.dataset.state = 'idle';
    statusTitleEl.textContent = t('status_unavailable_title');
    statusHintEl.textContent = t(MOBILE_BUILD
      ? 'status_mobile_unavailable_hint'
      : 'status_unavailable_hint');
    return;
  }

  statusEl.dataset.state = 'ready';
  if (status.kind === 'bible') {
    const selected = status.selectedVerse;
    const selectedRange = status.selectedVerseRange;
    statusTitleEl.textContent = t('status_bible_title');
    statusHintEl.textContent = selectedRange && typeof selectedRange === 'object' &&
      'chapter' in selectedRange && 'startVerse' in selectedRange && 'endVerse' in selectedRange
      ? t(MOBILE_BUILD ? 'status_bible_range_mobile' : 'status_bible_range', [
          String(selectedRange.chapter),
          String(selectedRange.startVerse),
          String(selectedRange.endVerse),
        ])
      : selected && typeof selected === 'object' &&
      'chapter' in selected && 'verse' in selected
      ? t('status_bible_selected', [String(selected.chapter), String(selected.verse)])
      : t(MOBILE_BUILD ? 'status_bible_hint_mobile' : 'status_bible_hint');
  } else if (status.kind === 'media') {
    statusTitleEl.textContent = t(MOBILE_BUILD ? 'status_media_mobile_title' : 'status_media_title');
    statusHintEl.textContent = t(MOBILE_BUILD ? 'status_media_mobile_hint' : 'status_media_hint');
  } else if (status.kind === 'article') {
    statusTitleEl.textContent = t('status_article_title');
    statusHintEl.textContent = t(MOBILE_BUILD ? 'status_article_hint_mobile' : 'status_article_hint');
  } else {
    statusTitleEl.textContent = t('status_palette_title');
    statusHintEl.textContent = t('status_palette_hint');
  }
}

function updateActionAvailability() {
  const ready = currentFlags.masterEnabled !== false &&
    currentPageStatus?.supported === true && currentPageStatus?.active === true;
  for (const button of actionButtons) {
    const feature = button.dataset.feature as FeatureId | undefined;
    const anyFeatures = (button.dataset.anyFeature || '').split(',').filter(Boolean) as FeatureId[];
    const enabledByFlag = feature ? !!currentFlags[feature] : anyFeatures.some((id) => !!currentFlags[id]);
    const officialUnavailable = button.id === 'open-official' && currentPageStatus?.officialOpenAvailable !== true;
    const bookmarkUnavailable = button.id === 'save-place' && currentPageStatus?.bookmarkAvailable !== true;
    button.disabled = !ready || !enabledByFlag || officialUnavailable || bookmarkUnavailable;
  }
  const saveButton = document.getElementById('save-place');
  if (saveButton) saveButton.textContent = t(currentPageStatus?.bookmarkSaved === true ? 'remove_saved_place' : 'save_place');
}

const ACTION_MESSAGES: Record<string, string> = {
  'open-notes': 'OPEN_STUDY_PANEL',
  'save-place': 'TOGGLE_STUDY_BOOKMARK',
  'copy-citation': 'COPY_STUDY_CITATION',
  'show-qr': 'SHOW_STUDY_QR',
  'open-official': 'OPEN_OFFICIAL_JW_LINK',
};

type PageActionResult = {
  ok?: unknown;
  message?: unknown;
  copiedText?: unknown;
  targetUrl?: unknown;
};

function officialFinderTarget(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.jw.org' && url.pathname === '/finder'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function runPageAction(button: HTMLButtonElement) {
  const type = ACTION_MESSAGES[button.id];
  if (!type || button.disabled) return;
  button.disabled = true;
  actionFeedbackEl.textContent = t('working');
  try {
    const response = await sendPageMessage({ type });
    if (!response) throw new Error(t('no_active_tab'));
    const result = response && typeof response === 'object' ? response as PageActionResult : null;
    let message = typeof result?.message === 'string'
      ? result.message
      : t('done');
    if (button.id === 'copy-citation' && typeof result?.copiedText === 'string') {
      if (await copyToClipboard(result.copiedText)) message = t('citation_copied');
    }
    if (button.id === 'open-official' && result?.ok !== true) {
      const targetUrl = officialFinderTarget(result?.targetUrl);
      if (targetUrl) {
        await createTab({ url: targetUrl });
        message = t('official_link_opened');
      }
    }
    actionFeedbackEl.textContent = message;
    if (button.id === 'save-place') await renderPageStatus();
  } catch {
    actionFeedbackEl.textContent = t('unavailable_here');
  } finally {
    window.setTimeout(() => {
      actionFeedbackEl.textContent = '';
      updateActionAvailability();
    }, 1400);
  }
}

(async () => {
  localizeDocument();
  if (MOBILE_BUILD) {
    document.title = t('extension_mobile_name');
    document.querySelector<HTMLElement>('[data-i18n="popup_header_subtitle"]')!.textContent = t('popup_mobile_header_subtitle');
    document.getElementById('guide-bible-text')!.textContent = t('guide_bible_mobile_text');
    document.getElementById('guide-articles-text')!.textContent = t('guide_articles_mobile_text');
  }
  currentFlags = normalizeBuildFlags(await load());
  masterEl.checked = currentFlags.masterEnabled !== false;
  masterEl.addEventListener('change', async () => {
    await runtimeMessage({ type: 'SET_FLAG', id: 'masterEnabled', value: masterEl.checked });
    currentFlags = { ...currentFlags, masterEnabled: masterEl.checked };
    await renderPageStatus();
  });

  list.innerHTML = '';
  const groups: { key: FeatureGroup; title: MessageKey }[] = [
    { key: 'study', title: 'group_study' },
    { key: 'core', title: 'group_core' },
    { key: 'layout', title: 'group_layout' },
    { key: 'media', title: 'group_media' },
  ];
  for (const g of groups) {
    const items = BUILD_FEATURE_META.filter((meta) => meta.group === g.key);
    if (!items.length) continue;
    const h = document.createElement('div');
    h.className = 'group';
    h.textContent = t(g.title);
    list.appendChild(h);
    for (const meta of items) {
      list.appendChild(row(meta, !!currentFlags[meta.id]));
    }
  }
  filterEl.addEventListener('input', applyFilter);
  actionButtons.forEach((button) => button.addEventListener('click', () => void runPageAction(button)));
  STUDYNAV_DESKTOP_ONLY: if (!MOBILE_BUILD) {
    document.getElementById('image-search')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = document.getElementById('image-search-query') as HTMLInputElement | null;
      const url = input ? buildImageSearchUrl(input.value) : null;
      if (url) void createTab({ url });
    });
  }
  document.getElementById('reset-defaults')?.addEventListener('click', async () => {
    await runtimeMessage({ type: 'SET_FLAGS', flags: BUILD_DEFAULT_FLAGS });
    currentFlags = { ...BUILD_DEFAULT_FLAGS };
    masterEl.checked = true;
    list.querySelectorAll<HTMLInputElement>('input[data-id]').forEach((input) => {
      input.checked = !!currentFlags[input.dataset.id as FeatureId];
    });
    actionFeedbackEl.textContent = t('defaults_restored');
    updateEnabledCount();
    await renderPageStatus();
    window.setTimeout(() => { actionFeedbackEl.textContent = ''; }, 1_600);
  });
  updateEnabledCount();
  await renderPageStatus();
})();
