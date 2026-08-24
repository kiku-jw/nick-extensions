import { describe, expect, test } from 'bun:test';

import { rankStudyNavPageTabs } from '../packages/studynav/src/page-tab.ts';

describe('StudyNav mobile page tab targeting', () => {
  test('prefers the active eligible page over the Firefox add-on settings surface', () => {
    expect(rankStudyNavPageTabs([
      [{ id: 90, active: true, url: 'moz-extension://studynav/popup.html' }],
      [{ id: 90, active: true, url: 'moz-extension://studynav/popup.html' }],
      [
        { id: 90, active: true, url: 'moz-extension://studynav/popup.html' },
        { id: 12, active: true, url: 'https://www.jw.org/ru/library/' },
        { id: 13, active: false, url: 'https://wol.jw.org/uk/wol/d/r15/lp-k/1' },
      ],
    ])).toEqual([
      { id: 12, active: true, url: 'https://www.jw.org/ru/library/' },
      { id: 13, active: false, url: 'https://wol.jw.org/uk/wol/d/r15/lp-k/1' },
    ]);
  });

  test('keeps an active URL-redacted tab as a safe fallback without messaging known foreign hosts', () => {
    expect(rankStudyNavPageTabs([[
      { id: 1, active: true },
      { id: 2, active: true, url: 'https://example.com/' },
      { id: 3, active: false, url: 'https://jw.org/en/library/' },
    ]])).toEqual([
      { id: 3, active: false, url: 'https://jw.org/en/library/' },
      { id: 1, active: true },
    ]);
  });
});
