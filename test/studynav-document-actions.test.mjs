import { describe, expect, test } from 'bun:test';
import decodeQR from '../packages/studynav/node_modules/qr/decode.js';
import encodeQR, { Bitmap } from '../packages/studynav/node_modules/qr/index.js';

import {
  buildOfficialFinderUrl,
  canonicalStudyUrl,
  cleanCitationText,
  formatOnlineCitation,
  isSupportedJwHttpsUrl,
  preciseStudyUrl,
  truncateCitationQuote,
} from '../packages/studynav/src/document-actions.ts';
import { qrSvgForStudyUrl } from '../packages/studynav/src/qr-code.ts';

describe('StudyNav document actions', () => {
  test('accepts only supported HTTPS JW hosts', () => {
    expect(isSupportedJwHttpsUrl('https://www.jw.org/en/library/')).toBe(true);
    expect(isSupportedJwHttpsUrl('https://wol.jw.org/en/wol/d/r1/lp-e/1')).toBe(true);
    expect(isSupportedJwHttpsUrl('https://stream.jw.org/')).toBe(true);
    expect(isSupportedJwHttpsUrl('http://www.jw.org/en/')).toBe(false);
    expect(isSupportedJwHttpsUrl('https://jw.org.example.com/')).toBe(false);
    expect(isSupportedJwHttpsUrl('not a url')).toBe(false);
  });

  test('prefers a safe canonical URL and removes tracking only', () => {
    expect(canonicalStudyUrl(
      'https://www.jw.org/en/library/books/sample/?media=items&srcid=share&utm_source=x#p3',
      'https://www.jw.org/en/library/books/sample/',
    )).toBe('https://www.jw.org/en/library/books/sample/');
    expect(canonicalStudyUrl(
      'https://wol.jw.org/en/wol/d/r1/lp-e/123?foo=1&utm_medium=x#p3',
      'https://evil.example/canonical',
    )).toBe('https://wol.jw.org/en/wol/d/r1/lp-e/123?foo=1');
    expect(canonicalStudyUrl('https://example.com/page')).toBeNull();
  });

  test('adds only a safe precise fragment', () => {
    expect(preciseStudyUrl('https://www.jw.org/en/library/books/sample/', 'v1001003'))
      .toBe('https://www.jw.org/en/library/books/sample/#v1001003');
    expect(preciseStudyUrl('https://www.jw.org/en/library/books/sample/', 'bad fragment'))
      .toBe('https://www.jw.org/en/library/books/sample/');
    expect(preciseStudyUrl('javascript:alert(1)', 'p3')).toBeNull();
  });

  test('builds exact official Finder URLs for Bible and articles', () => {
    expect(buildOfficialFinderUrl({ pub: 'nwtsty', bible: '1001000', wtLocale: 'E' }))
      .toBe('https://www.jw.org/finder?pub=nwtsty&bible=1001000&wtlocale=E&srcid=share');
    expect(buildOfficialFinderUrl({ pub: 'nwtsty', bible: '1001000', wtLocale: 'u' }))
      .toBe('https://www.jw.org/finder?pub=nwtsty&bible=1001000&wtlocale=U&srcid=share');
    expect(buildOfficialFinderUrl({ pub: 'nwtsty', bible: '1001000', wtLocale: 'K' }))
      .toBe('https://www.jw.org/finder?pub=nwtsty&bible=1001000&wtlocale=K&srcid=share');
    expect(buildOfficialFinderUrl({ docId: '1102021201', wtLocale: 'E' }))
      .toBe('https://www.jw.org/finder?docid=1102021201&wtlocale=E&srcid=share');
    expect(buildOfficialFinderUrl({ docId: '1102021201', wtLocale: 'U' }))
      .toBe('https://www.jw.org/finder?docid=1102021201&wtlocale=U&srcid=share');
    expect(buildOfficialFinderUrl({ docId: '1102021201', wtLocale: 'K' }))
      .toBe('https://www.jw.org/finder?docid=1102021201&wtlocale=K&srcid=share');
    expect(buildOfficialFinderUrl({ pub: 'nwtsty', bible: 'bad', wtLocale: 'E' })).toBeNull();
    expect(buildOfficialFinderUrl({ docId: '123', wtLocale: 'E' })).toBeNull();
    expect(buildOfficialFinderUrl({ docId: '1102021201', wtLocale: '../E' })).toBeNull();
  });

  test('formats page and selected-text citations deterministically', () => {
    const url = 'https://www.jw.org/en/library/books/sample/#p3';
    expect(cleanCitationText('  A\u00a0 line\n with   spaces ')).toBe('A line with spaces');
    expect(formatOnlineCitation({ title: 'Sample', url }))
      .toBe(`Sample. JW.ORG: ${url}`);
    expect(formatOnlineCitation({ title: 'Sample', url, quote: ' Selected text ', reference: 'Paragraph 3' }))
      .toBe(`“Selected text” — Paragraph 3. Sample. JW.ORG: ${url}`);
    expect(formatOnlineCitation({ title: 'Sample', url: 'https://example.com', quote: 'x' })).toBeNull();
    expect(truncateCitationQuote('x'.repeat(501))).toBe(`${'x'.repeat(499)}…`);
  });
});

describe('StudyNav local QR encoding', () => {
  test('renders SVG only for a safe URL', () => {
    const svg = qrSvgForStudyUrl('https://www.jw.org/en/library/books/sample/#p3');
    expect(svg).toStartWith('<svg');
    expect(svg).toContain('<path');
    expect(qrSvgForStudyUrl('https://example.com/')).toBeNull();
  });

  test('round-trips the exact target through independent decoder path', () => {
    const target = 'https://www.jw.org/finder?pub=nwtsty&bible=1001000&wtlocale=U&srcid=share';
    const raw = encodeQR(target, 'raw', { border: 4, ecc: 'medium' });
    const decoded = decodeQR(new Bitmap(raw.length, raw).toImage());
    expect(decoded).toBe(target);
  });
});
