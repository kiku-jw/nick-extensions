import { describe, expect, test } from 'bun:test';

import {
  MEDIA_PROGRESS_SAVE_INTERVAL_MS,
  formatMediaTime,
  normalizeMediaSourceIdentity,
  shouldSaveTimedProgress,
} from '../packages/studynav/src/media-progress-runtime.ts';

describe('StudyNav continue-watching helpers', () => {
  test('enforces the five-second timed-save boundary', () => {
    expect(MEDIA_PROGRESS_SAVE_INTERVAL_MS).toBe(5_000);
    expect(shouldSaveTimedProgress(10_000, 14_999)).toBe(false);
    expect(shouldSaveTimedProgress(10_000, 15_000)).toBe(true);
    expect(shouldSaveTimedProgress(10_000, 15_001)).toBe(true);
    expect(shouldSaveTimedProgress(10_000, Number.NaN)).toBe(false);
  });

  test('formats minute and hour resume labels without fractions', () => {
    expect(formatMediaTime(0)).toBe('0:00');
    expect(formatMediaTime(65.9)).toBe('1:05');
    expect(formatMediaTime(3_723)).toBe('1:02:03');
    expect(formatMediaTime(Number.NaN)).toBe('0:00');
  });

  test('chooses a stable HTTP source, strips fragments, and rejects transient or credentialed candidates', () => {
    expect(normalizeMediaSourceIdentity([
      'blob:https://www.jw.org/transient',
      '/media/video.mp4#player',
    ], '', 0, 'https://www.jw.org/en/library/videos/')).toBe('https://www.jw.org/media/video.mp4');

    expect(normalizeMediaSourceIdentity([
      'data:video/mp4;base64,AAAA',
      'https://user:secret@example.test/video.mp4',
      'file:///tmp/video.mp4',
    ], 'player-7', 2, 'https://www.jw.org/')).toBe('element:player-7');

    expect(normalizeMediaSourceIdentity([], '', 3, 'https://www.jw.org/')).toBe('dom-video:3');
  });
});
