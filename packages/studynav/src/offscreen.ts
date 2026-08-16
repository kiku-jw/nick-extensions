import {
  assertChapterAudioSize,
  assertMediaClipSourceSize,
  bytesToBase64,
  encodeWavClip,
  isJwCdnUrl,
  selectVerseClipSource,
  validateMediaApiUrl,
  validateMediaAudioClipRequest,
  validateVerseAudioRequest,
} from './verse-audio';
import { t } from './i18n';

type OffscreenMessage = {
  target?: unknown;
  type?: unknown;
  request?: unknown;
  senderUrl?: unknown;
};

let busy = false;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function processMediaAudioClip(message: OffscreenMessage) {
  if (typeof message.senderUrl !== 'string') throw new Error(t('verse_page_unverified'));
  const request = validateMediaAudioClipRequest(message.request, message.senderUrl);
  if (!request) throw new Error(t('clip_request_rejected'));

  const response = await fetchWithTimeout(request.mediaUrl, 45_000);
  if (!response.ok) throw new Error(t('clip_source_download_failed'));
  if (!isJwCdnUrl(response.url)) throw new Error(t('chapter_audio_redirected'));
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 0) assertMediaClipSourceSize(declaredLength);
  const bytes = await response.arrayBuffer();
  assertMediaClipSourceSize(bytes.byteLength);

  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(bytes);
    if (!Number.isFinite(decoded.duration) || request.endSeconds > decoded.duration + 0.25) {
      throw new Error(t('clip_outside_media'));
    }
    const wav = encodeWavClip(decoded, request.startSeconds, request.endSeconds - request.startSeconds);
    return {
      ok: true,
      base64: bytesToBase64(wav),
      bytes: wav.byteLength,
      durationSeconds: request.endSeconds - request.startSeconds,
      filename: request.filename,
      mime: 'audio/wav',
    };
  } finally {
    await audioContext.close();
  }
}

async function processVerseAudio(message: OffscreenMessage) {
  if (typeof message.senderUrl !== 'string') throw new Error(t('verse_page_unverified'));
  const request = validateVerseAudioRequest(message.request, message.senderUrl);
  if (!request) throw new Error(t('verse_request_invalid'));

  const metadataResponse = await fetchWithTimeout(request.apiUrl, 15_000);
  if (!metadataResponse.ok) throw new Error(t('verse_timing_unavailable'));
  if (!validateMediaApiUrl(metadataResponse.url, request.verse)) {
    throw new Error(t('verse_timing_redirected'));
  }
  const metadata: unknown = await metadataResponse.json();
  const source = selectVerseClipSource(metadata, request.verse, request.label);
  if (!source) throw new Error(t('verse_timing_missing'));

  const audioResponse = await fetchWithTimeout(source.audioUrl, 45_000);
  if (!audioResponse.ok) throw new Error(t('chapter_audio_download_failed'));
  if (!isJwCdnUrl(audioResponse.url)) throw new Error(t('chapter_audio_redirected'));
  const declaredLength = Number(audioResponse.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 0) {
    assertChapterAudioSize(declaredLength, source.expectedBytes);
  }
  const chapterBytes = await audioResponse.arrayBuffer();
  assertChapterAudioSize(chapterBytes.byteLength, source.expectedBytes);

  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(chapterBytes);
    const wav = encodeWavClip(decoded, source.startSeconds, source.durationSeconds);
    return {
      ok: true,
      base64: bytesToBase64(wav),
      bytes: wav.byteLength,
      durationSeconds: source.durationSeconds,
      filename: source.filename,
      mime: 'audio/wav',
    };
  } finally {
    await audioContext.close();
  }
}

chrome.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
  if (
    message?.target !== 'studynav-offscreen' ||
    (message.type !== 'PROCESS_VERSE_AUDIO' && message.type !== 'PROCESS_MEDIA_AUDIO_CLIP')
  ) return;
  if (busy) {
    sendResponse({ ok: false, error: t('verse_job_busy') });
    return;
  }

  busy = true;
  const process = message.type === 'PROCESS_MEDIA_AUDIO_CLIP' ? processMediaAudioClip : processVerseAudio;
  process(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      const text = error instanceof Error ? error.message : t('verse_processing_failed');
      sendResponse({ ok: false, error: text });
    })
    .finally(() => {
      busy = false;
    });
  return true;
});
