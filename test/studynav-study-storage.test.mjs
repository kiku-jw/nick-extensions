import { beforeEach, describe, expect, test } from 'bun:test';

import {
  STUDY_DATA_LEGACY_STORAGE_KEY,
  STUDY_DATA_STORAGE_KEY,
  createEmptyStudyData,
  createTextSelector,
} from '../packages/studynav/src/study-data.ts';
import {
  StudyDataStorageError,
  loadStudyData,
  mutateStudyData,
  studyDataChanged,
} from '../packages/studynav/src/study-storage.ts';

let stored;
let setCalls;
let setFailure;

function annotation(id, updatedAt) {
  return {
    id,
    pageUrl: 'https://www.jw.org/en/library/books/sample/',
    title: 'Sample',
    root: { id: 'p1' },
    selector: createTextSelector('abcdef', 0, 3),
    color: 'yellow',
    note: '',
    tags: [],
    createdAt: 1,
    updatedAt,
  };
}

beforeEach(() => {
  stored = {};
  setCalls = [];
  setFailure = null;
  globalThis.chrome = {
    storage: {
      local: {
        async get() {
          return structuredClone(stored);
        },
        async set(value) {
          setCalls.push(structuredClone(value));
          if (setFailure) throw setFailure;
          stored = { ...stored, ...structuredClone(value) };
        },
      },
    },
  };
});

describe('StudyNav local study storage adapter', () => {
  test('returns an empty versioned envelope only when the key is absent', async () => {
    expect(await loadStudyData()).toEqual(createEmptyStudyData());
    stored[STUDY_DATA_STORAGE_KEY] = { invalid: true };
    await expect(loadStudyData()).rejects.toBeInstanceOf(StudyDataStorageError);
    expect(setCalls).toHaveLength(0);
  });

  test('migrates valid v1 data additively and leaves the legacy key byte-for-byte equivalent', async () => {
    const legacy = {
      schemaVersion: 1,
      annotations: [annotation('legacy', 2)],
      mediaProgress: [],
    };
    stored[STUDY_DATA_LEGACY_STORAGE_KEY] = structuredClone(legacy);
    const before = structuredClone(stored[STUDY_DATA_LEGACY_STORAGE_KEY]);
    const loaded = await loadStudyData();
    expect(loaded).toMatchObject({ schemaVersion: 2, bookmarks: [] });
    expect(loaded.annotations.map((item) => item.id)).toEqual(['legacy']);
    expect(stored[STUDY_DATA_LEGACY_STORAGE_KEY]).toEqual(before);
    expect(stored[STUDY_DATA_STORAGE_KEY]).toEqual(loaded);
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]).toHaveProperty(STUDY_DATA_STORAGE_KEY);
  });

  test('rejects invalid schema-v2 data without falling back to or overwriting legacy data', async () => {
    stored[STUDY_DATA_LEGACY_STORAGE_KEY] = {
      schemaVersion: 1,
      annotations: [],
      mediaProgress: [],
    };
    stored[STUDY_DATA_STORAGE_KEY] = {
      ...createEmptyStudyData(),
      unknown: true,
    };
    const before = structuredClone(stored);
    await expect(loadStudyData()).rejects.toBeInstanceOf(StudyDataStorageError);
    expect(stored).toEqual(before);
    expect(setCalls).toHaveLength(0);
  });

  test('surfaces migration write failures while preserving the legacy source', async () => {
    stored[STUDY_DATA_LEGACY_STORAGE_KEY] = {
      schemaVersion: 1,
      annotations: [],
      mediaProgress: [],
    };
    const before = structuredClone(stored[STUDY_DATA_LEGACY_STORAGE_KEY]);
    setFailure = new Error('QUOTA_BYTES exceeded');
    await expect(loadStudyData()).rejects.toBeInstanceOf(StudyDataStorageError);
    expect(stored[STUDY_DATA_LEGACY_STORAGE_KEY]).toEqual(before);
    expect(stored[STUDY_DATA_STORAGE_KEY]).toBeUndefined();
  });

  test('serializes concurrent mutations so neither update is lost', async () => {
    stored[STUDY_DATA_STORAGE_KEY] = createEmptyStudyData();
    const first = mutateStudyData(async (current) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { ...current, annotations: [...current.annotations, annotation('first', 2)] };
    });
    const second = mutateStudyData((current) => ({
      ...current,
      annotations: [...current.annotations, annotation('second', 3)],
    }));
    await Promise.all([first, second]);
    expect(setCalls).toHaveLength(2);
    expect(stored[STUDY_DATA_STORAGE_KEY].annotations.map((item) => item.id)).toEqual(['second', 'first']);
  });

  test('rejects an invalid mutation and leaves existing local data unchanged', async () => {
    stored[STUDY_DATA_STORAGE_KEY] = createEmptyStudyData();
    await expect(mutateStudyData((current) => ({ ...current, schemaVersion: 99 })))
      .rejects.toBeInstanceOf(StudyDataStorageError);
    expect(setCalls).toHaveLength(0);
    expect(stored[STUDY_DATA_STORAGE_KEY]).toEqual(createEmptyStudyData());
  });

  test('surfaces quota/write failures without pretending the update succeeded', async () => {
    stored[STUDY_DATA_STORAGE_KEY] = createEmptyStudyData();
    setFailure = new Error('QUOTA_BYTES exceeded');
    await expect(mutateStudyData((current) => current)).rejects.toBeInstanceOf(StudyDataStorageError);
    expect(stored[STUDY_DATA_STORAGE_KEY]).toEqual(createEmptyStudyData());
  });

  test('recognizes only the local study-data change key', () => {
    expect(studyDataChanged({ [STUDY_DATA_STORAGE_KEY]: {} }, 'local')).toBe(true);
    expect(studyDataChanged({ [STUDY_DATA_LEGACY_STORAGE_KEY]: {} }, 'local')).toBe(true);
    expect(studyDataChanged({ [STUDY_DATA_STORAGE_KEY]: {} }, 'sync')).toBe(false);
    expect(studyDataChanged({ flags: {} }, 'local')).toBe(false);
  });
});
