import { t } from './i18n';

const MEDIA_API_HOST = 'b.jw-cdn.org';
const MEDIA_API_PATH = '/apis/pub-media/getpubmedialinks';
const MAX_CHAPTER_AUDIO_BYTES = 64 * 1024 * 1024;
const MAX_VERSE_SECONDS = 120;
const MAX_WAV_BYTES = 24 * 1024 * 1024;
export const MAX_MEDIA_CLIP_SECONDS = 120;
export const MAX_MEDIA_VIDEO_CLIP_SECONDS = 60;

export type BibleVerse = {
  book: number;
  chapter: number;
  verse: number;
};

export type VerseAudioRequest = {
  type: 'DOWNLOAD_VERSE_AUDIO';
  verseId: string;
  apiUrl: string;
  label: string;
};

export type MediaAudioClipRequest = {
  type: 'DOWNLOAD_MEDIA_AUDIO_CLIP';
  mediaUrl: string;
  startSeconds: number;
  endSeconds: number;
  label: string;
};

export type ValidatedMediaAudioClipRequest = MediaAudioClipRequest & {
  filename: string;
};

export type MediaVideoClipRequest = {
  type: 'DOWNLOAD_MEDIA_VIDEO_CLIP';
  mediaUrl: string;
  startSeconds: number;
  endSeconds: number;
  label: string;
};

export type ValidatedMediaVideoClipRequest = MediaVideoClipRequest & {
  filename: string;
};

export type ValidatedVerseAudioRequest = {
  verse: BibleVerse;
  verseId: string;
  apiUrl: string;
  label: string;
};

export type VerseClipSource = {
  audioUrl: string;
  startSeconds: number;
  durationSeconds: number;
  filename: string;
  expectedBytes: number | null;
};

type AudioBufferLike = {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseBibleVerseId(value: string): BibleVerse | null {
  const match = /^v([1-9]\d?)(\d{3})(\d{3})$/.exec(value);
  if (!match) return null;
  const verse = {
    book: Number(match[1]),
    chapter: Number(match[2]),
    verse: Number(match[3]),
  };
  if (
    verse.book < 1 || verse.book > 66 ||
    verse.chapter < 1 || verse.chapter > 150 ||
    verse.verse < 1 || verse.verse > 200
  ) return null;
  return verse;
}

export function isJwCdnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (url.hostname === 'jw-cdn.org' || url.hostname.endsWith('.jw-cdn.org'));
  } catch {
    return false;
  }
}

const BIBLE_CHAPTER_PATH_RES = [
  /^\/[a-z]{2}(?:-[a-z]+)?\/library\/bible\/[^/]+\/books\/[^/]+\/(\d+)\/?$/i,
  /^\/[a-z]{2}(?:-[a-z]+)?\/(?:biblioteka|biblioteca|bibliothek|bibliotheque|bibliotek)\/[^/]+\/[^/]+\/(?:books|knigi|libros|livres|buecher|libri)\/[^/]+\/(\d+)\/?$/i,
  /^\/ru\/библиотека\/библия\/(?:nwt\/(?:содержание|книги)|учебная-библия\/книги)\/[^/]+\/(\d+)\/?$/iu,
  /^\/uk\/бібліотека\/біблія\/(?:nwt|навчальне-видання-біблії)\/книги\/[^/]+\/(\d+)\/?$/iu,
] as const;

export function parseBibleChapterFromPath(pathname: string): number | null {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname).normalize('NFC');
  } catch {
    return null;
  }
  for (const pattern of BIBLE_CHAPTER_PATH_RES) {
    const match = pattern.exec(decodedPath);
    if (match) return Number(match[1]);
  }
  return null;
}

function mediaApiShell(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== MEDIA_API_HOST ||
      url.pathname.toLowerCase() !== MEDIA_API_PATH ||
      url.username ||
      url.password
    ) return null;
    if (url.searchParams.get('output')?.toLowerCase() !== 'json') return null;
    if (url.searchParams.get('fileformat')?.toUpperCase() !== 'MP3') return null;
    return url;
  } catch {
    return null;
  }
}

export function normalizeMediaApiUrl(value: string, verse: BibleVerse): string | null {
  const url = mediaApiShell(value);
  if (!url) return null;

  const langwritten = url.searchParams.get('langwritten');
  const txtCMSLang = url.searchParams.get('txtCMSLang');
  if (!langwritten || !txtCMSLang || langwritten !== txtCMSLang) return null;

  const pub = url.searchParams.get('pub');
  if (pub === 'nwtsty' || pub === 'nwt') url.searchParams.set('pub', 'nwt');
  else if (!pub) return null;

  if (!url.searchParams.has('booknum')) url.searchParams.set('booknum', String(verse.book));
  if (!url.searchParams.has('track')) url.searchParams.set('track', String(verse.chapter));
  if (!url.searchParams.has('alllangs')) url.searchParams.set('alllangs', '0');

  return validateMediaApiUrl(url.href, verse);
}

export function validateMediaApiUrl(value: string, verse: BibleVerse): string | null {
  const url = mediaApiShell(value);
  if (!url) return null;
  if (Number(url.searchParams.get('booknum')) !== verse.book) return null;
  if (Number(url.searchParams.get('track')) !== verse.chapter) return null;
  if (!url.searchParams.get('langwritten') || !url.searchParams.get('txtCMSLang')) return null;
  const pub = url.searchParams.get('pub');
  if (pub !== 'nwt') return null;
  return url.href;
}

export function validateVerseAudioRequest(
  value: unknown,
  senderUrl: string,
): ValidatedVerseAudioRequest | null {
  if (!isRecord(value) || value.type !== 'DOWNLOAD_VERSE_AUDIO') return null;
  if (
    typeof value.verseId !== 'string' ||
    typeof value.apiUrl !== 'string' ||
    typeof value.label !== 'string'
  ) return null;

  const verse = parseBibleVerseId(value.verseId);
  if (!verse) return null;

  try {
    const page = new URL(senderUrl);
    const isJw = page.hostname === 'jw.org' || page.hostname.endsWith('.jw.org');
    const chapter = parseBibleChapterFromPath(page.pathname);
    if (!isJw || !/^https?:$/.test(page.protocol) || chapter === null) return null;
    if (chapter !== verse.chapter) return null;
  } catch {
    return null;
  }

  const apiUrl = validateMediaApiUrl(value.apiUrl, verse);
  if (!apiUrl) return null;
  return {
    verse,
    verseId: value.verseId,
    apiUrl,
    label: value.label.slice(0, 120),
  };
}

export function parseUserMediaTime(value: string): number | null {
  const parts = String(value || '').trim().split(':');
  if (!parts.length || parts.length > 3 || parts.some((part) => !/^\d+(?:\.\d{1,3})?$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 1) return numbers[0] <= 36_000 ? numbers[0] : null;
  const seconds = numbers.at(-1)!;
  const minutes = numbers.at(-2)!;
  if (seconds >= 60 || minutes >= 60) return null;
  const hours = parts.length === 3 ? numbers[0] : 0;
  if (hours > 10) return null;
  return hours * 3_600 + minutes * 60 + seconds;
}

export function validateMediaAudioClipRequest(
  value: unknown,
  senderUrl: string,
): ValidatedMediaAudioClipRequest | null {
  if (!isRecord(value) || value.type !== 'DOWNLOAD_MEDIA_AUDIO_CLIP') return null;
  if (
    typeof value.mediaUrl !== 'string' ||
    typeof value.label !== 'string'
  ) return null;
  const startSeconds = finiteNumber(value.startSeconds);
  const endSeconds = finiteNumber(value.endSeconds);
  if (
    startSeconds === null ||
    endSeconds === null ||
    startSeconds < 0 ||
    endSeconds <= startSeconds ||
    endSeconds - startSeconds > MAX_MEDIA_CLIP_SECONDS ||
    endSeconds > 36_000 ||
    !isJwCdnUrl(value.mediaUrl)
  ) return null;

  try {
    const sender = new URL(senderUrl);
    const allowedHost = sender.hostname === 'jw.org' || sender.hostname.endsWith('.jw.org');
    if (sender.protocol !== 'https:' || !allowedHost || sender.username || sender.password) return null;
  } catch {
    return null;
  }

  const label = safeFilenamePart(value.label);
  const startLabel = Math.floor(startSeconds).toString().padStart(4, '0');
  const endLabel = Math.floor(endSeconds).toString().padStart(4, '0');
  return {
    type: 'DOWNLOAD_MEDIA_AUDIO_CLIP',
    mediaUrl: value.mediaUrl,
    startSeconds,
    endSeconds,
    label,
    filename: `${label}_${startLabel}-${endLabel}.wav`,
  };
}

export function validateMediaVideoClipRequest(
  value: unknown,
  senderUrl: string,
): ValidatedMediaVideoClipRequest | null {
  if (!isRecord(value) || value.type !== 'DOWNLOAD_MEDIA_VIDEO_CLIP') return null;
  if (typeof value.mediaUrl !== 'string' || typeof value.label !== 'string') return null;
  const startSeconds = finiteNumber(value.startSeconds);
  const endSeconds = finiteNumber(value.endSeconds);
  if (
    startSeconds === null ||
    endSeconds === null ||
    startSeconds < 0 ||
    endSeconds <= startSeconds ||
    endSeconds - startSeconds > MAX_MEDIA_VIDEO_CLIP_SECONDS ||
    endSeconds > 36_000 ||
    !isJwCdnUrl(value.mediaUrl)
  ) return null;

  try {
    const sender = new URL(senderUrl);
    const allowedHost = sender.hostname === 'jw.org' || sender.hostname.endsWith('.jw.org');
    if (sender.protocol !== 'https:' || !allowedHost || sender.username || sender.password) return null;
  } catch {
    return null;
  }

  const label = safeFilenamePart(value.label);
  const startLabel = Math.floor(startSeconds).toString().padStart(4, '0');
  const endLabel = Math.floor(endSeconds).toString().padStart(4, '0');
  return {
    type: 'DOWNLOAD_MEDIA_VIDEO_CLIP',
    mediaUrl: value.mediaUrl,
    startSeconds,
    endSeconds,
    label,
    filename: `${label}_${startLabel}-${endLabel}.webm`,
  };
}

function apiUrlFromAudioUrl(audioUrl: string, verse: BibleVerse): string | null {
  if (!isJwCdnUrl(audioUrl)) return null;
  try {
    const name = decodeURIComponent(new URL(audioUrl).pathname.split('/').pop() || '');
    const match = /^([a-z0-9]+)_(\d{2})_[^_]+_([a-z0-9-]+)_(\d{2,3})\.mp3$/i.exec(name);
    if (!match || Number(match[2]) !== verse.book || Number(match[4]) !== verse.chapter) return null;
    const url = new URL(`https://${MEDIA_API_HOST}/apis/pub-media/GETPUBMEDIALINKS`);
    url.search = new URLSearchParams({
      booknum: String(verse.book),
      output: 'json',
      pub: match[1] === 'nwtsty' ? 'nwt' : match[1],
      fileformat: 'MP3',
      alllangs: '0',
      track: String(verse.chapter),
      langwritten: match[3],
      txtCMSLang: match[3],
    }).toString();
    return validateMediaApiUrl(url.href, verse);
  } catch {
    return null;
  }
}

export function findBibleAudioApiUrl(
  resourceUrls: readonly string[],
  verseId: string,
  chapterAudioUrl = '',
): string | null {
  const verse = parseBibleVerseId(verseId);
  if (!verse) return null;
  for (let index = resourceUrls.length - 1; index >= 0; index--) {
    const normalized = normalizeMediaApiUrl(resourceUrls[index], verse);
    if (normalized) return normalized;
    const valid = validateMediaApiUrl(resourceUrls[index], verse);
    if (valid) return valid;
  }
  return apiUrlFromAudioUrl(chapterAudioUrl, verse);
}

export function parseMediaClock(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (minutes > 59 || seconds > 59) return null;
  const milliseconds = Number((match[4] || '').padEnd(3, '0'));
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

export function safeFilenamePart(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f/\\?%*:|"<>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 80) || 'Bible';
}

export function selectVerseClipSource(
  payload: unknown,
  verse: BibleVerse,
  label: string,
): VerseClipSource | null {
  if (!isRecord(payload) || !isRecord(payload.files)) return null;

  for (const languageFiles of Object.values(payload.files)) {
    if (!isRecord(languageFiles) || !Array.isArray(languageFiles.MP3)) continue;
    for (const item of languageFiles.MP3) {
      if (!isRecord(item) || !isRecord(item.file) || !isRecord(item.markers)) continue;
      if (
        Number(item.markers.bibleBookNumber) !== verse.book ||
        Number(item.markers.bibleBookChapter) !== verse.chapter ||
        !Array.isArray(item.markers.markers)
      ) continue;
      const marker = item.markers.markers.find((candidate) =>
        isRecord(candidate) && Number(candidate.verseNumber) === verse.verse);
      if (!isRecord(marker) || typeof item.file.url !== 'string' || !isJwCdnUrl(item.file.url)) continue;

      const startSeconds = parseMediaClock(marker.startTime);
      const durationSeconds = parseMediaClock(marker.duration);
      const trackDuration = finiteNumber(item.duration);
      const expectedBytes = finiteNumber(item.filesize);
      if (
        startSeconds === null ||
        durationSeconds === null ||
        startSeconds < 0 ||
        durationSeconds <= 0 ||
        durationSeconds > MAX_VERSE_SECONDS ||
        (trackDuration !== null && startSeconds + durationSeconds > trackDuration + 1) ||
        (expectedBytes !== null && (expectedBytes <= 0 || expectedBytes > MAX_CHAPTER_AUDIO_BYTES))
      ) continue;

      return {
        audioUrl: item.file.url,
        startSeconds,
        durationSeconds,
        filename: `${safeFilenamePart(label)}_${verse.chapter}_${verse.verse}.wav`,
        expectedBytes,
      };
    }
  }
  return null;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index++) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function encodeWavClip(
  buffer: AudioBufferLike,
  startSeconds: number,
  durationSeconds: number,
): Uint8Array {
  if (
    !Number.isFinite(buffer.sampleRate) ||
    buffer.sampleRate < 8000 ||
    buffer.sampleRate > 192000 ||
    !Number.isInteger(buffer.length) ||
    buffer.length <= 0 ||
    !Number.isInteger(buffer.numberOfChannels) ||
    buffer.numberOfChannels <= 0
  ) throw new Error(t('decoded_audio_invalid'));

  const channelCount = Math.min(2, buffer.numberOfChannels);
  const startFrame = Math.max(0, Math.floor(startSeconds * buffer.sampleRate));
  const requestedFrames = Math.ceil(durationSeconds * buffer.sampleRate);
  const frameCount = Math.min(requestedFrames, buffer.length - startFrame);
  if (frameCount <= 0) throw new Error(t('verse_outside_audio'));

  const dataBytes = frameCount * channelCount * 2;
  const totalBytes = 44 + dataBytes;
  if (totalBytes > MAX_WAV_BYTES) throw new Error(t('verse_audio_too_large'));

  const output = new Uint8Array(totalBytes);
  const view = new DataView(output.buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, totalBytes - 8, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  const channels = Array.from({ length: channelCount }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][startFrame + frame] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return output;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function assertChapterAudioSize(actualBytes: number, expectedBytes: number | null) {
  if (actualBytes <= 0 || actualBytes > MAX_CHAPTER_AUDIO_BYTES) {
    throw new Error(t('chapter_audio_too_large'));
  }
  if (expectedBytes !== null && actualBytes > Math.max(expectedBytes * 1.05, expectedBytes + 4096)) {
    throw new Error(t('chapter_audio_size_mismatch'));
  }
}

export function assertMediaClipSourceSize(actualBytes: number) {
  if (!Number.isFinite(actualBytes) || actualBytes <= 0 || actualBytes > MAX_CHAPTER_AUDIO_BYTES) {
    throw new Error(t('clip_source_too_large'));
  }
}
