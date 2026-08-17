import { copyToClipboard } from '@nick/shared';
import { t } from './i18n';
import { isAllowedStudyNavHostname } from './page-origin';

export function qs<T extends Element = Element>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector(sel) as T | null;
}

export function qsa<T extends Element = Element>(sel: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll(sel)) as T[];
}

export function toast(msg: string) {
  let el = document.getElementById('studynav-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'studynav-toast';
    el.className = 'studynav-toast';
    el.setAttribute('data-studynav-owned', '1');
    document.documentElement.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout((el as HTMLElement & { _t?: number })._t);
  (el as HTMLElement & { _t?: number })._t = window.setTimeout(() => el!.classList.remove('show'), 1600);
}

export async function copy(text: string, ok = t('copied')) {
  const fine = await copyToClipboard(text);
  toast(fine ? ok : t('copy_failed'));
  return fine;
}

export function host(): string {
  return location.hostname;
}

export function onReady(fn: () => void) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

const LOCALE_PATH_RE = /^\/([a-z]{2}(?:-[a-z]+)?)(\/|$)/i;
const JW_LIBRARY_PATH_RE = /^\/[a-z]{2}(?:-[a-z]+)?\/(?:library|biblioteka|biblioteca|bibliothek|bibliotheque|bibliotek|finder)(?:\/|$)/i;
const JW_CYRILLIC_LIBRARY_PATH_RE = /^\/(?:ru\/библиотека|uk\/бібліотека)(?:\/|$)/iu;
const JW_SEARCH_PATH_RE = /^\/[a-z]{2}(?:-[a-z]+)?\/search(?:\/|$)/i;
const JW_NON_ARTICLE_PATH_RE = /^\/[a-z]{2}(?:-[a-z]+)?\/(?:search|choose-language|login)(?:\/|$)/i;
const WOL_PATH_RE = /^\/[a-z]{2}(?:-[a-z]+)?\/wol(?:\/|$)/i;

function isJwLibraryPath(pathname: string): boolean {
  if (JW_LIBRARY_PATH_RE.test(pathname)) return true;
  try {
    return JW_CYRILLIC_LIBRARY_PATH_RE.test(decodeURIComponent(pathname).normalize('NFC'));
  } catch {
    return false;
  }
}

export const ARTICLE_ROOT_SELECTORS = [
  '#article',
  '#content',
  'article',
  '.bodyTxt',
  '.syn-body',
  '.document',
  '.docClass-text',
  '.scalableui',
  '.jwac',
] as const;

export const MEDIA_SURFACE_SELECTORS = [
  'video',
  'audio',
  '.video-js',
  '.jwplayer',
  '[class*="mediaPlayer"]',
  '[class*="MediaPlayer"]',
] as const;

export type SupportProbe = {
  hostname: string;
  pathname: string;
  articleRootCount: number;
  mediaRootCount: number;
  pageNotFound?: boolean;
};

export type SupportState = {
  supported: boolean;
  palette: boolean;
  article: boolean;
  language: boolean;
  media: boolean;
};

export function localeFromPath(pathname: string): string {
  const m = pathname.match(LOCALE_PATH_RE);
  return (m?.[1] || 'en').toLowerCase();
}

export function uniqueElements<T extends Element>(items: Iterable<T>): T[] {
  const seen = new Set<T>();
  for (const item of items) seen.add(item);
  return [...seen];
}

export function queryWithinRoots<T extends Element>(selectors: readonly string[], roots: ParentNode[]): T[] {
  if (!roots.length) return [];
  const out: T[] = [];
  const seen = new Set<T>();
  for (const root of roots) {
    for (const selector of selectors) {
      for (const el of qsa<T>(selector, root)) {
        if (seen.has(el)) continue;
        seen.add(el);
        out.push(el);
      }
    }
  }
  return out;
}

const ROOT_TAGS = new Set(['ARTICLE', 'MAIN', 'SECTION', 'DIV']);
const PARAGRAPH_TAGS = new Set(['P']);
const VERSE_TAGS = new Set(['P', 'DIV', 'SPAN', 'LI']);

function classTokens(input: string | null | undefined): Set<string> {
  return new Set(String(input || '').split(/\s+/).map((part) => part.trim()).filter(Boolean));
}

export type ArticleRootShape = {
  tagName: string;
  id?: string | null;
  className?: string | null;
  dataPidDescendants?: number;
};

export function articleRootPriority(shape: ArticleRootShape): number {
  const tagName = String(shape.tagName || '').toUpperCase();
  const id = String(shape.id || '');
  const tokens = classTokens(shape.className);
  const dataPidDescendants = Number(shape.dataPidDescendants || 0);

  if (tokens.has('PageNotFound')) return 0;
  if (id === 'article') return 100;
  if (tagName === 'ARTICLE') return 95;
  if (tokens.has('bodyTxt') || tokens.has('syn-body') || tokens.has('document') || tokens.has('docClass-text') || tokens.has('scalableui')) {
    return 90;
  }
  if (id === 'content' && dataPidDescendants > 0) return 70;
  if (tokens.has('jwac') && dataPidDescendants > 0) return 60;
  return 0;
}

export function isEligibleArticleRootShape(shape: ArticleRootShape): boolean {
  return ROOT_TAGS.has(String(shape.tagName || '').toUpperCase()) && articleRootPriority(shape) > 0;
}

export function articleRoots(root: ParentNode = document): HTMLElement[] {
  const ranked = queryWithinRoots<HTMLElement>(ARTICLE_ROOT_SELECTORS, [root])
    .map((el) => ({
      el,
      priority: articleRootPriority({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        dataPidDescendants: el.querySelectorAll('[data-pid]').length,
      }),
    }))
    .filter((entry) => entry.priority > 0);
  const topPriority = Math.max(0, ...ranked.map((entry) => entry.priority));
  return ranked.filter((entry) => entry.priority === topPriority).map((entry) => entry.el);
}

export function mediaSurfaceNodes(root: ParentNode = document): HTMLElement[] {
  return uniqueElements(queryWithinRoots<HTMLElement>(MEDIA_SURFACE_SELECTORS, [root]));
}

export function detectSupport(probe: SupportProbe): SupportState {
  if (probe.pageNotFound) {
    return {
      supported: false,
      palette: false,
      article: false,
      language: false,
      media: false,
    };
  }

  const hostname = probe.hostname.toLowerCase();
  const pathname = probe.pathname;
  const isWol = hostname === 'wol.jw.org';
  const isJw = isAllowedStudyNavHostname(hostname) && !isWol;
  const isLibrary = isJwLibraryPath(pathname);
  const decodedSegments = (() => {
    try {
      return decodeURIComponent(pathname).split('/').filter(Boolean);
    } catch {
      return pathname.split('/').filter(Boolean);
    }
  })();
  const isJwArticlePath = isJw && decodedSegments.length >= 3 && !JW_NON_ARTICLE_PATH_RE.test(pathname);

  const palette = Boolean(
    (isJw && (isLibrary || JW_SEARCH_PATH_RE.test(pathname))) ||
    (isWol && WOL_PATH_RE.test(pathname)),
  );
  const article = Boolean(
    probe.articleRootCount > 0 &&
    ((isJw && (isLibrary || isJwArticlePath)) || (isWol && WOL_PATH_RE.test(pathname))),
  );
  const language = article && isJw;
  const media = Boolean(
    probe.mediaRootCount > 0 &&
    ((isJw && (isLibrary || isJwArticlePath)) || (isWol && WOL_PATH_RE.test(pathname))),
  );

  return {
    supported: palette || article || media,
    palette,
    article,
    language,
    media,
  };
}

export function currentSupport(root: ParentNode = document): SupportState & {
  articleRoots: HTMLElement[];
  mediaNodes: HTMLElement[];
} {
  const roots = articleRoots(root);
  const mediaNodes = mediaSurfaceNodes(root);
  const state = detectSupport({
    hostname: location.hostname,
    pathname: location.pathname,
    articleRootCount: roots.length,
    mediaRootCount: mediaNodes.length,
    pageNotFound: !!root.querySelector('.PageNotFound'),
  });
  return { ...state, articleRoots: roots, mediaNodes };
}

function candidateParagraphRoots(roots: ParentNode[]): ParentNode[] {
  if (!roots.length) return [];
  return [...new Set<ParentNode>(roots)];
}

export type ParagraphShape = {
  tagName: string;
  className?: string | null;
  hasDataPid?: boolean;
  hasDataVerse?: boolean;
};

export function isEligibleParagraphShape(shape: ParagraphShape): boolean {
  const tagName = String(shape.tagName || '').toUpperCase();
  const tokens = classTokens(shape.className);
  const hasDataVerse = !!shape.hasDataVerse;
  const hasVerseClass = tokens.has('verse');

  if (hasDataVerse || hasVerseClass) return VERSE_TAGS.has(tagName);
  if (shape.hasDataPid) return PARAGRAPH_TAGS.has(tagName);
  return PARAGRAPH_TAGS.has(tagName);
}

/** Find article-like paragraph / verse nodes used on supported jw.org / WOL pages. */
export function paragraphNodes(roots: ParentNode[]): HTMLElement[] {
  const sels = [
    'p[data-pid]',
    '[data-verse]',
    '.verse',
    '[class~="verse"]',
    'p[id^="p"]',
  ] as const;
  const seen = new Set<HTMLElement>();
  for (const root of candidateParagraphRoots(roots)) {
    for (const sel of sels) {
      for (const el of qsa<HTMLElement>(sel, root)) {
        if (seen.has(el)) continue;
        if (!isEligibleParagraphShape({
          tagName: el.tagName,
          className: el.className,
          hasDataPid: el.hasAttribute('data-pid'),
          hasDataVerse: el.hasAttribute('data-verse'),
        })) continue;
        const text = normalizeStudyNavText(el.innerText || el.textContent || '');
        if (text.length < 2) continue;
        if (el.closest('.studynav-para-tools, .studynav-palette, [data-studynav-owned], script, style, nav, header')) continue;
        seen.add(el);
      }
    }
  }
  return [...seen];
}

export function normalizeStudyNavText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function textForCopy(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll([
    '[data-studynav-owned]',
    '[class^="studynav-"]',
    '[class*=" studynav-"]',
    '[id^="studynav-"]',
    '.verseNum',
    '.chapterNum',
    'a.xrefLink',
    'a.footnoteLink',
    'a[href="#xref"]',
    'a[href="#footnote"]',
  ].join(',')).forEach((node) => {
    node.remove();
  });
  return normalizeStudyNavText(clone.innerText || clone.textContent || '');
}

function sanitizeAnchorPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function buildOwnedAnchorId(dataPid?: string | null, dataVerse?: string | null): string | null {
  const pid = sanitizeAnchorPart(dataPid || '');
  if (pid) return `studynav-pid-${pid}`;
  const verse = sanitizeAnchorPart(dataVerse || '');
  if (verse) return `studynav-verse-${verse}`;
  return null;
}

function ensureAnchorId(el: HTMLElement): string | null {
  if (el.id) return el.id;
  const ancestor = el.parentElement?.closest<HTMLElement>('[id]');
  if (ancestor && !articleRoots(document).includes(ancestor)) return ancestor.id;

  const base = buildOwnedAnchorId(el.getAttribute('data-pid'), el.getAttribute('data-verse'));
  if (!base) return null;

  let next = base;
  let index = 2;
  while (true) {
    const existing = document.getElementById(next);
    if (!existing || existing === el) break;
    next = `${base}-${index++}`;
  }
  el.id = next;
  el.dataset.snOwnedAnchor = '1';
  return next;
}

export function deepestLinkFor(el: HTMLElement): string {
  const id = ensureAnchorId(el);
  if (!id) return location.href;
  const u = new URL(location.href);
  u.hash = id;
  return u.toString();
}
