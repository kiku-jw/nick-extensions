import { DEFAULT_FLAGS, type FeatureFlags } from './features';
import { createApplyCoordinator } from './apply-coordinator';
import {
  applyFeatures,
  copyCurrentCitation,
  currentOfficialFinderUrl,
  currentSelectedVerseElements,
  currentStudyBookmarkCandidate,
  currentStudyBookmarkSaved,
  openOfficialJwLink,
  openPalette,
  showCurrentQr,
  teardownFeatures,
  toggleCurrentStudyBookmark,
} from './feature-impl';
import { currentSupport } from './util';
import { parseBibleVerseId } from './verse-audio';
import { t } from './i18n';
import { openStudyPanel } from './study-runtime';
import { continueWatchingStatus } from './media-progress-runtime';

async function flags(): Promise<FeatureFlags> {
  try {
    const f = await chrome.runtime.sendMessage({ type: 'GET_FLAGS' });
    if (f && typeof f === 'object') return { ...DEFAULT_FLAGS, ...f };
  } catch { /* fall through */ }
  try {
    const s = await chrome.storage.sync.get({ flags: DEFAULT_FLAGS });
    return { ...DEFAULT_FLAGS, ...(s.flags as FeatureFlags) };
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

let latest: FeatureFlags = DEFAULT_FLAGS;
let observer: MutationObserver | null = null;
let navListening = false;
let routeTimer: number | null = null;
let lastUrl = location.href;
const reconnectObserver = () => {
  if (!observer) return;
  try {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch { /* ignore */ }
};

const coordinator = createApplyCoordinator({
  clearTimer(id) {
    clearTimeout(id);
  },
  disconnectObserver() {
    observer?.disconnect();
  },
  reconnectObserver,
  runApply() {
    try {
      applyFeatures(latest);
    } catch (e) {
      console.warn('StudyNav applyFeatures', e);
    }
  },
  setTimer(fn, delayMs) {
    return window.setTimeout(fn, delayMs);
  },
});

function ensureObservers() {
  if (!observer) {
    observer = new MutationObserver(() => coordinator.schedule());
    reconnectObserver();
  }
  if (!navListening) {
    navListening = true;
    window.addEventListener('popstate', coordinator.schedule);
    window.addEventListener('hashchange', coordinator.schedule);
  }
  if (routeTimer == null) {
    lastUrl = location.href;
    routeTimer = window.setInterval(() => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      coordinator.schedule();
    }, 500);
  }
}

function stopObservers() {
  coordinator.cancel();
  observer?.disconnect();
  observer = null;
  if (navListening) {
    navListening = false;
    window.removeEventListener('popstate', coordinator.schedule);
    window.removeEventListener('hashchange', coordinator.schedule);
  }
  if (routeTimer != null) {
    clearInterval(routeTimer);
    routeTimer = null;
  }
}

async function boot() {
  try {
    latest = await flags();
    if (latest.masterEnabled === false) {
      stopObservers();
      teardownFeatures();
      document.documentElement.dataset.studynav = 'off';
      return;
    }

    ensureObservers();
    document.documentElement.dataset.studynav = '1';
    coordinator.flush();
  } catch (e) {
    console.warn('StudyNav boot', e);
    document.documentElement.dataset.studynav = 'error';
  }
}

boot();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.flags) boot();
});

async function currentPageStatus() {
  const support = currentSupport();
  const verseNodes = Array.from(document.querySelectorAll<HTMLElement>('.verse[id^="v"]'))
    .filter((node) => !!parseBibleVerseId(node.id));
  const selected = currentSelectedVerseElements()
    .map((node) => parseBibleVerseId(node.id))
    .filter((verse): verse is NonNullable<typeof verse> => !!verse);
  const kind = verseNodes.length
    ? 'bible'
    : support.media
      ? 'media'
      : support.article
        ? 'article'
        : support.palette
          ? 'search'
          : 'unsupported';
  const bookmarkCandidate = currentStudyBookmarkCandidate();
  return {
    active: latest.masterEnabled !== false && support.supported,
    enabledCount: Object.entries(latest).filter(([key, value]) => key !== 'masterEnabled' && value === true).length,
    kind,
    masterEnabled: latest.masterEnabled !== false,
    selectedVerse: selected.length === 1 ? selected[0] : null,
    selectedVerseRange: selected.length > 1 ? {
      chapter: selected[0].chapter,
      startVerse: selected[0].verse,
      endVerse: selected.at(-1)!.verse,
    } : null,
    officialOpenAvailable: !!currentOfficialFinderUrl(),
    bookmarkAvailable: latest.bookmarks && !!bookmarkCandidate,
    bookmarkSaved: latest.bookmarks && bookmarkCandidate ? await currentStudyBookmarkSaved() : false,
    continueWatching: continueWatchingStatus(),
    supported: support.supported,
    verseCount: verseNodes.length,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'GET_STUDYNAV_STATUS') {
    currentPageStatus()
      .then(sendResponse)
      .catch(() => sendResponse({ active: false, supported: false }));
    return true;
  }
  if (msg?.type === 'OPEN_PALETTE') {
    if (latest.masterEnabled === false || !latest.advSearch) return;
    try {
      openPalette();
    } catch (e) {
      console.warn('StudyNav palette', e);
    }
    return;
  }

  if (![
    'OPEN_STUDY_PANEL',
    'TOGGLE_STUDY_BOOKMARK',
    'COPY_STUDY_CITATION',
    'SHOW_STUDY_QR',
    'OPEN_OFFICIAL_JW_LINK',
  ].includes(msg?.type)) return;
  (async () => {
    if (latest.masterEnabled === false) return { ok: false, message: t('study_tools_off') };
    if (msg.type === 'OPEN_STUDY_PANEL') {
      return latest.annotations || latest.bookmarks
        ? openStudyPanel()
        : { ok: false, message: t('study_tools_off') };
    }
    if (msg.type === 'TOGGLE_STUDY_BOOKMARK') {
      return latest.bookmarks ? toggleCurrentStudyBookmark() : { ok: false, message: t('bookmarks_off') };
    }
    if (msg.type === 'COPY_STUDY_CITATION') {
      return latest.citations ? copyCurrentCitation() : { ok: false, message: t('citations_off') };
    }
    if (msg.type === 'SHOW_STUDY_QR') {
      return latest.qrShare ? showCurrentQr() : { ok: false, message: t('qr_sharing_off') };
    }
    return latest.officialOpen ? openOfficialJwLink() : { ok: false, message: t('official_links_off') };
  })().then(sendResponse).catch((error: unknown) => {
    console.warn('StudyNav page action', error);
    sendResponse({ ok: false, message: t('action_failed') });
  });
  return true;
});
