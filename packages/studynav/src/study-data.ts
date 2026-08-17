/**
 * Browser-API-free local study data primitives for StudyNav.
 *
 * This module deliberately owns the serialized shape and all trust-boundary
 * validation. Callers should treat values returned by the validators as the
 * only records safe to persist or render.
 */

import { isAllowedStudyNavPageUrl } from './page-origin';

/** The pre-1.4 key is deliberately retained for read-only migration. */
export const STUDY_DATA_LEGACY_STORAGE_KEY = 'studynavStudyDataV1' as const;
export const STUDY_DATA_V2_STORAGE_KEY = 'studynavStudyDataV2' as const;
export const STUDY_DATA_STORAGE_KEY = STUDY_DATA_V2_STORAGE_KEY;
export const STUDY_DATA_STORAGE_KEY_V1 = STUDY_DATA_LEGACY_STORAGE_KEY;
export const STUDY_DATA_STORAGE_KEY_V2 = STUDY_DATA_V2_STORAGE_KEY;
export const STUDY_DATA_V1_STORAGE_KEY = STUDY_DATA_LEGACY_STORAGE_KEY;
export const STUDY_DATA_V2_KEY = STUDY_DATA_V2_STORAGE_KEY;
export const STUDY_DATA_SCHEMA_V1 = 1 as const;
export const STUDY_DATA_SCHEMA_VERSION = 2 as const;
export const STUDY_DATA_SCHEMA_VERSION_V1 = STUDY_DATA_SCHEMA_V1;
export const STUDY_DATA_SCHEMA_VERSION_V2 = STUDY_DATA_SCHEMA_VERSION;

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange'] as const;
export type HighlightColor = typeof HIGHLIGHT_COLORS[number];

export const MAX_BACKUP_JSON_BYTES = 5 * 1024 * 1024;
export const MAX_ANNOTATIONS = 5_000;
export const MAX_TEXT_LENGTH = 10_000;
export const MAX_CONTEXT_LENGTH = 32;
export const MAX_NOTE_LENGTH = 20_000;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 48;
export const MAX_URL_LENGTH = 2_048;
export const MAX_TITLE_LENGTH = 512;
export const MAX_IDENTIFIER_LENGTH = 256;
export const MAX_MEDIA_PROGRESS = 500;
export const MAX_BOOKMARKS = 500;
export const MAX_SAVED_PLACES = MAX_BOOKMARKS;
export const MAX_BOOKMARK_RECORDS = MAX_BOOKMARKS;
export const MAX_REFERENCE_LENGTH = 512;
export const MAX_MEDIA_SOURCE_LENGTH = 2_048;
export const MAX_TIMESTAMP = Number.MAX_SAFE_INTEGER;
export const MEDIA_PROGRESS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

export type RootReference = {
  id?: string;
  dataPid?: string;
  dataVerse?: string;
};

export type TextQuoteSelector = {
  exact: string;
  prefix: string;
  suffix: string;
};

export type TextPositionSelector = {
  start: number;
  end: number;
};

export type TextSelector = TextQuoteSelector & TextPositionSelector;

export type AnnotationRecord = {
  id: string;
  pageUrl: string;
  title: string;
  root: RootReference;
  selector: TextSelector;
  color: HighlightColor;
  note: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type MediaProgressRecord = {
  id: string;
  pageUrl: string;
  mediaSource: string;
  title: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
};

export type BookmarkRecord = {
  id: string;
  pageUrl: string;
  targetUrl: string;
  title: string;
  reference: string;
  createdAt: number;
  updatedAt: number;
};

export type SavedPlaceRecord = BookmarkRecord;
export type SavedPlace = BookmarkRecord;

export type LegacyStudyDataV1 = {
  schemaVersion: typeof STUDY_DATA_SCHEMA_V1;
  annotations: AnnotationRecord[];
  mediaProgress: MediaProgressRecord[];
};

export type StudyDataV2 = {
  schemaVersion: typeof STUDY_DATA_SCHEMA_VERSION;
  annotations: AnnotationRecord[];
  mediaProgress: MediaProgressRecord[];
  bookmarks: BookmarkRecord[];
};

export type StudyData = StudyDataV2;
export type ValidStudyDataV2 = StudyDataV2;

/**
 * Deprecated caller-facing name retained for existing StudyNav modules. New
 * storage values are schema-v2 values; the union also describes legacy backup
 * envelopes accepted by the import primitives.
 */
export type StudyDataV1 = LegacyStudyDataV1 | StudyDataV2;

/** Schema-valid but intentionally untrusted record arrays awaiting merge validation. */
export type StudyDataEnvelopeInputV1 = {
  schemaVersion: typeof STUDY_DATA_SCHEMA_V1;
  annotations: unknown[];
  mediaProgress: unknown[];
};

export type StudyDataEnvelopeInputV2 = {
  schemaVersion: typeof STUDY_DATA_SCHEMA_VERSION;
  annotations: unknown[];
  mediaProgress: unknown[];
  bookmarks: unknown[];
};

export type StudyDataEnvelopeInput = StudyDataEnvelopeInputV1 | StudyDataEnvelopeInputV2;

export type RootTextSnapshot = {
  root: RootReference;
  text: string;
};

export type TextResolutionMethod = 'position' | 'saved-root-quote' | 'other-root-quote';

export type TextResolution = {
  root: RootReference;
  start: number;
  end: number;
  exact: string;
  method: TextResolutionMethod;
  recovered: boolean;
};

export type ImportStats = {
  accepted: number;
  updated: number;
  ignored: number;
  rejected: number;
};

export type ImportResult = {
  data: ValidStudyDataV2;
  stats: ImportStats;
};

export type BackupParseError = 'invalid-input' | 'too-large' | 'invalid-json' | 'invalid-envelope';

export type BackupParseResult = {
  data: StudyDataEnvelopeInput | null;
  error: BackupParseError | null;
};

const EMPTY_IMPORT_STATS: ImportStats = {
  accepted: 0,
  updated: 0,
  ignored: 0,
  rejected: 0,
};

const ANNOTATION_KEYS = [
  'id',
  'pageUrl',
  'title',
  'root',
  'selector',
  'color',
  'note',
  'tags',
  'createdAt',
  'updatedAt',
] as const;

const ANNOTATION_REQUIRED_KEYS = [
  'id',
  'pageUrl',
  'title',
  'root',
  'selector',
  'color',
  'createdAt',
  'updatedAt',
] as const;

const MEDIA_PROGRESS_KEYS = [
  'id',
  'pageUrl',
  'mediaSource',
  'title',
  'currentTime',
  'duration',
  'updatedAt',
] as const;

const BOOKMARK_KEYS = [
  'id',
  'pageUrl',
  'targetUrl',
  'title',
  'reference',
  'createdAt',
  'updatedAt',
] as const;

const ROOT_KEYS = ['id', 'dataPid', 'dataVerse'] as const;
const SELECTOR_KEYS = ['exact', 'prefix', 'suffix', 'start', 'end'] as const;
const V1_ENVELOPE_KEYS = ['schemaVersion', 'annotations', 'mediaProgress'] as const;
const V2_ENVELOPE_KEYS = ['schemaVersion', 'annotations', 'mediaProgress', 'bookmarks'] as const;

type EnvelopeShape = StudyDataEnvelopeInput;

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const ownKeys = Object.keys(value);
  if (ownKeys.length !== keys.length) return false;
  const allowed = new Set(keys);
  return ownKeys.every((key) => allowed.has(key));
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function hasRequiredKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => hasOwn(value, key));
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function hasControlCharacters(value: string): boolean {
  return /[\u0000-\u001f\u007f]/u.test(value);
}

function finiteSafeInteger(value: unknown, minimum = 0, maximum = MAX_TIMESTAMP): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function finiteNumber(value: unknown, minimum = -Infinity, maximum = Infinity): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function boundedString(
  value: unknown,
  minimum: number,
  maximum: number,
  options: { allowControls?: boolean } = {},
): value is string {
  if (typeof value !== 'string') return false;
  if (codePointLength(value) < minimum || codePointLength(value) > maximum) return false;
  if (!options.allowControls && hasControlCharacters(value)) return false;
  return true;
}

function normalizeWhitespace(value: string): string {
  return value.normalize('NFKC').replace(/[\s\u00a0]+/gu, ' ').trim();
}

function normalizeIdentifier(value: unknown, maximum = MAX_IDENTIFIER_LENGTH): string | null {
  if (!boundedString(value, 1, maximum)) return null;
  const normalized = value.normalize('NFKC').trim();
  if (!normalized || codePointLength(normalized) > maximum || hasControlCharacters(normalized)) return null;
  return normalized;
}

function normalizeSupportedUrl(value: unknown, preserveHash: boolean): string | null {
  if (!boundedString(value, 1, MAX_URL_LENGTH)) return null;
  const source = value.trim();
  if (!source || hasControlCharacters(source)) return null;

  try {
    const url = new URL(source);
    if (!isAllowedStudyNavPageUrl(url)) return null;
    const encodedParts = [url.pathname, url.search, url.hash];
    if (encodedParts.some((part) => {
      try {
        return hasControlCharacters(decodeURIComponent(part));
      } catch {
        return true;
      }
    })) return null;
    url.hostname = url.hostname.toLowerCase();
    if (!preserveHash) url.hash = '';
    else if (hasControlCharacters(url.hash)) return null;
    url.pathname = (url.pathname || '/').normalize('NFC');
    url.searchParams.sort();
    const normalized = url.href;
    return boundedString(normalized, 1, MAX_URL_LENGTH) && !hasControlCharacters(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

/**
 * Return a canonical HTTPS page URL for the supported JW surfaces.
 * Fragments are presentation state rather than page identity and are removed.
 */
export function normalizeStudyPageUrl(value: unknown): string | null {
  return normalizeSupportedUrl(value, false);
}

/** Alias kept intentionally small for callers that describe the value as a page URL. */
export const normalizePageUrl = normalizeStudyPageUrl;

/**
 * Return a canonical HTTPS target URL while retaining its precise fragment.
 * Targets are still restricted to the supported JW.org and WOL origins.
 */
export function normalizeStudyTargetUrl(value: unknown): string | null {
  return normalizeSupportedUrl(value, true);
}

export const normalizeTargetUrl = normalizeStudyTargetUrl;
export const normalizeBookmarkTargetUrl = normalizeStudyTargetUrl;

export function createEmptyStudyData(): StudyDataV2 {
  return {
    schemaVersion: STUDY_DATA_SCHEMA_VERSION,
    annotations: [],
    mediaProgress: [],
    bookmarks: [],
  };
}

export function createEmptyStudyDataV1(): LegacyStudyDataV1 {
  return {
    schemaVersion: STUDY_DATA_SCHEMA_V1,
    annotations: [],
    mediaProgress: [],
  };
}

export function normalizeTags(value: unknown): string[] | null {
  let source: string[];
  if (typeof value === 'string') {
    source = value.split(',');
  } else if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    source = value.flatMap((item) => item.split(','));
  } else {
    return null;
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of source) {
    if (!boundedString(raw, 0, MAX_TAG_LENGTH, { allowControls: false })) return null;
    const tag = raw.normalize('NFKC').replace(/[\s\u00a0]+/gu, ' ').trim().toLowerCase();
    if (!tag) continue;
    if (codePointLength(tag) > MAX_TAG_LENGTH || hasControlCharacters(tag)) return null;
    if (seen.has(tag)) continue;
    if (tags.length >= MAX_TAGS) return null;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

export function validateRootReference(value: unknown): RootReference | null {
  if (!isPlainRecord(value) || !hasOnlyAllowedKeys(value, ROOT_KEYS)) return null;
  const identifiers: RootReference = {};
  for (const key of ROOT_KEYS) {
    if (!hasOwn(value, key)) continue;
    const raw = value[key];
    if (raw === undefined || raw === null) return null;
    const identifier = normalizeIdentifier(raw);
    if (identifier === null) return null;
    identifiers[key] = identifier;
  }
  const present = ROOT_KEYS.filter((key) => identifiers[key] !== undefined);
  if (present.length !== 1) return null;
  return identifiers;
}

export function rootReferenceKey(value: RootReference): string {
  if (value.id) return `id:${value.id}`;
  if (value.dataPid) return `data-pid:${value.dataPid}`;
  if (value.dataVerse) return `data-verse:${value.dataVerse}`;
  return '';
}

export function normalizeRootReference(value: unknown): RootReference | null {
  return validateRootReference(value);
}

export function validateTextSelector(value: unknown): TextSelector | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, SELECTOR_KEYS)) return null;
  if (!boundedString(value.exact, 1, MAX_TEXT_LENGTH, { allowControls: true })) return null;
  if (!boundedString(value.prefix, 0, MAX_CONTEXT_LENGTH, { allowControls: true })) return null;
  if (!boundedString(value.suffix, 0, MAX_CONTEXT_LENGTH, { allowControls: true })) return null;
  if (!finiteSafeInteger(value.start, 0, Number.MAX_SAFE_INTEGER)) return null;
  if (!finiteSafeInteger(value.end, 1, Number.MAX_SAFE_INTEGER)) return null;
  if (value.end <= value.start || value.end - value.start !== value.exact.length) return null;
  return {
    exact: value.exact,
    prefix: value.prefix,
    suffix: value.suffix,
    start: value.start,
    end: value.end,
  };
}

function takeLastCodePoints(value: string, count: number): string {
  return Array.from(value).slice(-count).join('');
}

function takeFirstCodePoints(value: string, count: number): string {
  return Array.from(value).slice(0, count).join('');
}

/** Create a flat W3C-style quote + position selector from a clean text snapshot. */
export function createTextSelector(text: unknown, start: unknown, end: unknown): TextSelector | null {
  if (typeof text !== 'string') return null;
  if (!finiteSafeInteger(start, 0, Number.MAX_SAFE_INTEGER) || !finiteSafeInteger(end, 1, Number.MAX_SAFE_INTEGER)) return null;
  if (start >= end || end > text.length) return null;
  const exact = text.slice(start, end);
  if (!boundedString(exact, 1, MAX_TEXT_LENGTH, { allowControls: true })) return null;
  const selector: TextSelector = {
    exact,
    prefix: takeLastCodePoints(text.slice(0, start), MAX_CONTEXT_LENGTH),
    suffix: takeFirstCodePoints(text.slice(end), MAX_CONTEXT_LENGTH),
    start,
    end,
  };
  return validateTextSelector(selector);
}

export const createTextQuoteSelector = createTextSelector;

function findExactMatches(text: string, selector: TextQuoteSelector): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];
  let offset = 0;
  while (offset <= text.length - selector.exact.length) {
    const start = text.indexOf(selector.exact, offset);
    if (start < 0) break;
    const end = start + selector.exact.length;
    const prefix = text.slice(Math.max(0, start - selector.prefix.length), start);
    const suffix = text.slice(end, end + selector.suffix.length);
    if (prefix === selector.prefix && suffix === selector.suffix) matches.push({ start, end });
    offset = start + 1;
  }
  return matches;
}

function rootForSnapshot(value: unknown): RootTextSnapshot | null {
  if (!isPlainRecord(value)) return null;
  const root = validateRootReference(value.root);
  if (!root || typeof value.text !== 'string') return null;
  return { root, text: value.text };
}

/**
 * Resolve only exact positions/quotes. More than one eligible match is an
 * ambiguity and returns null; no fuzzy or edit-distance attachment is used.
 */
export function resolveTextSelector(
  selectorValue: unknown,
  savedRootValue: unknown,
  savedText: unknown,
  eligibleRoots: readonly RootTextSnapshot[],
): TextResolution | null {
  if (!Array.isArray(eligibleRoots)) return null;
  const selector = validateTextSelector(selectorValue);
  const savedRoot = validateRootReference(savedRootValue);
  if (!selector || !savedRoot) return null;

  if (typeof savedText === 'string' && selector.end <= savedText.length && savedText.slice(selector.start, selector.end) === selector.exact) {
    return {
      root: savedRoot,
      start: selector.start,
      end: selector.end,
      exact: selector.exact,
      method: 'position',
      recovered: false,
    };
  }

  if (typeof savedText === 'string') {
    const savedMatches = findExactMatches(savedText, selector);
    if (savedMatches.length === 1) {
      return {
        root: savedRoot,
        ...savedMatches[0],
        exact: selector.exact,
        method: 'saved-root-quote',
        recovered: true,
      };
    }
    if (savedMatches.length > 1) return null;
  }

  const savedKey = rootReferenceKey(savedRoot);
  const matches: Array<TextResolution & { key: string }> = [];
  const seenSnapshots = new Set<string>();
  for (const candidateValue of eligibleRoots) {
    const candidate = rootForSnapshot(candidateValue);
    if (!candidate) continue;
    const key = rootReferenceKey(candidate.root);
    if (!key || seenSnapshots.has(key)) continue;
    seenSnapshots.add(key);
    if (key === savedKey) continue;
    for (const match of findExactMatches(candidate.text, selector)) {
      matches.push({
        root: candidate.root,
        ...match,
        exact: selector.exact,
        method: 'other-root-quote',
        recovered: true,
        key,
      });
    }
  }
  if (matches.length !== 1) return null;
  const { key: _key, ...resolution } = matches[0];
  return resolution;
}

export function validateAnnotation(value: unknown): AnnotationRecord | null {
  if (!isPlainRecord(value) || !hasOnlyAllowedKeys(value, ANNOTATION_KEYS) || !hasRequiredKeys(value, ANNOTATION_REQUIRED_KEYS)) return null;
  const id = normalizeIdentifier(value.id);
  const pageUrl = normalizeStudyPageUrl(value.pageUrl);
  const title = boundedString(value.title, 0, MAX_TITLE_LENGTH)
    ? normalizeWhitespace(value.title)
    : null;
  const root = validateRootReference(value.root);
  const selector = validateTextSelector(value.selector);
  const color = typeof value.color === 'string' && (HIGHLIGHT_COLORS as readonly string[]).includes(value.color)
    ? value.color as HighlightColor
    : null;
  const noteValue = hasOwn(value, 'note') ? value.note : '';
  const tagsValue = hasOwn(value, 'tags') ? value.tags : [];
  const note = boundedString(noteValue, 0, MAX_NOTE_LENGTH, { allowControls: true }) ? noteValue : null;
  const tags = normalizeTags(tagsValue);
  if (
    id === null ||
    pageUrl === null ||
    title === null ||
    root === null ||
    selector === null ||
    color === null ||
    note === null ||
    tags === null ||
    !finiteSafeInteger(value.createdAt) ||
    !finiteSafeInteger(value.updatedAt) ||
    value.updatedAt < value.createdAt
  ) return null;
  return {
    id,
    pageUrl,
    title,
    root,
    selector,
    color,
    note,
    tags,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function mediaProgressKey(pageUrl: string, mediaSource: string): string {
  return `${pageUrl}\u0000${mediaSource}`;
}

export function createMediaProgressId(pageUrl: string, mediaSource: string): string | null {
  const normalizedPageUrl = normalizeStudyPageUrl(pageUrl);
  if (normalizedPageUrl === null || !boundedString(mediaSource, 1, MAX_MEDIA_SOURCE_LENGTH)) return null;
  const normalizedSource = mediaSource.trim();
  if (!normalizedSource || hasControlCharacters(normalizedSource)) return null;
  return mediaProgressKey(normalizedPageUrl, normalizedSource);
}

export const mediaProgressKeyFor = createMediaProgressId;

export function createMediaProgressRecord(
  pageUrl: string,
  mediaSource: string,
  title: string,
  currentTime: number,
  duration: number,
  updatedAt: number,
): MediaProgressRecord | null {
  const normalizedPageUrl = normalizeStudyPageUrl(pageUrl);
  const normalizedSource = typeof mediaSource === 'string' ? mediaSource.trim() : '';
  const id = normalizedPageUrl === null ? null : createMediaProgressId(normalizedPageUrl, normalizedSource);
  if (id === null) return null;
  return validateMediaProgress({
    id,
    pageUrl: normalizedPageUrl,
    mediaSource: normalizedSource,
    title,
    currentTime,
    duration,
    updatedAt,
  });
}

export function validateMediaProgress(value: unknown): MediaProgressRecord | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, MEDIA_PROGRESS_KEYS)) return null;
  const pageUrl = normalizeStudyPageUrl(value.pageUrl);
  const mediaSource = boundedString(value.mediaSource, 1, MAX_MEDIA_SOURCE_LENGTH)
    ? value.mediaSource.trim()
    : null;
  const title = boundedString(value.title, 0, MAX_TITLE_LENGTH)
    ? normalizeWhitespace(value.title)
    : null;
  if (
    pageUrl === null ||
    mediaSource === null ||
    !mediaSource ||
    hasControlCharacters(mediaSource) ||
    title === null ||
    !finiteNumber(value.currentTime, 5) ||
    !finiteNumber(value.duration, Number.MIN_VALUE) ||
    value.currentTime > value.duration - 5 ||
    !finiteSafeInteger(value.updatedAt)
  ) return null;

  const id = createMediaProgressId(pageUrl, mediaSource);
  if (id === null || value.id !== id) return null;
  return {
    id,
    pageUrl,
    mediaSource,
    title,
    currentTime: value.currentTime,
    duration: value.duration,
    updatedAt: value.updatedAt,
  };
}

function normalizeBookmarkId(value: unknown): string | null {
  return normalizeIdentifier(value, MAX_IDENTIFIER_LENGTH);
}

/** Validate and normalize one local saved place/bookmark record. */
export function validateBookmarkRecord(value: unknown): BookmarkRecord | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, BOOKMARK_KEYS)) return null;
  const id = normalizeBookmarkId(value.id);
  const pageUrl = normalizeStudyPageUrl(value.pageUrl);
  const targetUrl = normalizeStudyTargetUrl(value.targetUrl);
  const targetPageUrl = targetUrl === null ? null : normalizeStudyPageUrl(targetUrl);
  const title = boundedString(value.title, 0, MAX_TITLE_LENGTH)
    ? normalizeWhitespace(value.title)
    : null;
  const reference = boundedString(value.reference, 0, MAX_REFERENCE_LENGTH)
    ? normalizeWhitespace(value.reference)
    : null;
  if (
    id === null ||
    pageUrl === null ||
    targetUrl === null ||
    targetPageUrl === null ||
    targetPageUrl !== pageUrl ||
    title === null ||
    reference === null ||
    !finiteSafeInteger(value.createdAt) ||
    !finiteSafeInteger(value.updatedAt) ||
    value.updatedAt < value.createdAt
  ) return null;
  return {
    id,
    pageUrl,
    targetUrl,
    title,
    reference,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export const validateBookmark = validateBookmarkRecord;
export const validateSavedPlace = validateBookmarkRecord;
export const validateSavedPlaceRecord = validateBookmarkRecord;
export const normalizeBookmarkRecord = validateBookmarkRecord;
export const normalizeSavedPlaceRecord = validateBookmarkRecord;

/** Create a deterministic ID for callers that do not already have one. */
export function createBookmarkId(targetUrl: unknown): string | null {
  const target = normalizeStudyTargetUrl(targetUrl);
  if (target === null) return null;
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < target.length; index += 1) {
    const code = target.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ (code + index), 0x01000193);
  }
  const firstHex = (first >>> 0).toString(16).padStart(8, '0');
  const secondHex = (second >>> 0).toString(16).padStart(8, '0');
  return `bookmark:${firstHex}${secondHex}`;
}

/**
 * Create a bookmark from either a record-shaped object or positional values.
 * The object form is preferred; positional support keeps the primitive useful
 * to small callers without introducing a separate builder API.
 */
export function createBookmarkRecord(...args: unknown[]): BookmarkRecord | null {
  if (args.length === 1) return validateBookmarkRecord(args[0]);
  if (args.length < 6) return null;

  const first = args[0];
  const second = args[1];
  const firstLooksLikeUrl = typeof first === 'string' && /^https?:\/\//iu.test(first.trim());
  const secondLooksLikeUrl = typeof second === 'string' && /^https?:\/\//iu.test(second.trim());
  if (firstLooksLikeUrl && secondLooksLikeUrl) {
    const [pageUrl, targetUrl, title, reference, createdAt, updatedAt, suppliedId] = args;
    return validateBookmarkRecord({
      id: suppliedId === undefined ? createBookmarkId(targetUrl) : suppliedId,
      pageUrl,
      targetUrl,
      title,
      reference,
      createdAt,
      updatedAt,
    });
  }

  const [id, pageUrl, targetUrl, title, reference, createdAt, updatedAt = createdAt] = args;
  return validateBookmarkRecord({ id, pageUrl, targetUrl, title, reference, createdAt, updatedAt });
}

export const createSavedPlaceRecord = createBookmarkRecord;
export const createSavedPlace = createBookmarkRecord;

function sortAnnotations(records: readonly AnnotationRecord[]): AnnotationRecord[] {
  return [...records].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) return right.updatedAt - left.updatedAt;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

function sortMediaProgress(records: readonly MediaProgressRecord[]): MediaProgressRecord[] {
  return [...records].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) return right.updatedAt - left.updatedAt;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

export function pruneMediaProgress(
  values: readonly unknown[],
  now?: number,
): MediaProgressRecord[] {
  if (now !== undefined && !finiteSafeInteger(now)) return [];
  const byId = new Map<string, MediaProgressRecord>();
  for (const value of values) {
    const record = validateMediaProgress(value);
    if (!record || (now !== undefined && (now - record.updatedAt > MEDIA_PROGRESS_MAX_AGE_MS || record.updatedAt > now))) continue;
    const existing = byId.get(record.id);
    if (!existing || record.updatedAt > existing.updatedAt) byId.set(record.id, record);
  }
  return sortMediaProgress([...byId.values()]).slice(0, MAX_MEDIA_PROGRESS);
}

export function upsertMediaProgress(
  current: readonly unknown[],
  incoming: unknown,
  now?: number,
): MediaProgressRecord[] {
  const records = pruneMediaProgress(current, now);
  const candidate = validateMediaProgress(incoming);
  if (
    !candidate ||
    (now !== undefined && (!finiteSafeInteger(now) || candidate.updatedAt > now || now - candidate.updatedAt > MEDIA_PROGRESS_MAX_AGE_MS))
  ) return records;
  const existing = records.find((record) => record.id === candidate.id);
  if (existing && existing.updatedAt >= candidate.updatedAt) return records;
  const next = records.filter((record) => record.id !== candidate.id);
  next.push(candidate);
  return sortMediaProgress(next).slice(0, MAX_MEDIA_PROGRESS);
}

function validateEnvelopeShape(value: unknown): EnvelopeShape | null {
  if (!isPlainRecord(value)) return null;
  if (
    value.schemaVersion === STUDY_DATA_SCHEMA_V1 &&
    hasExactKeys(value, V1_ENVELOPE_KEYS) &&
    Array.isArray(value.annotations) &&
    Array.isArray(value.mediaProgress)
  ) {
    return {
      schemaVersion: STUDY_DATA_SCHEMA_V1,
      annotations: value.annotations,
      mediaProgress: value.mediaProgress,
    };
  }
  if (
    value.schemaVersion === STUDY_DATA_SCHEMA_VERSION &&
    hasExactKeys(value, V2_ENVELOPE_KEYS) &&
    Array.isArray(value.annotations) &&
    Array.isArray(value.mediaProgress) &&
    Array.isArray(value.bookmarks)
  ) {
    return {
      schemaVersion: STUDY_DATA_SCHEMA_VERSION,
      annotations: value.annotations,
      mediaProgress: value.mediaProgress,
      bookmarks: value.bookmarks,
    };
  }
  return null;
}

function validateAnnotationArray(values: readonly unknown[]): AnnotationRecord[] | null {
  if (values.length > MAX_ANNOTATIONS) return null;
  const annotations: AnnotationRecord[] = [];
  const annotationIds = new Set<string>();
  for (const item of values) {
    const record = validateAnnotation(item);
    if (!record || annotationIds.has(record.id)) return null;
    annotationIds.add(record.id);
    annotations.push(record);
  }
  return sortAnnotations(annotations);
}

function validateMediaProgressArray(values: readonly unknown[]): MediaProgressRecord[] | null {
  if (values.length > MAX_MEDIA_PROGRESS) return null;
  const mediaProgress: MediaProgressRecord[] = [];
  const mediaIds = new Set<string>();
  for (const item of values) {
    const record = validateMediaProgress(item);
    if (!record || mediaIds.has(record.id)) return null;
    mediaIds.add(record.id);
    mediaProgress.push(record);
  }
  return sortMediaProgress(mediaProgress);
}

function sortBookmarks(records: readonly BookmarkRecord[]): BookmarkRecord[] {
  return [...records].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) return right.updatedAt - left.updatedAt;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

function validateBookmarkArray(values: readonly unknown[]): BookmarkRecord[] | null {
  if (values.length > MAX_BOOKMARKS) return null;
  const bookmarks: BookmarkRecord[] = [];
  const bookmarkIds = new Set<string>();
  const targetUrls = new Set<string>();
  for (const item of values) {
    const record = validateBookmarkRecord(item);
    if (!record || bookmarkIds.has(record.id) || targetUrls.has(record.targetUrl)) return null;
    bookmarkIds.add(record.id);
    targetUrls.add(record.targetUrl);
    bookmarks.push(record);
  }
  return sortBookmarks(bookmarks);
}

/** Strict schema-1 validator used only for legacy reads and imports. */
export function validateStudyDataV1(value: unknown): LegacyStudyDataV1 | null {
  const envelope = validateEnvelopeShape(value);
  if (!envelope || envelope.schemaVersion !== STUDY_DATA_SCHEMA_V1) return null;
  const annotations = validateAnnotationArray(envelope.annotations);
  const mediaProgress = validateMediaProgressArray(envelope.mediaProgress);
  if (!annotations || !mediaProgress) return null;
  return { schemaVersion: STUDY_DATA_SCHEMA_V1, annotations, mediaProgress };
}

export const validateLegacyStudyData = validateStudyDataV1;

/** Strict full-envelope validator used for trusted schema-v2 storage reads. */
export function validateStudyData(value: unknown): StudyDataV2 | null {
  const envelope = validateEnvelopeShape(value);
  if (!envelope || envelope.schemaVersion !== STUDY_DATA_SCHEMA_VERSION) return null;
  const annotations = validateAnnotationArray(envelope.annotations);
  const mediaProgress = validateMediaProgressArray(envelope.mediaProgress);
  const bookmarks = validateBookmarkArray(envelope.bookmarks);
  if (!annotations || !mediaProgress || !bookmarks) return null;
  return {
    schemaVersion: STUDY_DATA_SCHEMA_VERSION,
    annotations,
    mediaProgress,
    bookmarks,
  };
}

/** Convert a strict legacy envelope without mutating or deleting the source. */
export function migrateStudyDataV1(value: unknown): StudyDataV2 | null {
  const legacy = validateStudyDataV1(value);
  if (!legacy) return null;
  return {
    schemaVersion: STUDY_DATA_SCHEMA_VERSION,
    annotations: legacy.annotations,
    mediaProgress: legacy.mediaProgress,
    bookmarks: [],
  };
}

export const migrateLegacyStudyData = migrateStudyDataV1;
export const migrateStudyData = migrateStudyDataV1;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function parseStudyDataBackup(value: unknown): BackupParseResult {
  if (typeof value !== 'string') return { data: null, error: 'invalid-input' };
  if (utf8ByteLength(value) > MAX_BACKUP_JSON_BYTES) return { data: null, error: 'too-large' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return { data: null, error: 'invalid-json' };
  }
  const data = validateEnvelopeShape(parsed);
  return data ? { data, error: null } : { data: null, error: 'invalid-envelope' };
}

export function parseStudyDataJson(value: unknown): LegacyStudyDataV1 | StudyDataV2 | null {
  const parsed = parseStudyDataBackup(value);
  if (!parsed.data) return null;
  return parsed.data.schemaVersion === STUDY_DATA_SCHEMA_V1
    ? validateStudyDataV1(parsed.data)
    : validateStudyData(parsed.data);
}

export const parseStudyData = parseStudyDataJson;

type IncomingRecords = {
  annotations: Array<AnnotationRecord | null>;
  mediaProgress: Array<MediaProgressRecord | null>;
  bookmarks: Array<BookmarkRecord | null>;
  envelopeValid: boolean;
};

function readIncomingRecords(value: unknown): IncomingRecords {
  const envelope = validateEnvelopeShape(value);
  if (!envelope) return { annotations: [], mediaProgress: [], bookmarks: [], envelopeValid: false };
  return {
    annotations: envelope.annotations.map((item) => validateAnnotation(item)),
    mediaProgress: envelope.mediaProgress.map((item) => validateMediaProgress(item)),
    bookmarks: envelope.schemaVersion === STUDY_DATA_SCHEMA_VERSION
      ? envelope.bookmarks.map((item) => validateBookmarkRecord(item))
      : [],
    envelopeValid: true,
  };
}

export function normalizeBookmarkRecords(values: readonly unknown[]): BookmarkRecord[] {
  const byId = new Map<string, BookmarkRecord>();
  const byTarget = new Map<string, BookmarkRecord>();
  const remove = (record: BookmarkRecord) => {
    byId.delete(record.id);
    if (byTarget.get(record.targetUrl)?.id === record.id) byTarget.delete(record.targetUrl);
  };
  for (const value of values) {
    const candidate = validateBookmarkRecord(value);
    if (!candidate) continue;
    const existingById = byId.get(candidate.id);
    const existingByTarget = byTarget.get(candidate.targetUrl);
    const existing = existingById || existingByTarget;
    if (existing) {
      const newestExistingAt = Math.max(existingById?.updatedAt || 0, existingByTarget?.updatedAt || 0);
      if (candidate.updatedAt <= newestExistingAt) continue;
      if (existingById) remove(existingById);
      if (existingByTarget && existingByTarget.id !== existingById?.id) remove(existingByTarget);
    }
    byId.set(candidate.id, candidate);
    byTarget.set(candidate.targetUrl, candidate);
  }
  return sortBookmarks([...byId.values()]).slice(0, MAX_BOOKMARKS);
}

export const dedupeBookmarkRecords = normalizeBookmarkRecords;
export const dedupeBookmarks = normalizeBookmarkRecords;
export const dedupeSavedPlaces = normalizeBookmarkRecords;

function normalizedCurrentData(value: unknown, now?: number): StudyDataV2 {
  const envelope = validateEnvelopeShape(value);
  if (!envelope) return createEmptyStudyData();
  const annotations: AnnotationRecord[] = [];
  const annotationIds = new Set<string>();
  for (const item of envelope.annotations) {
    const record = validateAnnotation(item);
    if (!record || annotationIds.has(record.id)) continue;
    annotationIds.add(record.id);
    annotations.push(record);
    if (annotations.length >= MAX_ANNOTATIONS) break;
  }
  const mediaProgress = pruneMediaProgress(envelope.mediaProgress, now);
  const bookmarkValues = envelope.schemaVersion === STUDY_DATA_SCHEMA_VERSION ? envelope.bookmarks : [];
  return {
    schemaVersion: STUDY_DATA_SCHEMA_VERSION,
    annotations: sortAnnotations(annotations),
    mediaProgress,
    bookmarks: normalizeBookmarkRecords(bookmarkValues),
  };
}

function mergeAnnotationRecords(current: AnnotationRecord[], incoming: Array<AnnotationRecord | null>, stats: ImportStats): AnnotationRecord[] {
  const byId = new Map(current.map((record) => [record.id, record]));
  for (const candidate of incoming) {
    if (candidate === null) {
      stats.rejected += 1;
      continue;
    }
    const existing = byId.get(candidate.id);
    if (existing) {
      if (candidate.updatedAt > existing.updatedAt) {
        byId.set(candidate.id, candidate);
        stats.updated += 1;
      } else {
        stats.ignored += 1;
      }
      continue;
    }
    if (byId.size >= MAX_ANNOTATIONS) {
      stats.ignored += 1;
      continue;
    }
    byId.set(candidate.id, candidate);
    stats.accepted += 1;
  }
  return sortAnnotations([...byId.values()]);
}

function mergeMediaRecords(
  current: MediaProgressRecord[],
  incoming: Array<MediaProgressRecord | null>,
  stats: ImportStats,
  now?: number,
): MediaProgressRecord[] {
  const byId = new Map(current.map((record) => [record.id, record]));
  for (const candidate of incoming) {
    if (candidate === null) {
      stats.rejected += 1;
      continue;
    }
    if (now !== undefined && (candidate.updatedAt > now || now - candidate.updatedAt > MEDIA_PROGRESS_MAX_AGE_MS)) {
      stats.ignored += 1;
      continue;
    }
    const existing = byId.get(candidate.id);
    if (existing && existing.updatedAt >= candidate.updatedAt) {
      stats.ignored += 1;
      continue;
    }
    if (existing) stats.updated += 1;
    else stats.accepted += 1;
    byId.set(candidate.id, candidate);
  }
  const sorted = sortMediaProgress([...byId.values()]);
  const retained = sorted.slice(0, MAX_MEDIA_PROGRESS);
  stats.ignored += Math.max(0, sorted.length - retained.length);
  return retained;
}

function mergeBookmarkRecords(
  current: BookmarkRecord[],
  incoming: Array<BookmarkRecord | null>,
  stats: ImportStats,
): BookmarkRecord[] {
  const byId = new Map(current.map((record) => [record.id, record]));
  const byTarget = new Map(current.map((record) => [record.targetUrl, record]));

  const remove = (record: BookmarkRecord) => {
    byId.delete(record.id);
    if (byTarget.get(record.targetUrl)?.id === record.id) byTarget.delete(record.targetUrl);
  };

  for (const candidate of incoming) {
    if (candidate === null) {
      stats.rejected += 1;
      continue;
    }
    const existingById = byId.get(candidate.id);
    const existingByTarget = byTarget.get(candidate.targetUrl);
    const existing = existingById || existingByTarget;
    if (existing) {
      const newestExistingAt = Math.max(existingById?.updatedAt || 0, existingByTarget?.updatedAt || 0);
      if (candidate.updatedAt <= newestExistingAt) {
        stats.ignored += 1;
        continue;
      }
      if (existingById) remove(existingById);
      if (existingByTarget && existingByTarget.id !== existingById?.id) remove(existingByTarget);
      byId.set(candidate.id, candidate);
      byTarget.set(candidate.targetUrl, candidate);
      stats.updated += 1;
      continue;
    }
    if (byId.size >= MAX_BOOKMARKS) {
      stats.ignored += 1;
      continue;
    }
    byId.set(candidate.id, candidate);
    byTarget.set(candidate.targetUrl, candidate);
    stats.accepted += 1;
  }
  return sortBookmarks([...byId.values()]).slice(0, MAX_BOOKMARKS);
}

/**
 * Merge a versioned backup without deleting unrelated valid current records.
 * Equal timestamps keep the current record; output is newest-first with ID tie
 * breaks, making repeated merges stable.
 */
export function mergeStudyData(currentValue: unknown, incomingValue: unknown, now?: number): ImportResult {
  const current = normalizedCurrentData(currentValue, now);
  const stats: ImportStats = { ...EMPTY_IMPORT_STATS };
  const incoming = readIncomingRecords(incomingValue);
  if (!incoming.envelopeValid) {
    stats.rejected = 1;
    return { data: current, stats };
  }
  const annotations = mergeAnnotationRecords(current.annotations, incoming.annotations, stats);
  const mediaProgress = mergeMediaRecords(current.mediaProgress, incoming.mediaProgress, stats, now);
  const bookmarks = mergeBookmarkRecords(current.bookmarks, incoming.bookmarks, stats);
  return {
    data: {
      schemaVersion: STUDY_DATA_SCHEMA_VERSION,
      annotations,
      mediaProgress,
      bookmarks,
    },
    stats,
  };
}

export function serializeStudyData(value: unknown): string | null {
  const data = validateStudyData(value) || migrateStudyDataV1(value);
  if (!data) return null;
  const json = JSON.stringify(data);
  return utf8ByteLength(json) <= MAX_BACKUP_JSON_BYTES ? json : null;
}
