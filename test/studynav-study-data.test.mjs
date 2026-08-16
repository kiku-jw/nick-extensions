import { describe, expect, test } from 'bun:test';

import {
  HIGHLIGHT_COLORS,
  MAX_ANNOTATIONS,
  MAX_BACKUP_JSON_BYTES,
  MAX_BOOKMARKS,
  MAX_CONTEXT_LENGTH,
  MAX_MEDIA_PROGRESS,
  MAX_NOTE_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TEXT_LENGTH,
  MEDIA_PROGRESS_MAX_AGE_MS,
  STUDY_DATA_LEGACY_STORAGE_KEY,
  STUDY_DATA_SCHEMA_VERSION,
  STUDY_DATA_STORAGE_KEY,
  createBookmarkId,
  createBookmarkRecord,
  createEmptyStudyData,
  createMediaProgressId,
  createMediaProgressRecord,
  createTextSelector,
  mergeStudyData,
  migrateStudyDataV1,
  normalizeRootReference,
  normalizeStudyPageUrl,
  normalizeStudyTargetUrl,
  normalizeTags,
  parseStudyDataBackup,
  parseStudyDataJson,
  pruneMediaProgress,
  resolveTextSelector,
  serializeStudyData,
  upsertMediaProgress,
  validateAnnotation,
  validateBookmarkRecord,
  validateMediaProgress,
  validateStudyData,
  validateTextSelector,
} from '../packages/studynav/src/study-data.ts';

const NOW = 1_700_000_000_000;
const PAGE_URL = 'https://www.jw.org/en/library/books/sample/?b=2';
const PAGE_BASE = 'https://www.jw.org/en/library/books/sample/';
const TARGET_URL = `${PAGE_URL}#p1`;
const MEDIA_SOURCE = 'https://b.jw-cdn.org/media/sample.mp4';

function annotation(overrides = {}) {
  const text = 'A clean paragraph for local study.';
  const selector = createTextSelector(text, 2, 7);
  return {
    id: 'annotation-1',
    pageUrl: PAGE_URL,
    title: 'Sample title',
    root: { id: 'p1' },
    selector,
    color: 'yellow',
    note: '',
    tags: [],
    createdAt: NOW - 10_000,
    updatedAt: NOW - 1_000,
    ...overrides,
  };
}

function media(overrides = {}) {
  const pageUrl = PAGE_URL;
  const mediaSource = MEDIA_SOURCE;
  return {
    id: createMediaProgressId(pageUrl, mediaSource),
    pageUrl,
    mediaSource,
    title: 'Sample video',
    currentTime: 20,
    duration: 60,
    updatedAt: NOW - 1_000,
    ...overrides,
  };
}

function bookmark(overrides = {}) {
  return {
    id: 'bookmark-1',
    pageUrl: PAGE_URL,
    targetUrl: TARGET_URL,
    title: 'Sample place',
    reference: 'Paragraph 1',
    createdAt: NOW - 10_000,
    updatedAt: NOW - 1_000,
    ...overrides,
  };
}

function envelope(annotations = [], mediaProgress = [], bookmarks = []) {
  return { schemaVersion: STUDY_DATA_SCHEMA_VERSION, annotations, mediaProgress, bookmarks };
}

function legacyEnvelope(annotations = [], mediaProgress = []) {
  return { schemaVersion: 1, annotations, mediaProgress };
}

describe('StudyNav study data constants and empty envelope', () => {
  test('exports the stable storage key, schema version, and four semantic colors', () => {
    expect(STUDY_DATA_STORAGE_KEY).toBe('studynavStudyDataV2');
    expect(STUDY_DATA_LEGACY_STORAGE_KEY).toBe('studynavStudyDataV1');
    expect(STUDY_DATA_SCHEMA_VERSION).toBe(2);
    expect(HIGHLIGHT_COLORS).toEqual(['yellow', 'green', 'blue', 'pink']);
    expect(createEmptyStudyData()).toEqual(envelope());
  });
});

describe('StudyNav supported page normalization', () => {
  test('normalizes supported HTTPS JW, WOL, and stream pages deterministically', () => {
    expect(normalizeStudyPageUrl('https://WWW.JW.ORG/en/page/?z=2&a=1#p1')).toBe('https://www.jw.org/en/page/?a=1&z=2');
    expect(normalizeStudyPageUrl('https://wol.jw.org/ru/wol/d/r2/lp-u/123')).toBe('https://wol.jw.org/ru/wol/d/r2/lp-u/123');
    expect(normalizeStudyPageUrl('https://stream.jw.org/media/item')).toBe('https://stream.jw.org/media/item');
  });

  test('rejects non-HTTPS, credentials, malformed, and unrelated hosts', () => {
    expect(normalizeStudyPageUrl('http://www.jw.org/en/page/')).toBeNull();
    expect(normalizeStudyPageUrl('https://user:pass@www.jw.org/en/page/')).toBeNull();
    expect(normalizeStudyPageUrl('https://www.jw.org.evil.example/en/page/')).toBeNull();
    expect(normalizeStudyPageUrl('not a URL')).toBeNull();
    expect(normalizeStudyPageUrl(`https://www.jw.org/${'a'.repeat(2_050)}`)).toBeNull();
  });
});

describe('StudyNav schema-v2 saved places', () => {
  test('normalizes valid bookmark URLs and rejects unsafe target records', () => {
    expect(normalizeStudyTargetUrl('https://WWW.JW.ORG/en/page/?z=2&a=1#p1')).toBe('https://www.jw.org/en/page/?a=1&z=2#p1');
    const normalized = validateBookmarkRecord(bookmark({
      pageUrl: ' https://WWW.JW.ORG/en/page/?z=2&a=1#ignored ',
      targetUrl: ' https://WWW.JW.ORG/en/page/?z=2&a=1#p1 ',
      title: '  Sample   place  ',
      reference: '  Paragraph   1  ',
    }));
    expect(normalized).toMatchObject({
      pageUrl: 'https://www.jw.org/en/page/?a=1&z=2',
      targetUrl: 'https://www.jw.org/en/page/?a=1&z=2#p1',
      title: 'Sample place',
      reference: 'Paragraph 1',
    });
    expect(validateBookmarkRecord({ ...bookmark(), extra: true })).toBeNull();
    expect(validateBookmarkRecord({ ...bookmark(), targetUrl: 'https://example.com/page#p1' })).toBeNull();
    expect(validateBookmarkRecord({ ...bookmark(), targetUrl: 'https://user:pass@www.jw.org/page#p1' })).toBeNull();
    expect(validateBookmarkRecord({ ...bookmark(), title: 'bad\u0000title' })).toBeNull();
    expect(validateBookmarkRecord({ ...bookmark(), reference: 'bad\u001ftarget' })).toBeNull();
    expect(validateBookmarkRecord({ ...bookmark(), createdAt: -1 })).toBeNull();
    expect(validateBookmarkRecord({ ...bookmark(), updatedAt: NOW - 20_000 })).toBeNull();
    expect(validateBookmarkRecord({ ...bookmark(), updatedAt: Number.NaN })).toBeNull();
    expect(validateBookmarkRecord({ ...bookmark(), targetUrl: `${PAGE_URL}#paragraph-2` })).not.toBeNull();
    expect(validateBookmarkRecord({ ...bookmark(), targetUrl: `${PAGE_BASE}/different-page#p1` })).toBeNull();
  });

  test('supports object and positional bookmark construction', () => {
    expect(createBookmarkRecord(bookmark())).toEqual(validateBookmarkRecord(bookmark()));
    expect(createBookmarkRecord(PAGE_URL, TARGET_URL, 'Sample place', 'Paragraph 1', NOW - 10_000, NOW - 1_000))
      .toMatchObject({ pageUrl: PAGE_URL, targetUrl: TARGET_URL, reference: 'Paragraph 1' });
    const longTarget = `${PAGE_BASE}#${'x'.repeat(2_004)}`;
    const longBookmark = createBookmarkRecord(PAGE_BASE, longTarget, 'Long place', 'Long reference', NOW, NOW);
    expect(longTarget.length).toBeLessThanOrEqual(2_048);
    expect(longBookmark).not.toBeNull();
    expect(longBookmark.id.length).toBeLessThanOrEqual(256);
    expect(validateBookmarkRecord(longBookmark)).not.toBeNull();
    expect(createBookmarkId(longTarget)).toBe(longBookmark.id);
  });

  test('strictly validates v2 bookmark limits and exact-target duplicates', () => {
    expect(validateStudyData(envelope([], [], [bookmark()]))?.bookmarks).toHaveLength(1);
    expect(validateStudyData(envelope([], [], [
      bookmark(),
      bookmark({ id: 'bookmark-2', targetUrl: `${PAGE_URL}#p1` }),
    ]))).toBeNull();
    const tooMany = Array.from({ length: MAX_BOOKMARKS + 1 }, (_, index) => bookmark({
      id: `bookmark-${index}`,
      targetUrl: `${PAGE_URL}#p${index}`,
      updatedAt: NOW - index,
    }));
    expect(validateStudyData(envelope([], [], tooMany))).toBeNull();
  });
});

describe('StudyNav schema-v2 migration, import, and export', () => {
  test('migrates valid v1 annotations and media without mutating the legacy envelope', () => {
    const legacy = legacyEnvelope([annotation()], [media()]);
    const before = structuredClone(legacy);
    const migrated = migrateStudyDataV1(legacy);
    expect(migrated).toMatchObject({ schemaVersion: 2, bookmarks: [] });
    expect(migrated.annotations).toEqual(legacy.annotations);
    expect(migrated.mediaProgress).toEqual(legacy.mediaProgress);
    expect(legacy).toEqual(before);
  });

  test('round-trips valid v2 and always exports schema-v2 JSON', () => {
    const data = validateStudyData(envelope([annotation()], [media()], [bookmark()]));
    const json = serializeStudyData(data);
    expect(json).not.toBeNull();
    expect(JSON.parse(json)).toEqual(data);
    const legacyJson = serializeStudyData(legacyEnvelope([annotation()], [media()]));
    expect(JSON.parse(legacyJson)).toMatchObject({ schemaVersion: 2, bookmarks: [] });
  });

  test('accepts v1 and v2 merge-only imports and never deletes local bookmarks', () => {
    const current = envelope([annotation({ id: 'keep' })], [], [bookmark({ id: 'local', targetUrl: `${PAGE_URL}#local` })]);
    const legacyResult = mergeStudyData(current, legacyEnvelope([annotation({ id: 'legacy' })]));
    expect(legacyResult.data.annotations.map((item) => item.id)).toEqual(['keep', 'legacy']);
    expect(legacyResult.data.bookmarks.map((item) => item.id)).toEqual(['local']);

    const v2Result = mergeStudyData(legacyResult.data, envelope([], [], [bookmark({ id: 'incoming', targetUrl: `${PAGE_URL}#incoming` })]));
    expect(v2Result.data.bookmarks.map((item) => item.id)).toEqual(['incoming', 'local']);
    expect(v2Result.data.annotations.map((item) => item.id)).toEqual(['keep', 'legacy']);
  });

  test('deduplicates exact normalized targets and keeps the newer record', () => {
    const current = envelope([], [], [bookmark({ id: 'old', updatedAt: NOW - 5_000 })]);
    const newer = bookmark({
      id: 'new',
      targetUrl: `${PAGE_URL}#p1`,
      updatedAt: NOW - 1_000,
    });
    const merged = mergeStudyData(current, envelope([], [], [newer]), NOW);
    expect(merged.data.bookmarks).toHaveLength(1);
    expect(merged.data.bookmarks[0]).toMatchObject({ id: 'new', updatedAt: NOW - 1_000 });
    expect(merged.stats.updated).toBe(1);
    const older = mergeStudyData(merged.data, envelope([], [], [bookmark({ id: 'older', updatedAt: NOW - 2_000 })]), NOW);
    expect(older.data.bookmarks).toHaveLength(1);
    expect(older.data.bookmarks[0].id).toBe('new');
    expect(older.stats.ignored).toBe(1);

    const crossConflict = mergeStudyData(envelope([], [], [
      bookmark({ id: 'target-old', targetUrl: `${PAGE_URL}#old`, updatedAt: NOW - 5_000 }),
      bookmark({ id: 'id-newer', targetUrl: `${PAGE_URL}#other`, updatedAt: NOW - 1_000 }),
    ]), envelope([], [], [
      bookmark({ id: 'id-newer', targetUrl: `${PAGE_URL}#old`, updatedAt: NOW - 2_000 }),
    ]), NOW);
    expect(crossConflict.data.bookmarks.map((item) => item.id).sort()).toEqual(['id-newer', 'target-old']);
    expect(crossConflict.stats.ignored).toBe(1);
  });

  test('enforces the 500-record merge cap while retaining current records', () => {
    const currentBookmarks = Array.from({ length: MAX_BOOKMARKS }, (_, index) => bookmark({
      id: `current-${index}`,
      targetUrl: `${PAGE_URL}#current-${index}`,
      updatedAt: NOW - index,
    }));
    const result = mergeStudyData(envelope([], [], currentBookmarks), envelope([], [], [bookmark({
      id: 'excess',
      targetUrl: `${PAGE_URL}#excess`,
      updatedAt: NOW + 1,
    })]), NOW);
    expect(result.data.bookmarks).toHaveLength(MAX_BOOKMARKS);
    expect(result.data.bookmarks.some((item) => item.id === 'excess')).toBe(false);
    expect(result.stats.ignored).toBe(1);
  });
});

describe('StudyNav tag normalization', () => {
  test('trims, normalizes case and whitespace, splits comma input, and deduplicates', () => {
    expect(normalizeTags('  Bible, Study  ,bIbLe,  local   notes ')).toEqual(['bible', 'study', 'local notes']);
    expect(normalizeTags(['One, two', ' ONE ', 'three'])).toEqual(['one', 'two', 'three']);
    expect(normalizeTags(' , , ')).toEqual([]);
  });

  test('enforces tag type, length, and unique-count boundaries', () => {
    expect(normalizeTags(42)).toBeNull();
    expect(normalizeTags(['x'.repeat(MAX_TAG_LENGTH)])).toEqual(['x'.repeat(MAX_TAG_LENGTH)]);
    expect(normalizeTags(['x'.repeat(MAX_TAG_LENGTH + 1)])).toBeNull();
    expect(normalizeTags(Array.from({ length: MAX_TAGS + 1 }, (_, index) => `tag-${index}`))).toBeNull();
  });
});

describe('StudyNav text selectors and exact recovery', () => {
  test('creates bounded prefix/suffix context and validates positions', () => {
    const text = `${'p'.repeat(50)}exact${'s'.repeat(50)}`;
    const selector = createTextSelector(text, 50, 55);
    expect(selector).toEqual({
      exact: 'exact',
      prefix: 'p'.repeat(MAX_CONTEXT_LENGTH),
      suffix: 's'.repeat(MAX_CONTEXT_LENGTH),
      start: 50,
      end: 55,
    });
    expect(createTextSelector(text, 55, 50)).toBeNull();
    expect(createTextSelector(text, 0, text.length + 1)).toBeNull();
    expect(createTextSelector(text, 0, 0)).toBeNull();
    expect(createTextSelector('x'.repeat(MAX_TEXT_LENGTH + 1), 0, MAX_TEXT_LENGTH + 1)).toBeNull();
  });

  test('rejects malformed selectors and unknown selector fields', () => {
    const selector = createTextSelector('abcdef', 1, 3);
    expect(validateTextSelector(selector)).toEqual(selector);
    expect(validateTextSelector({ ...selector, end: 4 })).toBeNull();
    expect(validateTextSelector({ ...selector, extra: true })).toBeNull();
    expect(validateTextSelector({ ...selector, start: Number.NaN })).toBeNull();
  });

  test('resolves saved position first, then one exact contextual match in the saved root', () => {
    const originalText = 'before exact after';
    const selector = createTextSelector(originalText, 7, 12);
    expect(resolveTextSelector(selector, { id: 'p1' }, originalText, [])).toMatchObject({
      start: 7,
      end: 12,
      method: 'position',
      recovered: false,
    });

    const movedText = 'insert before exact after';
    expect(resolveTextSelector(selector, { id: 'p1' }, movedText, [])).toMatchObject({
      start: 14,
      end: 19,
      method: 'saved-root-quote',
      recovered: true,
    });
  });

  test('rejects ambiguity and uses exactly one eligible other root without fuzzy matching', () => {
    const originalText = 'before exact after';
    const selector = createTextSelector(originalText, 7, 12);
    expect(resolveTextSelector(selector, { id: 'p1' }, 'exact exact', [])).toBeNull();

    expect(resolveTextSelector(selector, { id: 'missing' }, 'changed text', [
      { root: { dataPid: 'p2' }, text: 'before exact after' },
    ])).toMatchObject({
      root: { dataPid: 'p2' },
      start: 7,
      end: 12,
      method: 'other-root-quote',
    });

    expect(resolveTextSelector(selector, { id: 'missing' }, 'changed text', [
      { root: { dataPid: 'p2' }, text: 'before exact after' },
      { root: { dataPid: 'p3' }, text: 'before exact after' },
    ])).toBeNull();
    expect(resolveTextSelector(selector, { id: 'missing' }, 'changed completely', [
      { root: { dataPid: 'p2' }, text: 'before exac after' },
    ])).toBeNull();
  });
});

describe('StudyNav strict record and envelope validation', () => {
  test('normalizes a valid annotation and rejects unknown or malformed values', () => {
    const valid = validateAnnotation(annotation({ title: '  Sample   title  ', tags: 'Bible, bible, Notes' }));
    expect(valid).toMatchObject({ title: 'Sample title', tags: ['bible', 'notes'], root: { id: 'p1' } });
    const { note: _note, tags: _tags, ...withoutOptionalFields } = annotation();
    expect(validateAnnotation(withoutOptionalFields)).toMatchObject({ note: '', tags: [] });
    expect(validateAnnotation({ ...annotation(), extra: true })).toBeNull();
    expect(validateAnnotation({ ...annotation(), selector: { ...annotation().selector, exact: '' } })).toBeNull();
    expect(validateAnnotation({ ...annotation(), updatedAt: Number.POSITIVE_INFINITY })).toBeNull();
    expect(validateAnnotation({ ...annotation(), color: 'orange' })).toBeNull();
  });

  test('accepts a null-prototype envelope but rejects a custom-prototype record', () => {
    const nullPrototypeEnvelope = Object.assign(Object.create(null), envelope([annotation()]));
    expect(validateStudyData(nullPrototypeEnvelope)?.annotations).toHaveLength(1);
    const customPrototype = Object.assign(Object.create({ poisoned: true }), annotation());
    expect(validateAnnotation(customPrototype)).toBeNull();
    expect(normalizeRootReference({ id: 'p1', dataPid: 'also-present' })).toBeNull();
    expect(validateStudyData({ ...envelope([annotation()]), unexpected: 1 })).toBeNull();
  });

  test('rejects malformed note, tag, root, and count boundaries', () => {
    expect(validateAnnotation({ ...annotation(), note: 'n'.repeat(MAX_NOTE_LENGTH + 1) })).toBeNull();
    expect(validateAnnotation({ ...annotation(), tags: ['t'.repeat(MAX_TAG_LENGTH + 1)] })).toBeNull();
    expect(validateAnnotation({ ...annotation(), root: { id: 'p1', dataPid: null } })).toBeNull();
    const tooMany = Array.from({ length: MAX_ANNOTATIONS + 1 }, (_, index) => annotation({ id: `id-${index}` }));
    expect(validateStudyData(envelope(tooMany))).toBeNull();
  });
});

describe('StudyNav backup parsing and serialization', () => {
  test('round-trips only the versioned study envelope and reports parse failures', () => {
    const data = validateStudyData(envelope([annotation()], [media()]));
    const json = serializeStudyData(data);
    expect(json).toContain('schemaVersion');
    expect(json).not.toContain('settings');
    expect(parseStudyDataBackup(json)).toEqual({ data, error: null });
    expect(parseStudyDataBackup('{')).toEqual({ data: null, error: 'invalid-json' });
    expect(parseStudyDataBackup(JSON.stringify({ ...envelope(), extra: true }))).toEqual({ data: null, error: 'invalid-envelope' });
  });

  test('accepts the exact 5 MiB boundary for parsing and rejects one byte over', () => {
    const boundary = `${' '.repeat(MAX_BACKUP_JSON_BYTES - 2)}{}`;
    expect(new TextEncoder().encode(boundary).byteLength).toBe(MAX_BACKUP_JSON_BYTES);
    expect(parseStudyDataBackup(boundary).error).toBe('invalid-envelope');
    const oversized = 'x'.repeat(MAX_BACKUP_JSON_BYTES + 1);
    expect(parseStudyDataBackup(oversized)).toEqual({ data: null, error: 'too-large' });
  });

  test('retains mixed records for merge while strict JSON parsing still rejects the envelope', () => {
    const current = envelope([annotation({ id: 'keep' })]);
    const mixed = envelope([
      annotation({ id: 'new', updatedAt: NOW - 500 }),
      { ...annotation({ id: 'bad' }), unknown: true },
    ]);
    const parsed = parseStudyDataBackup(JSON.stringify(mixed));
    expect(parsed.error).toBeNull();
    expect(parsed.data.annotations).toHaveLength(2);
    expect(parseStudyDataJson(JSON.stringify(mixed))).toBeNull();

    const result = mergeStudyData(current, parsed.data, NOW);
    expect(result.stats).toEqual({ accepted: 1, updated: 0, ignored: 0, rejected: 1 });
    expect(result.data.annotations.map((item) => item.id)).toEqual(['new', 'keep']);
  });
});

describe('StudyNav deterministic merge and import statistics', () => {
  test('keeps unrelated current records, chooses newest IDs, and counts decisions', () => {
    const current = envelope([
      annotation({ id: 'keep', updatedAt: NOW - 5_000 }),
      annotation({ id: 'conflict', note: 'old', updatedAt: NOW - 5_000 }),
    ]);
    const incoming = envelope([
      annotation({ id: 'new', updatedAt: NOW - 2_000 }),
      annotation({ id: 'conflict', note: 'new', updatedAt: NOW - 1_000 }),
      annotation({ id: 'keep', updatedAt: NOW - 6_000 }),
      { ...annotation({ id: 'bad' }), unknown: true },
    ]);
    const result = mergeStudyData(current, incoming, NOW);
    expect(result.stats).toEqual({ accepted: 1, updated: 1, ignored: 1, rejected: 1 });
    expect(result.data.annotations.map((item) => item.id)).toEqual(['conflict', 'new', 'keep']);
    expect(result.data.annotations.find((item) => item.id === 'conflict').note).toBe('new');
    expect(result.data.annotations.find((item) => item.id === 'keep').updatedAt).toBe(NOW - 5_000);
  });

  test('rejects an invalid incoming envelope without deleting current valid data', () => {
    const current = envelope([annotation({ id: 'keep' })]);
    const result = mergeStudyData(current, { ...envelope(), unknown: true }, NOW);
    expect(result.stats).toEqual({ accepted: 0, updated: 0, ignored: 0, rejected: 1 });
    expect(result.data.annotations.map((item) => item.id)).toEqual(['keep']);
  });

  test('preserves the 5,000 current annotation cap and ignores excess incoming records', () => {
    const currentAnnotations = Array.from({ length: MAX_ANNOTATIONS }, (_, index) => annotation({
      id: `current-${index}`,
      updatedAt: NOW - index,
    }));
    const result = mergeStudyData(envelope(currentAnnotations), envelope([annotation({ id: 'excess', updatedAt: NOW + 1 })]), NOW);
    expect(result.data.annotations).toHaveLength(MAX_ANNOTATIONS);
    expect(result.data.annotations.some((item) => item.id === 'excess')).toBe(false);
    expect(result.stats.ignored).toBe(1);
    expect(result.data.annotations.some((item) => item.id === 'current-0')).toBe(true);
  });
});

describe('StudyNav media progress validation, pruning, and upsert', () => {
  test('enforces finite position and the five-second start/end boundaries', () => {
    expect(validateMediaProgress(media({ currentTime: 5, duration: 10 }))).not.toBeNull();
    expect(validateMediaProgress(media({ currentTime: 5, duration: 9.999 }))).toBeNull();
    expect(validateMediaProgress(media({ currentTime: 5.001, duration: 10 }))).toBeNull();
    expect(validateMediaProgress(media({ currentTime: 4.999, duration: 60 }))).toBeNull();
    expect(validateMediaProgress(media({ currentTime: 60, duration: 60 }))).toBeNull();
    expect(validateMediaProgress(media({ currentTime: Number.NaN }))).toBeNull();
  });

  test('prunes stale, future, invalid, duplicate, and over-cap records newest-first', () => {
    const valid = media();
    const stale = media({ id: valid.id + '-stale', updatedAt: NOW - MEDIA_PROGRESS_MAX_AGE_MS - 1 });
    const future = media({ id: valid.id + '-future', updatedAt: NOW + 1 });
    const duplicateOlder = media({ updatedAt: NOW - 2_000 });
    const many = Array.from({ length: MAX_MEDIA_PROGRESS - 1 }, (_, index) => {
      const source = `${MEDIA_SOURCE}?track=${index}`;
      return {
        id: createMediaProgressId(PAGE_URL, source),
        pageUrl: PAGE_URL,
        mediaSource: source,
        title: `Video ${index}`,
        currentTime: 20,
        duration: 60,
        updatedAt: NOW - index,
      };
    });
    const pruned = pruneMediaProgress([stale, future, valid, duplicateOlder, ...many], NOW);
    expect(pruned).toHaveLength(MAX_MEDIA_PROGRESS);
    expect(pruned[0].updatedAt).toBe(NOW);
    expect(pruned.some((item) => item.id === stale.id)).toBe(false);
    expect(pruned.some((item) => item.id === future.id)).toBe(false);
    expect(pruned.filter((item) => item.id === valid.id)).toHaveLength(1);
  });

  test('upserts only newer valid progress and retains unrelated records', () => {
    const current = [media({ updatedAt: NOW - 2_000 }), media({
      pageUrl: 'https://wol.jw.org/en/wol/d/r1/lp-e/123',
      mediaSource: 'https://b.jw-cdn.org/media/other.mp4',
      id: createMediaProgressId('https://wol.jw.org/en/wol/d/r1/lp-e/123', 'https://b.jw-cdn.org/media/other.mp4'),
    })];
    const older = upsertMediaProgress(current, media({ updatedAt: NOW - 3_000 }), NOW);
    expect(older.find((item) => item.id === media().id).updatedAt).toBe(NOW - 2_000);
    const newer = upsertMediaProgress(current, media({ currentTime: 30, updatedAt: NOW - 500 }), NOW);
    expect(newer.find((item) => item.id === media().id).currentTime).toBe(30);
    expect(newer).toHaveLength(2);
    expect(upsertMediaProgress(current, { ...media(), currentTime: 1 }, NOW)).toHaveLength(2);
    expect(createMediaProgressRecord(PAGE_URL, MEDIA_SOURCE, 'Sample video', 20, 60, NOW - 1_000)).toMatchObject({
      id: media().id,
      currentTime: 20,
    });
  });
});
