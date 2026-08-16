import { DEFAULT_FLAGS, migrateFlagsForInstall, type FeatureFlags } from './features';
import { t } from './i18n';
import {
  validateMediaAudioClipRequest,
  validateVerseAudioRequest,
} from './verse-audio';

const OFFSCREEN_URL = 'offscreen.html';
let creatingOffscreen: Promise<void> | null = null;
let audioJob: Promise<unknown> | null = null;
let flagMutationQueue: Promise<void> = Promise.resolve();

async function load(): Promise<FeatureFlags> {
  const s = await chrome.storage.sync.get({ flags: DEFAULT_FLAGS });
  return { ...DEFAULT_FLAGS, ...(s.flags as FeatureFlags) };
}

function paletteEnabled(flags: FeatureFlags): boolean {
  return flags.masterEnabled !== false && !!flags.advSearch;
}

function mutateFlags(change: Partial<FeatureFlags>): Promise<FeatureFlags> {
  const task = flagMutationQueue.then(async () => {
    const next = { ...(await load()), ...change };
    await chrome.storage.sync.set({ flags: next });
    return next;
  });
  flagMutationQueue = task.then(() => undefined, () => undefined);
  return task;
}

async function ensureOffscreenDocument() {
  const documentUrl = chrome.runtime.getURL(OFFSCREEN_URL);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [documentUrl],
  });
  if (contexts.length) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: 'Decode official JW media and create a local user-selected WAV clip.',
    }).finally(() => {
      creatingOffscreen = null;
    });
  }
  await creatingOffscreen;
}

async function processMediaAudioClip(message: unknown, senderUrl: string) {
  const request = validateMediaAudioClipRequest(message, senderUrl);
  if (!request) return { ok: false, error: t('clip_request_rejected') };
  if (audioJob) return { ok: false, error: t('verse_job_busy') };

  audioJob = (async () => {
    await ensureOffscreenDocument();
    return chrome.runtime.sendMessage({
      target: 'studynav-offscreen',
      type: 'PROCESS_MEDIA_AUDIO_CLIP',
      request,
      senderUrl,
    });
  })();

  try {
    return await audioJob;
  } finally {
    audioJob = null;
    try {
      await chrome.offscreen.closeDocument();
    } catch {
      // The browser may already have reclaimed the document.
    }
  }
}

async function processVerseAudio(message: unknown, senderUrl: string) {
  const request = validateVerseAudioRequest(message, senderUrl);
  if (!request) return { ok: false, error: t('verse_request_rejected') };
  if (audioJob) return { ok: false, error: t('verse_job_busy') };

  audioJob = (async () => {
    await ensureOffscreenDocument();
    return chrome.runtime.sendMessage({
      target: 'studynav-offscreen',
      type: 'PROCESS_VERSE_AUDIO',
      request: {
        type: 'DOWNLOAD_VERSE_AUDIO',
        verseId: request.verseId,
        apiUrl: request.apiUrl,
        label: request.label,
      },
      senderUrl,
    });
  })();

  try {
    return await audioJob;
  } finally {
    audioJob = null;
    try {
      await chrome.offscreen.closeDocument();
    } catch {
      // The browser may already have reclaimed the document.
    }
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const cur = await chrome.storage.sync.get('flags');
  await chrome.storage.sync.set({
    flags: migrateFlagsForInstall(cur.flags as Partial<FeatureFlags> | undefined, details),
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === 'studynav-offscreen') return false;
  (async () => {
    if (msg?.type === 'GET_FLAGS') {
      sendResponse(await load());
      return;
    }
    if (msg?.type === 'SET_FLAGS') {
      sendResponse(await mutateFlags(msg.flags));
      return;
    }
    if (msg?.type === 'SET_FLAG') {
      sendResponse(await mutateFlags({ [msg.id]: !!msg.value }));
      return;
    }
    if (msg?.type === 'DOWNLOAD_VERSE_AUDIO') {
      sendResponse(await processVerseAudio(msg, sender.tab?.url || ''));
      return;
    }
    if (msg?.type === 'DOWNLOAD_MEDIA_AUDIO_CLIP') {
      sendResponse(await processMediaAudioClip(msg, sender.tab?.url || ''));
      return;
    }
  })().catch((error: unknown) => {
    const text = error instanceof Error ? error.message : t('verse_processing_failed');
    sendResponse({ ok: false, error: text });
  });
  return true;
});

chrome.commands?.onCommand?.addListener(async (command) => {
  if (command !== 'adv-search') return;
  const flags = await load();
  if (!paletteEnabled(flags)) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'OPEN_PALETTE' }).catch(() => {});
});
