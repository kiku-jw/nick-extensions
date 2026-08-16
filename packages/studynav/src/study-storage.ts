import {
  createEmptyStudyData,
  migrateStudyDataV1,
  STUDY_DATA_LEGACY_STORAGE_KEY,
  STUDY_DATA_STORAGE_KEY,
  validateStudyData,
  type StudyDataV2,
} from './study-data';
import { t } from './i18n';

let mutationTail: Promise<unknown> = Promise.resolve();

export class StudyDataStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StudyDataStorageError';
  }
}

export async function loadStudyData(): Promise<StudyDataV2> {
  const stored = await chrome.storage.local.get([
    STUDY_DATA_STORAGE_KEY,
    STUDY_DATA_LEGACY_STORAGE_KEY,
  ]);
  const rawV2 = stored[STUDY_DATA_STORAGE_KEY];
  if (rawV2 !== undefined) {
    const data = validateStudyData(rawV2);
    if (!data) throw new StudyDataStorageError(t('local_study_data_invalid'));
    return data;
  }

  const rawV1 = stored[STUDY_DATA_LEGACY_STORAGE_KEY];
  if (rawV1 === undefined) return createEmptyStudyData();
  const migrated = migrateStudyDataV1(rawV1);
  if (!migrated) throw new StudyDataStorageError(t('local_study_data_invalid'));
  try {
    // Migration is additive: the legacy key is intentionally never removed or rewritten.
    await chrome.storage.local.set({ [STUDY_DATA_STORAGE_KEY]: migrated });
  } catch (error) {
    throw new StudyDataStorageError(t('migration_save_failed'), { cause: error });
  }
  return migrated;
}

export function mutateStudyData(
  mutate: (current: StudyDataV2) => StudyDataV2 | Promise<StudyDataV2>,
): Promise<StudyDataV2> {
  const operation = mutationTail.then(async () => {
    const current = await loadStudyData();
    const candidate = await mutate(current);
    const next = validateStudyData(candidate);
    if (!next) throw new StudyDataStorageError(t('study_data_validation_failed'));
    try {
      await chrome.storage.local.set({ [STUDY_DATA_STORAGE_KEY]: next });
    } catch (error) {
      throw new StudyDataStorageError(t('study_data_save_failed'), { cause: error });
    }
    return next;
  });
  mutationTail = operation.then(() => undefined, () => undefined);
  return operation;
}

export function studyDataChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): boolean {
  return areaName === 'local' && (
    Object.prototype.hasOwnProperty.call(changes, STUDY_DATA_STORAGE_KEY) ||
    Object.prototype.hasOwnProperty.call(changes, STUDY_DATA_LEGACY_STORAGE_KEY)
  );
}
