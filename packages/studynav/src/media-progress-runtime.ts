import {
  createMediaProgressId,
  createMediaProgressRecord,
  pruneMediaProgress,
  upsertMediaProgress,
  type MediaProgressRecord,
} from './study-data';
import { canonicalStudyUrl, cleanCitationText } from './document-actions';
import { t } from './i18n';
import { loadStudyData, mutateStudyData, studyDataChanged } from './study-storage';
import { qs, toast } from './util';

export const MEDIA_PROGRESS_SAVE_INTERVAL_MS = 5_000;
const RESUME_BUTTON_ID = 'studynav-resume-media';

type VideoListeners = {
  lastTimedSave: number;
  onTimeUpdate: () => void;
  onPause: () => void;
  onEnded: () => void;
};

let enabled = false;
let trackedVideos: HTMLVideoElement[] = [];
let listeners = new Map<HTMLVideoElement, VideoListeners>();
let toolbar: HTMLElement | null = null;
let runtimePageUrl = '';
let refreshGeneration = 0;
let storageListening = false;
let globalListening = false;
let pruneStarted = false;

export function shouldSaveTimedProgress(lastSavedAt: number, now: number): boolean {
  return Number.isFinite(now) && now >= lastSavedAt + MEDIA_PROGRESS_SAVE_INTERVAL_MS;
}

export function formatMediaTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const remaining = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export function normalizeMediaSourceIdentity(
  candidates: readonly string[],
  stableElementId: string,
  index: number,
  baseUrl: string,
): string {
  for (const candidate of candidates) {
    const value = candidate.trim();
    if (!value || value.startsWith('blob:') || value.startsWith('data:')) continue;
    try {
      const url = new URL(value, baseUrl);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
      url.hash = '';
      return url.href;
    } catch {
      /* Try the next page-owned source candidate. */
    }
  }
  const stable = cleanCitationText(stableElementId).slice(0, 256);
  return stable ? `element:${stable}` : `dom-video:${Math.max(0, index)}`;
}

function currentPageUrl(): string | null {
  const canonical = qs<HTMLLinkElement>('link[rel="canonical"][href]')?.href || null;
  return canonicalStudyUrl(location.href, canonical);
}

function pageTitle(): string {
  const heading = qs<HTMLElement>('#article h1, article h1, main h1, h1');
  return cleanCitationText(heading?.innerText || heading?.textContent || document.title || 'JW.ORG').slice(0, 512);
}

function sourceForVideo(video: HTMLVideoElement): string {
  const index = Math.max(0, trackedVideos.indexOf(video));
  const childSource = video.querySelector<HTMLSourceElement>('source[src]');
  const stableId = video.id || video.dataset.videoId || video.dataset.mediaId || video.getAttribute('data-media-id') || '';
  return normalizeMediaSourceIdentity([
    video.getAttribute('src') || '',
    childSource?.getAttribute('src') || '',
    video.src,
    childSource?.src || '',
    video.currentSrc,
  ], stableId, index, location.href);
}

function progressIdForVideo(video: HTMLVideoElement): string | null {
  const pageUrl = currentPageUrl();
  return pageUrl ? createMediaProgressId(pageUrl, sourceForVideo(video)) : null;
}

function recordForVideo(video: HTMLVideoElement, now: number): MediaProgressRecord | null {
  const pageUrl = currentPageUrl();
  if (!pageUrl || video.ended) return null;
  return createMediaProgressRecord(
    pageUrl,
    sourceForVideo(video),
    pageTitle(),
    video.currentTime,
    video.duration,
    now,
  );
}

function reportStorageFailure(error: unknown) {
  console.warn('StudyNav media progress', error);
  toast(error instanceof Error ? error.message : t('video_progress_save_failed'));
}

async function persistVideo(video: HTMLVideoElement) {
  if (!enabled || !trackedVideos.includes(video)) return;
  const now = Date.now();
  const id = progressIdForVideo(video);
  const record = recordForVideo(video, now);
  try {
    await mutateStudyData((current) => ({
      ...current,
      mediaProgress: record
        ? upsertMediaProgress(current.mediaProgress, record, now)
        : pruneMediaProgress(current.mediaProgress, now).filter((item) => item.id !== id),
    }));
  } catch (error) {
    reportStorageFailure(error);
  }
}

function persistAllTracked() {
  for (const video of trackedVideos) void persistVideo(video);
}

const visibilityHandler = () => {
  if (document.visibilityState === 'hidden') persistAllTracked();
};

const pageHideHandler = () => persistAllTracked();

function activeTrackedVideo(): HTMLVideoElement | null {
  return trackedVideos.find((video) => !video.paused && !video.ended) || trackedVideos[0] || null;
}

function removeResumeButton() {
  document.getElementById(RESUME_BUTTON_ID)?.remove();
}

function seekWithoutAutoplay(video: HTMLVideoElement, record: MediaProgressRecord) {
  const upperBound = Number.isFinite(video.duration) ? Math.max(0, video.duration - 5) : record.duration - 5;
  const target = Math.max(0, Math.min(record.currentTime, upperBound));
  try {
    video.currentTime = target;
    toast(t('ready_at', formatMediaTime(target)));
  } catch {
    toast(t('resume_wait_loading'));
  }
}

async function refreshResumeControl() {
  const generation = ++refreshGeneration;
  if (!enabled || !toolbar?.isConnected) {
    removeResumeButton();
    return;
  }
  const video = activeTrackedVideo();
  const id = video ? progressIdForVideo(video) : null;
  if (!video || !id) {
    removeResumeButton();
    return;
  }
  try {
    const data = await loadStudyData();
    if (!enabled || generation !== refreshGeneration || !toolbar?.isConnected) return;
    const record = pruneMediaProgress(data.mediaProgress, Date.now()).find((item) => item.id === id);
    if (!record) {
      removeResumeButton();
      return;
    }
    let button = document.getElementById(RESUME_BUTTON_ID) as HTMLButtonElement | null;
    if (!button) {
      button = document.createElement('button');
      button.id = RESUME_BUTTON_ID;
      button.type = 'button';
      toolbar.prepend(button);
    }
    button.textContent = t('resume_at', formatMediaTime(record.currentTime));
    button.title = t('resume_title');
    button.onclick = () => {
      const details = button?.closest('details');
      if (details instanceof HTMLDetailsElement) details.open = false;
      seekWithoutAutoplay(video, record);
    };
  } catch (error) {
    reportStorageFailure(error);
  }
}

function removeVideo(video: HTMLVideoElement) {
  const entry = listeners.get(video);
  if (!entry) return;
  video.removeEventListener('timeupdate', entry.onTimeUpdate);
  video.removeEventListener('pause', entry.onPause);
  video.removeEventListener('ended', entry.onEnded);
  listeners.delete(video);
}

function addVideo(video: HTMLVideoElement) {
  if (listeners.has(video)) return;
  const entry: VideoListeners = {
    lastTimedSave: 0,
    onTimeUpdate: () => {
      const now = Date.now();
      if (!shouldSaveTimedProgress(entry.lastTimedSave, now)) return;
      entry.lastTimedSave = now;
      void persistVideo(video);
    },
    onPause: () => void persistVideo(video),
    onEnded: () => void persistVideo(video),
  };
  listeners.set(video, entry);
  video.addEventListener('timeupdate', entry.onTimeUpdate);
  video.addEventListener('pause', entry.onPause);
  video.addEventListener('ended', entry.onEnded);
}

const storageChangeHandler = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => {
  if (enabled && studyDataChanged(changes, areaName)) void refreshResumeControl();
};

async function pruneStoredProgressOnce() {
  if (pruneStarted) return;
  pruneStarted = true;
  const now = Date.now();
  try {
    await mutateStudyData((current) => ({
      ...current,
      mediaProgress: pruneMediaProgress(current.mediaProgress, now),
    }));
  } catch (error) {
    reportStorageFailure(error);
  }
}

export function applyContinueWatching(videos: HTMLVideoElement[], nextToolbar: HTMLElement | null) {
  const nextPageUrl = currentPageUrl() || '';
  if (runtimePageUrl !== nextPageUrl) {
    runtimePageUrl = nextPageUrl;
    for (const entry of listeners.values()) entry.lastTimedSave = 0;
  }
  enabled = true;
  toolbar = nextToolbar;
  const connected = [...new Set(videos.filter((video) => video.isConnected))];
  for (const video of trackedVideos) {
    if (!connected.includes(video)) removeVideo(video);
  }
  trackedVideos = connected;
  for (const video of trackedVideos) addVideo(video);

  if (!globalListening) {
    globalListening = true;
    document.addEventListener('visibilitychange', visibilityHandler, true);
    window.addEventListener('pagehide', pageHideHandler, true);
  }
  if (!storageListening) {
    storageListening = true;
    chrome.storage.onChanged.addListener(storageChangeHandler);
  }
  void pruneStoredProgressOnce();
  void refreshResumeControl();
}

export function teardownContinueWatching() {
  enabled = false;
  refreshGeneration += 1;
  for (const video of [...listeners.keys()]) removeVideo(video);
  trackedVideos = [];
  toolbar = null;
  runtimePageUrl = '';
  pruneStarted = false;
  removeResumeButton();
  if (globalListening) {
    globalListening = false;
    document.removeEventListener('visibilitychange', visibilityHandler, true);
    window.removeEventListener('pagehide', pageHideHandler, true);
  }
  if (storageListening) {
    storageListening = false;
    chrome.storage.onChanged.removeListener(storageChangeHandler);
  }
}

export function continueWatchingStatus() {
  const active = activeTrackedVideo();
  return {
    enabled,
    trackedVideoCount: trackedVideos.length,
    listenerCount: listeners.size,
    resumeAvailable: !!document.getElementById(RESUME_BUTTON_ID),
    activeRecordValid: !!active && !!recordForVideo(active, Date.now()),
    activeSnapshot: active ? {
      currentTime: active.currentTime,
      duration: active.duration,
      ended: active.ended,
      source: sourceForVideo(active),
      pageUrl: currentPageUrl(),
    } : null,
  };
}
