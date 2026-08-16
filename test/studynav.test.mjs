import { describe, expect, test } from 'bun:test';

import { createApplyCoordinator } from '../packages/studynav/src/apply-coordinator.ts';
import { DEFAULT_FLAGS, migrateFlagsForInstall } from '../packages/studynav/src/features.ts';
import { cssFor, deriveFeaturePlan, readTranscriptFromTracks } from '../packages/studynav/src/feature-impl.ts';
import { resolveQueryForLang, wolRouteForLang, wolSearchUrl } from '../packages/studynav/src/mnemonics.ts';
import {
  articleRootPriority,
  buildOwnedAnchorId,
  detectSupport,
  isEligibleArticleRootShape,
  isEligibleParagraphShape,
  textForCopy,
} from '../packages/studynav/src/util.ts';
import {
  assertChapterAudioSize,
  base64ToBytes,
  bytesToBase64,
  encodeWavClip,
  findBibleAudioApiUrl,
  normalizeMediaApiUrl,
  parseBibleChapterFromPath,
  parseBibleVerseId,
  parseMediaClock,
  parseUserMediaTime,
  safeFilenamePart,
  selectVerseClipSource,
  validateMediaAudioClipRequest,
  validateMediaVideoClipRequest,
  validateVerseAudioRequest,
} from '../packages/studynav/src/verse-audio.ts';

describe('StudyNav WOL locale mapping', () => {
  test('uses confirmed route tuples for en ru uk', () => {
    expect(wolRouteForLang('en')).toEqual({ route: 'r1', locale: 'lp-e' });
    expect(wolRouteForLang('ru')).toEqual({ route: 'r2', locale: 'lp-u' });
    expect(wolRouteForLang('uk')).toEqual({ route: 'r15', locale: 'lp-k' });
  });

  test('fails closed for unknown WOL locales', () => {
    expect(wolRouteForLang('de')).toBeNull();
    expect(wolSearchUrl('de', 'mwb26.08')).toBeNull();
  });

  test('keeps jw.org results while omitting unknown-language WOL results', () => {
    const results = resolveQueryForLang('123456', 'de');
    expect(results.map((item) => item.label)).toEqual([
      'DOCID 123456 - jw.org search',
      'DOCID 123456 - library finder',
    ]);
  });
});

describe('StudyNav mnemonic resolution', () => {
  test('resolves w25.03 to watchtower study jw.org filters and WOL search', () => {
    const results = resolveQueryForLang('w25.03', 'en');
    expect(results.map((item) => item.url)).toEqual([
      'https://www.jw.org/en/library/magazines/?contentLanguageFilter=en&pubFilter=w&yearFilter=2025',
      'https://www.jw.org/en/search/?q=w25.03',
      'https://wol.jw.org/en/wol/s/r1/lp-e?q=w25.03',
      'https://www.jw.org/en/library/?q=w25.03',
    ]);
  });

  test('resolves wp24.01 to public watchtower search and year filter pages', () => {
    const results = resolveQueryForLang('wp24.01', 'en');
    expect(results.map((item) => item.url)).toEqual([
      'https://www.jw.org/en/search/?q=wp24.01',
      'https://www.jw.org/en/library/magazines/?pubFilter=wp&yearFilter=2024',
      'https://wol.jw.org/en/wol/s/r1/lp-e?q=wp24.01',
      'https://www.jw.org/en/library/?q=wp24.01',
    ]);
  });

  test('resolves g24.01 to awake search and year filter pages', () => {
    const results = resolveQueryForLang('g24.01', 'en');
    expect(results.map((item) => item.url)).toEqual([
      'https://www.jw.org/en/search/?q=g24.01',
      'https://www.jw.org/en/library/magazines/?pubFilter=g&yearFilter=2024',
      'https://wol.jw.org/en/wol/s/r1/lp-e?q=g24.01',
      'https://www.jw.org/en/library/?q=g24.01',
    ]);
  });

  test('resolves mwb25.01 to workbook search plus WOL search', () => {
    const results = resolveQueryForLang('mwb25.01', 'en');
    expect(results.map((item) => item.url)).toEqual([
      'https://www.jw.org/en/search/?q=mwb25.01',
      'https://wol.jw.org/en/wol/s/r1/lp-e?q=mwb25.01',
      'https://www.jw.org/en/library/?q=mwb25.01',
    ]);
  });

  test('resolves lff to safe public book landing pages only', () => {
    const results = resolveQueryForLang('lff', 'en');
    expect(results.map((item) => item.url)).toEqual([
      'https://www.jw.org/en/library/books/enjoy-life-forever/',
      'https://www.jw.org/en/search/?q=lff',
      'https://wol.jw.org/en/wol/s/r1/lp-e?q=lff',
      'https://www.jw.org/en/library/?q=lff',
    ]);
  });
});

describe('StudyNav support gate', () => {
  test('supports jw.org library article surfaces', () => {
    expect(detectSupport({
      hostname: 'www.jw.org',
      pathname: '/en/library/books/sample/',
      articleRootCount: 1,
      mediaRootCount: 0,
    })).toEqual({
      supported: true,
      palette: true,
      article: true,
      language: true,
      media: false,
    });
    expect(detectSupport({
      hostname: 'www.jw.org',
      pathname: '/ru/biblioteka/bibliya/izuchenie-biblii/knigi/bytie/1/',
      articleRootCount: 1,
      mediaRootCount: 0,
    }).article).toBe(true);
    expect(detectSupport({
      hostname: 'www.jw.org',
      pathname: '/ru/%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D0%BE%D1%82%D0%B5%D0%BA%D0%B0/%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D1%8F/nwt/%D1%81%D0%BE%D0%B4%D0%B5%D1%80%D0%B6%D0%B0%D0%BD%D0%B8%D0%B5/%D0%B1%D1%8B%D1%82%D0%B8%D0%B5/1/',
      articleRootCount: 1,
      mediaRootCount: 0,
    }).article).toBe(true);
    expect(detectSupport({
      hostname: 'www.jw.org',
      pathname: '/uk/%D0%B1%D1%96%D0%B1%D0%BB%D1%96%D0%BE%D1%82%D0%B5%D0%BA%D0%B0/%D0%B1%D1%96%D0%B1%D0%BB%D1%96%D1%8F/nwt/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B8/%D0%B1%D1%83%D1%82%D1%82%D1%8F/1/',
      articleRootCount: 1,
      mediaRootCount: 0,
    }).article).toBe(true);
  });

  test('supports WOL document surfaces but not jw-only language badge', () => {
    expect(detectSupport({
      hostname: 'wol.jw.org',
      pathname: '/ru/wol/d/r2/lp-u/123456',
      articleRootCount: 1,
      mediaRootCount: 0,
    })).toEqual({
      supported: true,
      palette: true,
      article: true,
      language: false,
      media: false,
    });
  });

  test('supports real nested JW article routes but fails closed on error pages', () => {
    expect(detectSupport({
      hostname: 'www.jw.org',
      pathname: '/en/news/region/article/',
      articleRootCount: 1,
      mediaRootCount: 0,
    })).toEqual({
      supported: true,
      palette: false,
      article: true,
      language: true,
      media: false,
    });

    expect(detectSupport({
      hostname: 'www.jw.org',
      pathname: '/en/library/books/missing/',
      articleRootCount: 1,
      mediaRootCount: 0,
      pageNotFound: true,
    })).toEqual({
      supported: false,
      palette: false,
      article: false,
      language: false,
      media: false,
    });
  });
});

describe('StudyNav root and paragraph scope', () => {
  test('rejects broad publication body matches and dialog jwac wrappers as article roots', () => {
    expect(isEligibleArticleRootShape({
      tagName: 'body',
      id: 'mid1102021201',
      className: 'PublicationArticle docId-1102021201',
      dataPidDescendants: 54,
    })).toBe(false);

    expect(isEligibleArticleRootShape({
      tagName: 'section',
      className: 'lnc-firstRunPopup-content jwac lnc-languageBoundary',
      dataPidDescendants: 0,
    })).toBe(false);
  });

  test('accepts actual article containers', () => {
    expect(isEligibleArticleRootShape({
      tagName: 'article',
      id: 'article',
      className: 'jwac docClass-13 pub-lff',
      dataPidDescendants: 54,
    })).toBe(true);

    expect(isEligibleArticleRootShape({
      tagName: 'div',
      className: 'bodyTxt',
      dataPidDescendants: 39,
    })).toBe(true);
  });

  test('prefers article roots over broader content ancestors', () => {
    expect(articleRootPriority({
      tagName: 'article',
      id: 'article',
      className: 'jwac docClass-13 pub-lff',
      dataPidDescendants: 54,
    })).toBeGreaterThan(articleRootPriority({
      tagName: 'main',
      id: 'content',
      className: 'grid-layout--pub-sidebar',
      dataPidDescendants: 54,
    }));
  });

  test('rejects Page Not Found article containers', () => {
    expect(articleRootPriority({
      tagName: 'article',
      id: 'article',
      className: 'jwac docClass-130 PageNotFound',
      dataPidDescendants: 1,
    })).toBe(0);
  });

  test('only prose and verse tags are eligible paragraph nodes', () => {
    expect(isEligibleParagraphShape({ tagName: 'P', hasDataPid: true })).toBe(true);
    expect(isEligibleParagraphShape({ tagName: 'DIV', hasDataPid: true })).toBe(false);
    expect(isEligibleParagraphShape({ tagName: 'H3', hasDataPid: true })).toBe(false);
    expect(isEligibleParagraphShape({ tagName: 'H1', hasDataPid: true })).toBe(false);
    expect(isEligibleParagraphShape({ tagName: 'LEGEND', hasDataPid: true })).toBe(false);
    expect(isEligibleParagraphShape({ tagName: 'SPAN', hasDataVerse: true, className: 'verse' })).toBe(true);
    expect(isEligibleParagraphShape({ tagName: 'DIV', hasDataVerse: true })).toBe(true);
  });
});

describe('StudyNav feature planning', () => {
  test('keeps layout-changing helpers off by default', () => {
    expect(DEFAULT_FLAGS.actionBar).toBe(false);
    expect(DEFAULT_FLAGS.expandWidth).toBe(false);
    expect(DEFAULT_FLAGS.cstblView).toBe(false);
    expect(DEFAULT_FLAGS.imgGet).toBe(false);
    expect(DEFAULT_FLAGS.annotations).toBe(true);
    expect(DEFAULT_FLAGS.bookmarks).toBe(true);
    expect(DEFAULT_FLAGS.citations).toBe(true);
    expect(DEFAULT_FLAGS.continueWatching).toBe(true);
    expect(DEFAULT_FLAGS.qrShare).toBe(true);
    expect(DEFAULT_FLAGS.officialOpen).toBe(true);
    expect(DEFAULT_FLAGS.mediaClip).toBe(true);
  });

  test('migrates legacy 1.2.3 layout defaults off once while preserving later opt-ins', () => {
    const legacy = migrateFlagsForInstall({
      ...DEFAULT_FLAGS,
      actionBar: true,
      expandWidth: true,
      cstblView: true,
    }, { reason: 'update', previousVersion: '1.2.3' });
    expect(legacy.actionBar).toBe(false);
    expect(legacy.expandWidth).toBe(false);
    expect(legacy.cstblView).toBe(false);

    const explicitLaterOptIn = migrateFlagsForInstall({
      ...DEFAULT_FLAGS,
      actionBar: true,
      expandWidth: true,
      cstblView: true,
    }, { reason: 'update', previousVersion: '1.2.4' });
    expect(explicitLaterOptIn.actionBar).toBe(true);
    expect(explicitLaterOptIn.expandWidth).toBe(true);
    expect(explicitLaterOptIn.cstblView).toBe(true);

    const browserUpdate = migrateFlagsForInstall({
      ...DEFAULT_FLAGS,
      actionBar: true,
    }, { reason: 'chrome_update' });
    expect(browserUpdate.actionBar).toBe(true);
  });

  test('suppresses layout CSS on WOL even when old stored flags are enabled', () => {
    const forcedLayout = {
      ...DEFAULT_FLAGS,
      actionBar: true,
      expandWidth: true,
      cstblView: true,
    };
    const css = cssFor(forcedLayout, 'wol.jw.org');
    expect(css).not.toContain('position: sticky');
    expect(css).not.toContain('max-width: min(1100px, 96vw)');
    expect(css).not.toContain('border-collapse: collapse');
  });

  test('uses narrow, border-box layout CSS on jw.org opt-in', () => {
    const forcedLayout = {
      ...DEFAULT_FLAGS,
      actionBar: true,
      expandWidth: true,
      cstblView: true,
    };
    const css = cssFor(forcedLayout, 'www.jw.org');
    expect(css).toContain('#regionHeader');
    expect(css).toContain('box-sizing: border-box');
    expect(css).not.toContain('.jsLockedChrome');
    expect(css).not.toContain('.unified.navLeft');
    expect(css).not.toContain('#regionPrimaryNav');
    expect(css).not.toContain('#footer');
  });

  test('keeps article image downloads opt-in while respecting an explicit enable', () => {
    expect(DEFAULT_FLAGS.imgGet).toBe(false);
    const plan = deriveFeaturePlan({ ...DEFAULT_FLAGS, imgGet: true }, {
      supported: true,
      palette: true,
      article: true,
      language: true,
      media: false,
    });
    expect(plan.teardown.imgGet).toBe(false);
  });

  test('tears everything down when route is unsupported even with master enabled', () => {
    const plan = deriveFeaturePlan(DEFAULT_FLAGS, {
      supported: false,
      palette: false,
      article: false,
      language: false,
      media: false,
    });
    expect(plan.state).toBe('unsupported');
    expect(plan.teardownAll).toBe(true);
    expect(plan.teardown.copyAndLinks).toBe(true);
    expect(plan.teardown.palette).toBe(true);
    expect(plan.teardown.mediaCtrl).toBe(true);
  });

  test('tears down disabled feature surfaces on supported pages', () => {
    const plan = deriveFeaturePlan({
      ...DEFAULT_FLAGS,
      copyText: false,
      parLink: false,
      verseAudio: false,
      altText: false,
      imgGet: false,
      langCount: false,
      mediaCtrl: false,
      advSearch: false,
      transcCreate: false,
      annotations: false,
      bookmarks: false,
      continueWatching: false,
    }, {
      supported: true,
      palette: true,
      article: true,
      language: true,
      media: true,
    });
    expect(plan.state).toBe('active');
    expect(plan.teardownAll).toBe(false);
    expect(plan.teardown.copyAndLinks).toBe(true);
    expect(plan.teardown.altText).toBe(true);
    expect(plan.teardown.imgGet).toBe(true);
    expect(plan.teardown.languageBadge).toBe(true);
    expect(plan.teardown.mediaCtrl).toBe(true);
    expect(plan.teardown.palette).toBe(true);
    expect(plan.teardown.transcript).toBe(true);
    expect(plan.teardown.annotations).toBe(true);
    expect(plan.teardown.continueWatching).toBe(true);
  });

  test('keeps the shared paragraph toolbar for Mark and scopes continue watching to media', () => {
    const articlePlan = deriveFeaturePlan({
      ...DEFAULT_FLAGS,
      copyText: false,
      parLink: false,
      verseAudio: false,
      annotations: true,
    }, {
      supported: true,
      palette: true,
      article: true,
      language: true,
      media: false,
    });
    expect(articlePlan.teardown.copyAndLinks).toBe(false);
    expect(articlePlan.teardown.annotations).toBe(false);
    expect(articlePlan.teardown.continueWatching).toBe(true);

    const mediaPlan = deriveFeaturePlan(DEFAULT_FLAGS, {
      supported: true,
      palette: true,
      article: false,
      language: false,
      media: true,
    });
    expect(mediaPlan.teardown.continueWatching).toBe(false);
  });

  test('keeps the study runtime for saved places without annotation controls', () => {
    const plan = deriveFeaturePlan({
      ...DEFAULT_FLAGS,
      annotations: false,
      bookmarks: true,
      copyText: false,
      parLink: false,
      verseAudio: false,
    }, {
      supported: true,
      palette: true,
      article: true,
      language: true,
      media: false,
    });
    expect(plan.teardown.annotations).toBe(false);
    expect(plan.teardown.copyAndLinks).toBe(true);
  });

  test('keeps verse tools when audio is the only paragraph action enabled', () => {
    const plan = deriveFeaturePlan({
      ...DEFAULT_FLAGS,
      copyText: false,
      parLink: false,
      verseAudio: true,
    }, {
      supported: true,
      palette: true,
      article: true,
      language: true,
      media: false,
    });
    expect(plan.teardown.copyAndLinks).toBe(false);
  });
});

describe('StudyNav verse audio boundaries', () => {
  const apiUrl = 'https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?booknum=1&output=json&pub=nwt&fileformat=MP3&alllangs=0&track=1&langwritten=E&txtCMSLang=E';

  test('parses canonical verse ids and rejects malformed ranges', () => {
    expect(parseBibleVerseId('v01001003')).toBeNull();
    expect(parseBibleVerseId('v1001003')).toEqual({ book: 1, chapter: 1, verse: 3 });
    expect(parseBibleVerseId('v0001001')).toBeNull();
    expect(parseBibleVerseId('v67001001')).toBeNull();
  });

  test('accepts only matching official media requests from Bible chapter pages', () => {
    const request = {
      type: 'DOWNLOAD_VERSE_AUDIO',
      verseIds: ['v01001003'],
      apiUrl,
      label: 'Genesis',
    };
    expect(parseBibleChapterFromPath('/en/library/bible/study-bible/books/genesis/1/')).toBe(1);
    expect(parseBibleChapterFromPath('/ru/biblioteka/bibliya/izuchenie-biblii/knigi/bytie/1/')).toBe(1);
    expect(parseBibleChapterFromPath('/uk/biblioteka/bibliya/posibnik-dlya-vivchennya-bibliyi/knigi/buttya/1/')).toBe(1);
    const russianPage = 'https://www.jw.org/ru/%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D0%BE%D1%82%D0%B5%D0%BA%D0%B0/%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D1%8F/nwt/%D1%81%D0%BE%D0%B4%D0%B5%D1%80%D0%B6%D0%B0%D0%BD%D0%B8%D0%B5/%D0%B1%D1%8B%D1%82%D0%B8%D0%B5/1/';
    const ukrainianPage = 'https://www.jw.org/uk/%D0%B1%D1%96%D0%B1%D0%BB%D1%96%D0%BE%D1%82%D0%B5%D0%BA%D0%B0/%D0%B1%D1%96%D0%B1%D0%BB%D1%96%D1%8F/nwt/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B8/%D0%B1%D1%83%D1%82%D1%82%D1%8F/1/';
    const canonicalRussianPage = 'https://www.jw.org/ru/%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D0%BE%D1%82%D0%B5%D0%BA%D0%B0/%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D1%8F/%D1%83%D1%87%D0%B5%D0%B1%D0%BD%D0%B0%D1%8F-%D0%B1%D0%B8%D0%B1%D0%BB%D0%B8%D1%8F/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B8/%D0%91%D1%8B%D1%82%D0%B8%D0%B5/1/';
    const canonicalUkrainianPage = 'https://www.jw.org/uk/%D0%B1%D1%96%D0%B1%D0%BB%D1%96%D0%BE%D1%82%D0%B5%D0%BA%D0%B0/%D0%B1%D1%96%D0%B1%D0%BB%D1%96%D1%8F/%D0%BD%D0%B0%D0%B2%D1%87%D0%B0%D0%BB%D1%8C%D0%BD%D0%B5-%D0%B2%D0%B8%D0%B4%D0%B0%D0%BD%D0%BD%D1%8F-%D0%B1%D1%96%D0%B1%D0%BB%D1%96%D1%97/%D0%BA%D0%BD%D0%B8%D0%B3%D0%B8/%D0%91%D1%83%D1%82%D1%82%D1%8F/1/';
    expect(parseBibleChapterFromPath(new URL(russianPage).pathname)).toBe(1);
    expect(parseBibleChapterFromPath(new URL(ukrainianPage).pathname)).toBe(1);
    expect(parseBibleChapterFromPath(new URL(canonicalRussianPage).pathname)).toBe(1);
    expect(parseBibleChapterFromPath(new URL(canonicalUkrainianPage).pathname)).toBe(1);
    expect(parseBibleChapterFromPath('/ru/библиотека/библия/учебная-библия/книги/Бытие/1/')).toBe(1);
    expect(parseBibleChapterFromPath('/uk/бібліотека/біблія/навчальне-видання-біблії/книги/Буття/1/')).toBe(1);
    expect(parseBibleChapterFromPath('/ru/%E0%A4%A/nwt/1/')).toBeNull();
    expect(parseBibleChapterFromPath('/ru/библиотека/библия/учебная-библия/Бытие/1/')).toBeNull();
    expect(parseBibleChapterFromPath('/uk/бібліотека/біблія/навчальне-видання-біблії/книги/Буття/1/лишнее/')).toBeNull();
    expect(validateVerseAudioRequest(
      request,
      'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    )).toBeNull();
    const validRequest = { ...request, verseIds: ['v1001003'] };
    expect(validateVerseAudioRequest(
      validRequest,
      'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    )?.verses).toEqual([{ book: 1, chapter: 1, verse: 3 }]);
    expect(validateVerseAudioRequest(
      { ...validRequest, label: 'Бытие' },
      'https://www.jw.org/ru/biblioteka/bibliya/izuchenie-biblii/knigi/bytie/1/',
    )?.verses).toEqual([{ book: 1, chapter: 1, verse: 3 }]);
    expect(validateVerseAudioRequest(
      { ...validRequest, apiUrl: apiUrl.replace('langwritten=E', 'langwritten=U').replace('txtCMSLang=E', 'txtCMSLang=U') },
      russianPage,
    )?.apiUrl).toContain('langwritten=U');
    expect(validateVerseAudioRequest(
      { ...validRequest, label: 'Бытие', apiUrl: apiUrl.replace('langwritten=E', 'langwritten=U').replace('txtCMSLang=E', 'txtCMSLang=U') },
      canonicalRussianPage,
    )?.apiUrl).toContain('langwritten=U');
    expect(validateVerseAudioRequest(
      { ...validRequest, label: 'Буття', apiUrl: apiUrl.replace('langwritten=E', 'langwritten=K').replace('txtCMSLang=E', 'txtCMSLang=K') },
      ukrainianPage,
    )?.apiUrl).toContain('langwritten=K');
    expect(validateVerseAudioRequest(
      { ...validRequest, label: 'Буття', apiUrl: apiUrl.replace('langwritten=E', 'langwritten=K').replace('txtCMSLang=E', 'txtCMSLang=K') },
      canonicalUkrainianPage,
    )?.apiUrl).toContain('langwritten=K');
    expect(validateVerseAudioRequest(
      { ...validRequest, apiUrl: apiUrl.replace('b.jw-cdn.org', 'example.com') },
      'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    )).toBeNull();
    expect(validateVerseAudioRequest(
      validRequest,
      'https://www.jw.org/en/library/books/sample/',
    )).toBeNull();
    expect(validateVerseAudioRequest(
      { ...validRequest, apiUrl: apiUrl.replace('track=1', 'track=2') },
      'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    )).toBeNull();

    const reversedRange = validateVerseAudioRequest(
      { ...validRequest, verseIds: ['v1001005', 'v1001004', 'v1001003'] },
      'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    );
    expect(reversedRange?.verseIds).toEqual(['v1001003', 'v1001004', 'v1001005']);
    expect(reversedRange?.verses.map(({ verse }) => verse)).toEqual([3, 4, 5]);
    expect(validateVerseAudioRequest(
      { ...validRequest, verseIds: ['v1001003', 'v1001005'] },
      'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    )).toBeNull();
    expect(validateVerseAudioRequest(
      { ...validRequest, verseIds: ['v1001003', 'v1001003'] },
      'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    )).toBeNull();
    expect(validateVerseAudioRequest(
      { ...validRequest, verseIds: ['v1001003', 'v1002004'] },
      'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    )).toBeNull();
    expect(validateVerseAudioRequest(
      { ...validRequest, verseIds: ['v1001003', 'v2001004'] },
      'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    )).toBeNull();
    expect(validateVerseAudioRequest(
      { ...validRequest, verseIds: [] },
      'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    )).toBeNull();
    expect(validateVerseAudioRequest(
      { ...validRequest, verseIds: undefined, verseId: 'v1001003' },
      'https://www.jw.org/en/library/bible/study-bible/books/genesis/1/',
    )).toBeNull();
  });

  test('discovers the official API resource or derives it from the chapter audio filename', () => {
    const pageApiUrl = 'https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?output=json&pub=nwtsty&fileformat=MP3&alllangs=0&langwritten=U&txtCMSLang=U';
    const ukrainianPageApiUrl = pageApiUrl.replace('langwritten=U', 'langwritten=K').replace('txtCMSLang=U', 'txtCMSLang=K');
    expect(findBibleAudioApiUrl(['https://example.com/data', apiUrl], 'v1001003')).toBe(apiUrl);
    expect(findBibleAudioApiUrl([pageApiUrl], 'v1001003')).toContain('booknum=1');
    expect(findBibleAudioApiUrl([pageApiUrl], 'v1001003')).toContain('pub=nwt');
    expect(normalizeMediaApiUrl(pageApiUrl, { book: 1, chapter: 1, verse: 3 })).toContain('track=1');
    expect(findBibleAudioApiUrl([ukrainianPageApiUrl], 'v1001003')).toContain('langwritten=K');
    expect(findBibleAudioApiUrl(
      [],
      'v1001003',
      'https://cfp2.jw-cdn.org/a/test/1/o/nwt_01_Ge_E_01.mp3',
    )).toContain('booknum=1');
    expect(findBibleAudioApiUrl(
      [],
      'v1001003',
      'https://cfp2.jw-cdn.org/a/test/1/o/nwt_01_Ge_U_01.mp3',
    )).toContain('langwritten=U');
    expect(findBibleAudioApiUrl([], 'v1001003', 'https://example.com/nwt_01_Ge_E_01.mp3')).toBeNull();
  });

  test('selects the exact official marker and sanitizes the download name', () => {
    const source = selectVerseClipSource({
      files: {
        E: {
          MP3: [{
            file: { url: 'https://cfp2.jw-cdn.org/a/test/chapter.mp3' },
            filesize: 1000,
            duration: 60,
            markers: {
              bibleBookNumber: 1,
              bibleBookChapter: 1,
              markers: [
                { verseNumber: 3, startTime: '00:00:22.405', duration: '00:00:06.394' },
              ],
            },
          }],
        },
      },
    }, [{ book: 1, chapter: 1, verse: 3 }], 'Genesis: Study / Edition');
    expect(source).toEqual({
      audioUrl: 'https://cfp2.jw-cdn.org/a/test/chapter.mp3',
      startSeconds: 22.405,
      durationSeconds: 6.394,
      filename: 'Genesis Study Edition_1_3.wav',
      expectedBytes: 1000,
    });
    expect(parseMediaClock('00:01:02.345')).toBe(62.345);
    expect(parseMediaClock('00:61:00.000')).toBeNull();
    expect(safeFilenamePart('  Psalm 119:*?  ')).toBe('Psalm 119');

    const invalidMarkerPayload = {
      files: {
        E: {
          MP3: [{
            file: { url: 'https://cfp2.jw-cdn.org/a/test/chapter.mp3' },
            filesize: 1000,
            duration: 60,
            markers: {
              bibleBookNumber: 1,
              bibleBookChapter: 1,
              markers: [{ verseNumber: 3, startTime: '00:00:59.000', duration: '00:00:05.000' }],
            },
          }],
        },
      },
    };
    expect(selectVerseClipSource(invalidMarkerPayload, [{ book: 1, chapter: 1, verse: 3 }], 'Genesis')).toBeNull();
    expect(selectVerseClipSource({ files: { E: { MP3: [] } } }, [{ book: 1, chapter: 1, verse: 3 }], 'Genesis')).toBeNull();
  });

  test('clips a consecutive verse range from the first marker through the last marker end', () => {
    const payload = {
      files: {
        E: {
          MP3: [{
            file: { url: 'https://cfp2.jw-cdn.org/a/test/chapter.mp3' },
            filesize: 12_000,
            duration: 180,
            markers: {
              bibleBookNumber: 1,
              bibleBookChapter: 1,
              markers: [
                { verseNumber: 3, startTime: '00:00:22.405', duration: '00:00:06.394' },
                { verseNumber: 4, startTime: '00:00:28.799', duration: '00:00:07.201' },
                { verseNumber: 5, startTime: '00:00:36.000', duration: '00:00:08.500' },
              ],
            },
          }],
        },
      },
    };
    const verses = [3, 4, 5].map((verse) => ({ book: 1, chapter: 1, verse }));
    expect(selectVerseClipSource(payload, verses, 'Genesis')).toEqual({
      audioUrl: 'https://cfp2.jw-cdn.org/a/test/chapter.mp3',
      startSeconds: 22.405,
      durationSeconds: 22.095,
      filename: 'Genesis_1_3-5.wav',
      expectedBytes: 12_000,
    });

    const missingMarker = structuredClone(payload);
    missingMarker.files.E.MP3[0].markers.markers.splice(1, 1);
    expect(selectVerseClipSource(missingMarker, verses, 'Genesis')).toBeNull();

    const duplicateMarker = structuredClone(payload);
    duplicateMarker.files.E.MP3[0].markers.markers.push(
      { verseNumber: 4, startTime: '00:00:29.000', duration: '00:00:01.000' },
    );
    expect(selectVerseClipSource(duplicateMarker, verses, 'Genesis')).toBeNull();

    const nonMonotonic = structuredClone(payload);
    nonMonotonic.files.E.MP3[0].markers.markers[1].startTime = '00:00:20.000';
    expect(selectVerseClipSource(nonMonotonic, verses, 'Genesis')).toBeNull();

    const tooLong = structuredClone(payload);
    tooLong.files.E.MP3[0].duration = 240;
    tooLong.files.E.MP3[0].markers.markers[2].startTime = '00:02:30.000';
    expect(selectVerseClipSource(tooLong, verses, 'Genesis')).toBeNull();
    expect(selectVerseClipSource(payload, [verses[0], verses[2]], 'Genesis')).toBeNull();
  });

  test('encodes the requested sample interval as deterministic PCM16 WAV', () => {
    const samples = new Float32Array(16_000);
    samples.fill(0.5);
    const wav = encodeWavClip({
      numberOfChannels: 1,
      length: samples.length,
      sampleRate: 8_000,
      getChannelData: () => samples,
    }, 0.25, 0.5);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(8_000);
    expect(view.getUint32(40, true)).toBe(8_000);
    expect(wav.byteLength).toBe(8_044);
    expect(view.getInt16(44, true)).toBe(16_383);
    expect(() => encodeWavClip({
      numberOfChannels: 0,
      length: 10,
      sampleRate: 8_000,
      getChannelData: () => new Float32Array(10),
    }, 0, 1)).toThrow('Decoded chapter audio is invalid.');
    expect(() => encodeWavClip({
      numberOfChannels: 1,
      length: 10,
      sampleRate: 8_000,
      getChannelData: () => new Float32Array(10),
    }, 2, 1)).toThrow('The selected verse is outside the chapter audio.');
  });

  test('bounds chapter transport size and round-trips binary payloads', () => {
    expect(() => assertChapterAudioSize(1_000, 1_000)).not.toThrow();
    expect(() => assertChapterAudioSize(0, null)).toThrow('too large');
    expect(() => assertChapterAudioSize(70 * 1024 * 1024, null)).toThrow('too large');
    expect(() => assertChapterAudioSize(10_000, 1_000)).toThrow('does not match');

    const bytes = Uint8Array.from([0, 1, 2, 127, 128, 254, 255]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });
});

describe('StudyNav manual media clips', () => {
  test('parses short timestamps and rejects ambiguous or excessive values', () => {
    expect(parseUserMediaTime('1:05')).toBe(65);
    expect(parseUserMediaTime('1:02:03.5')).toBe(3723.5);
    expect(parseUserMediaTime('90')).toBe(90);
    expect(parseUserMediaTime('1:60')).toBeNull();
    expect(parseUserMediaTime('-1')).toBeNull();
  });

  test('accepts only bounded JW CDN clips requested from HTTPS JW pages', () => {
    const request = {
      type: 'DOWNLOAD_MEDIA_AUDIO_CLIP',
      mediaUrl: 'https://cfp2.jw-cdn.org/a/example/1/o/sample.mp4',
      startSeconds: 12,
      endSeconds: 42,
      label: 'Sample video',
    };
    const page = 'https://www.jw.org/ru/biblioteka/video/sample/';
    expect(validateMediaAudioClipRequest(request, page)).toMatchObject({
      startSeconds: 12,
      endSeconds: 42,
      filename: 'Sample video_0012-0042.wav',
    });
    expect(validateMediaAudioClipRequest({ ...request, endSeconds: 132 }, page)).not.toBeNull();
    expect(validateMediaAudioClipRequest({ ...request, endSeconds: 132.1 }, page)).toBeNull();
    expect(validateMediaAudioClipRequest({ ...request, mediaUrl: 'https://example.com/video.mp4' }, page)).toBeNull();
    expect(validateMediaAudioClipRequest(request, 'http://www.jw.org/ru/biblioteka/video/sample/')).toBeNull();

    const videoRequest = { ...request, type: 'DOWNLOAD_MEDIA_VIDEO_CLIP', endSeconds: 60 };
    expect(validateMediaVideoClipRequest(videoRequest, page)).toMatchObject({
      startSeconds: 12,
      endSeconds: 60,
      filename: 'Sample video_0012-0060.webm',
    });
    expect(validateMediaVideoClipRequest({ ...videoRequest, endSeconds: 72 }, page)).not.toBeNull();
    expect(validateMediaVideoClipRequest({ ...videoRequest, endSeconds: 72.1 }, page)).toBeNull();
    expect(validateMediaVideoClipRequest({ ...videoRequest, mediaUrl: 'https://example.com/video.mp4' }, page)).toBeNull();
    expect(validateMediaVideoClipRequest(videoRequest, 'http://www.jw.org/ru/biblioteka/video/sample/')).toBeNull();
  });
});

describe('StudyNav anchor ids', () => {
  test('derives deterministic owned anchor ids from pid and verse metadata', () => {
    expect(buildOwnedAnchorId('P 12.3', null)).toBe('studynav-pid-p-12-3');
    expect(buildOwnedAnchorId(null, 'Verse 4')).toBe('studynav-verse-verse-4');
    expect(buildOwnedAnchorId(null, null)).toBeNull();
  });
});

describe('StudyNav copy sanitizing', () => {
  test('excludes owned toolbar nodes from copied text', () => {
    const fakeClone = {
      innerText: 'Paragraph text',
      textContent: 'Paragraph text',
      querySelectorAll: () => [
        { remove: () => { fakeClone.innerText = 'Paragraph text'; fakeClone.textContent = 'Paragraph text'; } },
      ],
    };
    const fakeElement = {
      cloneNode: () => fakeClone,
    };
    expect(textForCopy(fakeElement)).toBe('Paragraph text');
  });
});

describe('StudyNav transcript extraction', () => {
  test('restores caption track mode after reading cues', async () => {
    const track = {
      mode: 'showing',
      cues: [{ text: 'Line one' }, { text: 'Line two' }],
    };
    const text = await readTranscriptFromTracks({ textTracks: [track] });
    expect(text).toBe('Line one\nLine two');
    expect(track.mode).toBe('showing');
  });
});

describe('StudyNav apply coordinator', () => {
  test('disconnects observer during apply and reconnects after', () => {
    const calls = [];
    const coordinator = createApplyCoordinator({
      clearTimer() {},
      disconnectObserver() { calls.push('disconnect'); },
      reconnectObserver() { calls.push('reconnect'); },
      runApply() { calls.push('apply'); },
      setTimer() { throw new Error('setTimer should not be called in flush test'); },
    });

    coordinator.flush();
    expect(calls).toEqual(['disconnect', 'apply', 'reconnect']);
  });

  test('coalesces reentrant schedule into one follow-up run', () => {
    const calls = [];
    const timers = [];
    let coordinator;
    coordinator = createApplyCoordinator({
      clearTimer() {},
      disconnectObserver() { calls.push('disconnect'); },
      reconnectObserver() { calls.push('reconnect'); },
      runApply() {
        calls.push('apply');
        if (calls.filter((x) => x === 'apply').length === 1) coordinator.schedule();
      },
      setTimer(fn) {
        timers.push(fn);
        return timers.length;
      },
    });

    coordinator.flush();
    expect(calls).toEqual(['disconnect', 'apply', 'reconnect']);
    expect(timers).toHaveLength(1);

    timers[0]();
    expect(calls).toEqual([
      'disconnect', 'apply', 'reconnect',
      'disconnect', 'apply', 'reconnect',
    ]);
  });
});
