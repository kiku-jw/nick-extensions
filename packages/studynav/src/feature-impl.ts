import type { FeatureFlags } from './features';
import { MOBILE_BUILD } from './build-profile';
import { resolveQuery } from './mnemonics';
import {
  buildOfficialFinderUrl,
  canonicalStudyUrl,
  cleanCitationText,
  formatPageAndTime,
  formatOnlineCitation,
  preciseStudyUrl,
  type OfficialFinderMetadata,
} from './document-actions';
import { qrSvgForStudyUrl } from './qr-code';
import { t } from './i18n';
import { applyContinueWatching, teardownContinueWatching } from './media-progress-runtime';
import {
  applyStudyRuntime,
  isStudyBookmarkSaved,
  openAnnotationEditorForElement,
  teardownStudyRuntime,
  toggleStudyBookmark,
  type StudyBookmarkCandidate,
} from './study-runtime';
import {
  ARTICLE_ROOT_SELECTORS,
  copy,
  currentSupport,
  deepestLinkFor,
  paragraphNodes,
  qs,
  qsa,
  queryWithinRoots,
  type SupportState,
  textForCopy,
  toast,
} from './util';
import {
  base64ToBytes,
  findBibleAudioApiUrl,
  isJwCdnUrl,
  MAX_MEDIA_CLIP_SECONDS,
  MAX_MEDIA_VIDEO_BYTES,
  MAX_MEDIA_VIDEO_CLIP_SECONDS,
  MAX_WAV_BASE64_CHARS,
  parseBibleVerseId,
  parseUserMediaTime,
  type MediaAudioClipRequest,
  type MediaVideoClipRequest,
  type ValidatedMediaVideoClipRequest,
  type VerseAudioRequest,
  validateMediaVideoClipRequest,
} from './verse-audio';

const STYLE_ID = 'studynav-dynamic-style';
const ARTICLE_MARKER = 'data-studynav-article';
const QR_OVERLAY_ID = 'studynav-qr-overlay';
const verseAudioJobs = new Set<string>();
const lastOfficialMediaSources = new WeakMap<HTMLMediaElement, string>();
let verseSelectionListening = false;
let selectedVerseIds: string[] = [];
let verseRangePickAnchorId: string | null = null;
let verseToolbarFrame: number | null = null;
let qrReturnFocus: HTMLElement | null = null;

function positionSelectedVerseToolbar() {
  verseToolbarFrame = null;
  const anchorId = selectedVerseIds.at(-1);
  if (!anchorId) return;
  const verse = document.getElementById(anchorId);
  const toolbar = verse?.querySelector<HTMLElement>(':scope > .studynav-para-tools');
  if (!verse || !toolbar || getComputedStyle(toolbar).display === 'none') return;

  toolbar.dataset.snVerseFloating = '1';
  toolbar.style.position = 'fixed';
  toolbar.style.right = 'auto';
  toolbar.style.zIndex = '2147483641';
  toolbar.style.left = '8px';
  toolbar.style.top = '8px';

  const verseRect = verse.getBoundingClientRect();
  const toolbarRect = toolbar.getBoundingClientRect();
  const gap = 6;
  const edge = 8;
  const maxLeft = Math.max(edge, window.innerWidth - toolbarRect.width - edge);
  const leftDock = verseRect.left - toolbarRect.width - gap;
  const rightDock = verseRect.right + gap;
  const above = verseRect.top - toolbarRect.height - gap;
  const below = verseRect.bottom + gap;
  const maxTop = Math.max(edge, window.innerHeight - toolbarRect.height - edge);
  let left: number;
  let top: number;
  if (leftDock >= edge) {
    left = leftDock;
    top = Math.min(Math.max(verseRect.top, edge), maxTop);
  } else if (rightDock + toolbarRect.width <= window.innerWidth - edge) {
    left = rightDock;
    top = Math.min(Math.max(verseRect.top, edge), maxTop);
  } else {
    left = Math.min(Math.max(verseRect.left, edge), maxLeft);
    top = above >= edge
      ? above
      : Math.min(Math.max(below, edge), maxTop);
  }

  toolbar.style.left = `${Math.round(left)}px`;
  toolbar.style.top = `${Math.round(top)}px`;
}

function scheduleVerseToolbarPosition() {
  if (verseToolbarFrame != null) return;
  verseToolbarFrame = window.requestAnimationFrame(positionSelectedVerseToolbar);
}

function stopVerseToolbarPositioning() {
  if (verseToolbarFrame != null) window.cancelAnimationFrame(verseToolbarFrame);
  verseToolbarFrame = null;
  window.removeEventListener('resize', scheduleVerseToolbarPosition);
  window.removeEventListener('scroll', scheduleVerseToolbarPosition, true);
}

function ensureStyle(css: string) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.documentElement.appendChild(el);
  }
  el.textContent = css;
}

function removeStyle() {
  document.getElementById(STYLE_ID)?.remove();
}

export function cssFor(flags: FeatureFlags, hostname: string): string {
  const bits: string[] = [];
  const isWol = hostname.toLowerCase() === 'wol.jw.org';
  STUDYNAV_DESKTOP_ONLY: if (!MOBILE_BUILD && flags.actionBar && !isWol) {
    bits.push(`
      #regionHeader {
        position: sticky !important; top: 0 !important; z-index: 9990 !important;
        backdrop-filter: saturate(1.2) blur(6px);
      }
    `);
  }
  STUDYNAV_DESKTOP_ONLY: if (!MOBILE_BUILD && flags.expandWidth) {
    bits.push(isWol ? `
      @media (min-width: 980px) {
        [${ARTICLE_MARKER}="1"] {
          width: 100% !important;
          max-width: none !important;
          box-sizing: border-box !important;
          padding-left: 48px !important;
          padding-right: 48px !important;
          margin-left: 0 !important; margin-right: auto !important;
        }
      }
    ` : `
      [${ARTICLE_MARKER}="1"] {
        max-width: min(1100px, 96vw) !important;
        width: 100% !important;
        box-sizing: border-box !important;
        margin-left: auto !important; margin-right: auto !important;
      }
      @media (min-width: 900px) {
        #content.readingPane:has([${ARTICLE_MARKER}="1"]) {
          width: 68% !important;
        }
        #content.readingPane:has([${ARTICLE_MARKER}="1"]) ~ .studyPane {
          width: 32% !important;
        }
      }
    `);
  }
  STUDYNAV_DESKTOP_ONLY: if (!MOBILE_BUILD && flags.cstblView) {
    bits.push(isWol ? `
      [${ARTICLE_MARKER}="1"] table {
        border-collapse: separate !important; border-spacing: 0 !important; width: 100% !important;
      }
      [${ARTICLE_MARKER}="1"] table th,
      [${ARTICLE_MARKER}="1"] table td {
        border: 0 !important; border-bottom: 1px solid rgba(67,102,159,.32) !important;
        padding: 8px 10px !important; text-align: start;
      }
      [${ARTICLE_MARKER}="1"] table tr:nth-child(even) td {
        background: rgba(67,102,159,.07) !important;
      }
    ` : `
      [${ARTICLE_MARKER}="1"] table {
        border-collapse: collapse !important; width: 100% !important;
      }
      [${ARTICLE_MARKER}="1"] table th,
      [${ARTICLE_MARKER}="1"] table td {
        border: 1px solid #8aa !important; padding: 6px 8px !important;
      }
      [${ARTICLE_MARKER}="1"] table tr:nth-child(even) td {
        background: rgba(67,102,159,.08) !important;
      }
    `);
  }
  STUDYNAV_DESKTOP_ONLY: if (!MOBILE_BUILD && flags.mediaPlayerUI) {
    bits.push(`
      .video-js .vjs-control-bar {
        background: transparent !important;
        background-image: none !important;
        box-shadow: none !important;
      }
    `);
  }
  STUDYNAV_DESKTOP_ONLY: if (!MOBILE_BUILD && flags.customSub) {
    bits.push(`
      .vjs-text-track-cue > div, .vjs-text-track-display .vjs-text-track-cue div,
      ::cue {
        font-size: 1.25em !important;
        background: rgba(0,0,0,.65) !important;
        color: #fff !important;
      }
    `);
  }
  if (flags.altText) {
    bits.push(`
      .studynav-alt {
        display:block; margin-top:4px; padding:6px 8px;
        border:1px solid rgba(67,102,159,.38); border-radius:6px;
        max-width:100%; min-width:0; box-sizing:border-box; overflow-wrap:anywhere;
        background: rgba(67,102,159,.1); color: inherit; font-size: 0.92em;
      }
    `);
  }
  return bits.join('\n');
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function removeOwnedNodes(selector: string) {
  qsa<HTMLElement>(selector).forEach((node) => node.remove());
}

function clearOwnedAnchors() {
  qsa<HTMLElement>('[data-sn-owned-anchor="1"]').forEach((el) => {
    el.removeAttribute('id');
    delete el.dataset.snOwnedAnchor;
  });
}

function teardownAltText() {
  removeOwnedNodes('.studynav-alt');
  qsa<HTMLElement>('[data-sn-alt]').forEach((img) => delete img.dataset.snAlt);
}

function teardownCopyAndLinks() {
  stopVerseToolbarPositioning();
  if (verseSelectionListening) {
    window.removeEventListener('click', verseSelectionHandler, true);
    verseSelectionListening = false;
  }
  selectedVerseIds = [];
  verseRangePickAnchorId = null;
  removeOwnedNodes('.studynav-para-tools');
  qsa<HTMLElement>('[data-sn-tools], .studynav-para').forEach((el) => {
    delete el.dataset.snTools;
    el.classList.remove('studynav-para');
  });
  qsa<HTMLElement>('.studynav-verse-selected').forEach((el) => {
    el.classList.remove('studynav-verse-selected');
    el.classList.remove('studynav-verse-toolbar-anchor');
  });
  clearOwnedAnchors();
}

function teardownImgGet() {
  removeOwnedNodes('.studynav-imgdl');
  qsa<HTMLElement>('[data-sn-dl]').forEach((img) => delete img.dataset.snDl);
}

function teardownPalette() {
  document.getElementById('studynav-palette')?.remove();
  window.removeEventListener('keydown', paletteHotkeyHandler, true);
}

function teardownLanguageBadge() {
  document.getElementById('studynav-langcount')?.remove();
}

function teardownMediaToolbar() {
  document.getElementById('studynav-media-bar')?.remove();
  document.getElementById('studynav-clip-panel')?.remove();
  qsa<HTMLElement>('[data-studynav-media-host]').forEach((host) => {
    delete host.dataset.studynavMediaHost;
    delete host.dataset.studynavPositioned;
  });
}

function teardownTranscript() {
  document.getElementById('studynav-transcript')?.remove();
}

function teardownToast() {
  document.getElementById('studynav-toast')?.remove();
}

const qrEscapeHandler = (event: KeyboardEvent) => {
  if (event.key === 'Escape') teardownQrOverlay();
};

function teardownQrOverlay() {
  document.getElementById(QR_OVERLAY_ID)?.remove();
  window.removeEventListener('keydown', qrEscapeHandler, true);
  if (qrReturnFocus?.isConnected) qrReturnFocus.focus();
  qrReturnFocus = null;
}

function clearArticleMarkers() {
  qsa<HTMLElement>(`[${ARTICLE_MARKER}]`).forEach((root) => root.removeAttribute(ARTICLE_MARKER));
}

function markArticleRoots(articleRoots: HTMLElement[]) {
  clearArticleMarkers();
  articleRoots.forEach((root) => root.setAttribute(ARTICLE_MARKER, '1'));
}

function teardownMediaCtrl() {
  window.removeEventListener('keydown', mediaKeyHandler, true);
}

export type FeatureRunPlan = {
  state: 'off' | 'unsupported' | 'active';
  teardownAll: boolean;
  teardown: {
    transcript: boolean;
    altText: boolean;
    copyAndLinks: boolean;
    imgGet: boolean;
    palette: boolean;
    mediaCtrl: boolean;
    languageBadge: boolean;
    mediaToolbar: boolean;
    annotations: boolean;
    continueWatching: boolean;
  };
  styleFlags: FeatureFlags;
};

export function deriveFeaturePlan(flags: FeatureFlags, support: SupportState): FeatureRunPlan {
  if (flags.masterEnabled === false) {
    return {
      state: 'off',
      teardownAll: true,
      teardown: {
        transcript: true,
        altText: true,
        copyAndLinks: true,
        imgGet: true,
        palette: true,
        mediaCtrl: true,
        languageBadge: true,
        mediaToolbar: true,
        annotations: true,
        continueWatching: true,
      },
      styleFlags: { ...flags },
    };
  }

  if (!support.supported) {
    return {
      state: 'unsupported',
      teardownAll: true,
      teardown: {
        transcript: true,
        altText: true,
        copyAndLinks: true,
        imgGet: true,
        palette: true,
        mediaCtrl: true,
        languageBadge: true,
        mediaToolbar: true,
        annotations: true,
        continueWatching: true,
      },
      styleFlags: { ...flags },
    };
  }

  return {
    state: 'active',
    teardownAll: false,
    teardown: {
      transcript: !flags.transcCreate || !support.media,
      altText: !flags.altText || !support.article,
      copyAndLinks: (!flags.copyText && !flags.parLink && !flags.verseAudio && !flags.annotations) || !support.article,
      imgGet: !flags.imgGet || !support.article,
      palette: !flags.advSearch || !support.palette,
      mediaCtrl: !flags.mediaCtrl || !support.media,
      languageBadge: !flags.langCount || !support.language,
      mediaToolbar: !support.media || !(
        flags.mediaTS || flags.mediaClip || flags.sndDisp || flags.transcCreate || flags.continueWatching
      ),
      annotations: !flags.annotations && !flags.bookmarks && !flags.copyText && !flags.parLink,
      continueWatching: !flags.continueWatching || !support.media,
    },
    styleFlags: {
      ...flags,
      actionBar: support.article ? flags.actionBar : false,
      expandWidth: support.article ? flags.expandWidth : false,
      cstblView: support.article ? flags.cstblView : false,
      mediaPlayerUI: support.media ? flags.mediaPlayerUI : false,
      customSub: support.media ? flags.customSub : false,
      altText: support.article ? flags.altText : false,
    },
  };
}

export function teardownFeatures() {
  teardownAltText();
  teardownCopyAndLinks();
  teardownLanguageBadge();
  teardownToast();
  teardownQrOverlay();
  STUDYNAV_DESKTOP_ONLY: if (!MOBILE_BUILD) {
    teardownPalette();
    teardownImgGet();
    teardownMediaToolbar();
    teardownTranscript();
    teardownMediaCtrl();
    teardownContinueWatching();
  }
  teardownStudyRuntime();
  clearArticleMarkers();
  removeStyle();
  document.documentElement.classList.remove('studynav-on');
  delete document.documentElement.dataset.studynav;
}

function canonicalCurrentPageUrl(): string | null {
  const canonical = qs<HTMLLinkElement>('link[rel="canonical"][href]')?.href || null;
  return canonicalStudyUrl(location.href, canonical);
}

type CurrentCitationTarget = {
  element: HTMLElement | null;
  quote: string;
  reference: string;
  fragment: string | null;
};

function selectionElement(selection: Selection, articleRoots: HTMLElement[]): HTMLElement | null {
  if (selection.rangeCount !== 1 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  return paragraphNodes(articleRoots).find((element) =>
    element.contains(range.startContainer) && element.contains(range.endContainer)) || null;
}

function elementFragment(element: HTMLElement | null): string | null {
  if (!element) return null;
  const url = new URL(deepestLinkFor(element));
  if (!url.hash) return null;
  try {
    return decodeURIComponent(url.hash.slice(1));
  } catch {
    return null;
  }
}

function referenceForElement(element: HTMLElement | null): string {
  if (!element) return '';
  const verse = parseBibleVerseId(element.id);
  if (verse) return `${bibleReferenceLabel()} ${verse.chapter}:${verse.verse}`;
  const pid = element.getAttribute('data-pid');
  return pid ? `Paragraph ${pid}` : 'Paragraph';
}

function verseElementsInDocumentOrder(): HTMLElement[] {
  return qsa<HTMLElement>('.verse[id^="v"]').filter((element) => !!parseBibleVerseId(element.id));
}

function verseElementsForIds(ids: readonly string[]): HTMLElement[] {
  const wanted = new Set(ids);
  return verseElementsInDocumentOrder().filter((element) => wanted.has(element.id));
}

function verseElementsFromHash(): HTMLElement[] {
  let hash: string;
  try {
    hash = decodeURIComponent(location.hash.slice(1));
  } catch {
    return [];
  }
  const match = /^(v[1-9]\d?\d{6})(?:-(v[1-9]\d?\d{6}))?$/.exec(hash);
  if (!match) return [];
  const start = parseBibleVerseId(match[1]);
  const end = parseBibleVerseId(match[2] || match[1]);
  if (!start || !end || start.book !== end.book || start.chapter !== end.chapter || end.verse < start.verse) return [];
  return verseElementsInDocumentOrder().filter((element) => {
    const verse = parseBibleVerseId(element.id);
    return !!verse && verse.book === start.book && verse.chapter === start.chapter &&
      verse.verse >= start.verse && verse.verse <= end.verse;
  });
}

export function currentSelectedVerseElements(): HTMLElement[] {
  const explicit = verseElementsForIds(selectedVerseIds);
  return explicit.length ? explicit : verseElementsFromHash();
}

function verseRangeFragment(elements: readonly HTMLElement[]): string | null {
  const first = elements[0];
  const last = elements.at(-1);
  if (!first || !last || !parseBibleVerseId(first.id) || !parseBibleVerseId(last.id)) return null;
  return first.id === last.id ? first.id : `${first.id}-${last.id}`;
}

function verseRangeFinderToken(elements: readonly HTMLElement[]): string | null {
  const fragment = verseRangeFragment(elements);
  return fragment ? fragment.replaceAll('v', '') : null;
}

function verseRangeReference(elements: readonly HTMLElement[]): string {
  const first = elements[0] ? parseBibleVerseId(elements[0].id) : null;
  const last = elements.at(-1) ? parseBibleVerseId(elements.at(-1)!.id) : null;
  if (!first || !last) return '';
  const verses = first.verse === last.verse ? `${first.verse}` : `${first.verse}–${last.verse}`;
  return `${bibleReferenceLabel()} ${first.chapter}:${verses}`;
}

function verseRangeText(elements: readonly HTMLElement[]): string {
  return elements.map((element) => textForCopy(element)).filter(Boolean).join('\n');
}

function preciseLinkForVerseRange(elements: readonly HTMLElement[]): string | null {
  const base = canonicalCurrentPageUrl();
  const fragment = verseRangeFragment(elements);
  return base && fragment ? preciseStudyUrl(base, fragment) : null;
}

function currentCitationTarget(): CurrentCitationTarget {
  const support = currentSupport();
  const selection = window.getSelection();
  const selectedElement = selection ? selectionElement(selection, support.articleRoots) : null;
  if (selection && selectedElement) {
    return {
      element: selectedElement,
      quote: selection.toString(),
      reference: referenceForElement(selectedElement),
      fragment: elementFragment(selectedElement),
    };
  }

  const selectedVerses = currentSelectedVerseElements();
  const selectedVerse = selectedVerses[0];
  if (selectedVerse) {
    return {
      element: selectedVerse,
      quote: verseRangeText(selectedVerses),
      reference: verseRangeReference(selectedVerses),
      fragment: verseRangeFragment(selectedVerses),
    };
  }

  return { element: null, quote: '', reference: '', fragment: null };
}

function pageDocumentTitle(): string {
  const heading = qs<HTMLElement>('#article h1, article h1, main h1, h1');
  return cleanCitationText(heading?.innerText || heading?.textContent || document.title || 'JW.ORG').slice(0, 512) || 'JW.ORG';
}

function pageFinderMetadata(): OfficialFinderMetadata {
  const data = qs<HTMLElement>(
    '.jsGlobalShareData .link[data-wtlocale], [data-wtlocale][data-bible], [data-wtlocale][data-docid], [data-wtlocale][data-pub]',
  );
  const article = qs<HTMLElement>('#article, article');
  const classes = `${document.body?.className || ''} ${article?.className || ''}`;
  const classDocId = /(?:^|\s)docId-(\d{6,16})(?:\s|$)/.exec(classes)?.[1] || null;
  const classLocale = /(?:^|\s)ml-([A-Za-z][A-Za-z0-9-]{0,7})(?:\s|$)/.exec(classes)?.[1] || null;
  const book = article?.getAttribute('data-booknum');
  const chapter = article?.getAttribute('data-chapter');
  const computedBible = /^\d{1,2}$/.test(book || '') && /^\d{1,3}$/.test(chapter || '')
    ? String(Number(book) * 1_000_000 + Number(chapter) * 1_000)
    : null;
  const selectedBible = verseRangeFinderToken(currentSelectedVerseElements());
  return {
    pub: data?.getAttribute('data-pub') || article?.getAttribute('data-bible-pub'),
    bible: selectedBible || data?.getAttribute('data-bible') || computedBible,
    docId: data?.getAttribute('data-docid') || classDocId,
    wtLocale: data?.getAttribute('data-wtlocale') || classLocale,
  };
}

export function currentOfficialFinderUrl(): string | null {
  return buildOfficialFinderUrl(pageFinderMetadata());
}

function currentPreciseStudyUrl(): string | null {
  const base = canonicalCurrentPageUrl();
  if (!base) return null;
  return preciseStudyUrl(base, currentCitationTarget().fragment);
}

export function currentStudyBookmarkCandidate(): StudyBookmarkCandidate | null {
  const support = currentSupport();
  const pageUrl = canonicalCurrentPageUrl();
  const targetUrl = currentPreciseStudyUrl();
  if (!support.supported || !pageUrl || !targetUrl) return null;
  const target = currentCitationTarget();
  const title = pageDocumentTitle();
  return {
    pageUrl,
    targetUrl,
    title,
    reference: cleanCitationText(target.reference || title).slice(0, 512),
  };
}

export async function currentStudyBookmarkSaved(): Promise<boolean> {
  const candidate = currentStudyBookmarkCandidate();
  return candidate ? isStudyBookmarkSaved(candidate.targetUrl) : false;
}

export async function toggleCurrentStudyBookmark(): Promise<{ ok: boolean; message: string; saved: boolean }> {
  const candidate = currentStudyBookmarkCandidate();
  if (!candidate) return { ok: false, message: t('not_available_page'), saved: false };
  return toggleStudyBookmark(candidate);
}

export async function copyCurrentCitation(): Promise<{ ok: boolean; message: string; copiedText?: string }> {
  const support = currentSupport();
  if (!support.supported) return { ok: false, message: t('unavailable_here') };
  const target = currentCitationTarget();
  const url = currentPreciseStudyUrl();
  const citation = url ? formatOnlineCitation({
    quote: target.quote,
    reference: target.reference,
    title: pageDocumentTitle(),
    url,
  }) : null;
  if (!citation) return { ok: false, message: t('citation_unavailable') };
  const copied = await copy(citation, t('citation_copied'));
  return {
    ok: copied,
    message: copied ? t('citation_copied') : t('copy_failed'),
    copiedText: citation,
  };
}

function parseLocalSvg(markup: string): Element | null {
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = parsed.documentElement;
  if (parsed.querySelector('parsererror') ||
      root.localName !== 'svg' ||
      root.namespaceURI !== 'http://www.w3.org/2000/svg') return null;
  return document.importNode(root, true);
}

export function showCurrentQr(): { ok: boolean; message: string } {
  const url = currentPreciseStudyUrl();
  const svg = url ? qrSvgForStudyUrl(url) : null;
  if (!url || !svg) return { ok: false, message: t('qr_unavailable') };
  const qrImage = parseLocalSvg(svg);
  if (!qrImage) return { ok: false, message: t('qr_unavailable') };

  teardownQrOverlay();
  qrReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const overlay = document.createElement('div');
  overlay.id = QR_OVERLAY_ID;
  overlay.className = 'studynav-overlay';
  overlay.setAttribute('data-studynav-owned', '1');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'studynav-qr-title');

  const panel = document.createElement('div');
  panel.className = 'studynav-overlay-panel studynav-qr-panel';
  const head = document.createElement('div');
  head.className = 'studynav-panel-head';
  const title = document.createElement('strong');
  title.id = 'studynav-qr-title';
  title.textContent = t('qr_title');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'studynav-icon-button';
  close.setAttribute('aria-label', t('close_qr_aria'));
  close.textContent = t('close');
  close.addEventListener('click', teardownQrOverlay);
  head.append(title, close);

  const image = document.createElement('div');
  image.className = 'studynav-qr-image';
  qrImage.setAttribute('aria-label', t('qr_image_aria'));
  image.append(qrImage);
  const target = document.createElement('p');
  target.className = 'studynav-target-url';
  target.textContent = url;
  const actions = document.createElement('div');
  actions.className = 'studynav-panel-actions';
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.textContent = t('copy_link');
  copyButton.addEventListener('click', () => void copy(url, t('link_copied')));
  actions.append(copyButton);
  panel.append(head, image, target, actions);
  overlay.append(panel);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) teardownQrOverlay();
  });
  document.documentElement.appendChild(overlay);
  window.addEventListener('keydown', qrEscapeHandler, true);
  close.focus();
  return { ok: true, message: t('qr_opened') };
}

export function openOfficialJwLink(): { ok: boolean; message: string; targetUrl?: string } {
  const url = currentOfficialFinderUrl();
  if (!url) return { ok: false, message: t('not_available_page') };
  if (MOBILE_BUILD) {
    return { ok: false, message: t('action_failed'), targetUrl: url };
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
  // Chromium may intentionally return null when `noopener` is requested even
  // though the new tab was opened. Reaching this branch means the desktop
  // navigation was dispatched; the mobile popup uses targetUrl instead.
  return { ok: true, message: t('official_link_opened'), targetUrl: url };
}

function mountPalette() {
  if (document.getElementById('studynav-palette')) return;
  const wrap = document.createElement('div');
  wrap.id = 'studynav-palette';
  wrap.className = 'studynav-palette hidden';
  wrap.setAttribute('data-studynav-owned', '1');
  wrap.innerHTML = `
    <div class="studynav-palette-panel">
      <input id="studynav-palette-input" aria-label="${escapeHtml(t('palette_title'))}" placeholder="${escapeHtml(t('palette_placeholder'))}" />
      <ul id="studynav-palette-results"></ul>
      <div class="studynav-palette-hint">${escapeHtml(t('palette_hint'))}</div>
    </div>`;
  document.documentElement.appendChild(wrap);
  const input = wrap.querySelector('input') as HTMLInputElement;
  const list = wrap.querySelector('ul') as HTMLUListElement;

  const render = () => {
    const items = resolveQuery(input.value);
    list.innerHTML = items.map((it, i) => `<li data-i="${i}"><strong>${escapeHtml(it.label)}</strong><span>${escapeHtml(it.url)}</span></li>`).join('');
    (list as HTMLUListElement & { _items?: ReturnType<typeof resolveQuery> })._items = items;
  };

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePalette();
    if (e.key === 'Enter') {
      const items = (list as HTMLUListElement & { _items?: ReturnType<typeof resolveQuery> })._items || resolveQuery(input.value);
      if (items[0]) location.href = items[0].url;
    }
  });
  list.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest('li');
    if (!li) return;
    const items = (list as HTMLUListElement & { _items?: ReturnType<typeof resolveQuery> })._items || [];
    const it = items[Number(li.getAttribute('data-i'))];
    if (it) location.href = it.url;
  });
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) closePalette();
  });
}

const paletteHotkeyHandler = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
  }
};

export function openPalette(): boolean {
  const support = currentSupport();
  if (!support.palette) return false;
  mountPalette();
  const wrap = document.getElementById('studynav-palette');
  const input = document.getElementById('studynav-palette-input') as HTMLInputElement | null;
  if (!wrap || !input) return false;
  wrap.classList.remove('hidden');
  input.value = '';
  input.focus();
  input.dispatchEvent(new Event('input'));
  return true;
}

function closePalette() {
  document.getElementById('studynav-palette')?.classList.add('hidden');
}

function isSubstantiveArticleImage(img: HTMLImageElement): boolean {
  if (img.closest('[data-studynav-owned]')) return false;
  const rect = img.getBoundingClientRect();
  const width = rect.width || img.width || img.naturalWidth;
  const height = rect.height || img.height || img.naturalHeight;
  const compactContainer = img.closest(
    'li, [class*="card" i], [class*="teaser" i], [class*="result" i], [class*="thumbnail" i]',
  );
  if (compactContainer && (!width || width < 280)) return false;
  if (img.closest('a[href]') && !img.closest('figure') && (!width || width < 320)) return false;
  if (img.closest('figure')) return !width || width >= 220;
  return width >= 260 && height >= 120;
}

function imageHelperAnchor(img: HTMLImageElement): Element {
  return img.closest('figure') || img;
}

function runAltText(articleRoots: HTMLElement[]) {
  const images = queryWithinRoots<HTMLImageElement>(['img', 'figure img'], articleRoots)
    .filter(isSubstantiveArticleImage);
  images.forEach((img) => {
    if (img.dataset.snAlt) return;
    const alt = img.getAttribute('alt') || '';
    const cap = img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '';
    const text = [alt, cap].filter(Boolean).join(' - ');
    if (!text) return;
    img.dataset.snAlt = '1';
    const div = document.createElement('div');
    div.className = 'studynav-alt';
    div.textContent = text;
    div.setAttribute('data-studynav-owned', '1');
    imageHelperAnchor(img).insertAdjacentElement('afterend', div);
  });
}

function bibleReferenceLabel(): string {
  const heading = qs<HTMLElement>('h1');
  const text = (heading?.innerText || heading?.textContent || document.title || 'Bible')
    .replace(/\s+\d+:\d+.*$/u, '')
    .trim();
  return text || 'Bible';
}

function chapterAudioUrl(): string {
  const media = qsa<HTMLAudioElement | HTMLSourceElement>('audio[src], audio source[src]');
  for (const node of media) {
    const value = node instanceof HTMLAudioElement ? (node.currentSrc || node.src) : node.getAttribute('src') || '';
    if (/^https:\/\/[^/]*\.?jw-cdn\.org\//i.test(value)) return value;
  }
  return '';
}

function embeddedBibleAudioApiUrls(): string[] {
  const urls = qsa<HTMLElement>('[data-bible_audio_data_api], [data-jsonurl]')
    .flatMap((node) => [
      node.getAttribute('data-bible_audio_data_api'),
      node.getAttribute('data-jsonurl'),
    ])
    .filter((value): value is string => !!value);
  return [...new Set(urls)];
}

function syncVerseSelectionPresentation() {
  const selected = new Set(selectedVerseIds);
  const anchor = selectedVerseIds.at(-1) || null;
  const firstSelected = selectedVerseIds[0] ? parseBibleVerseId(selectedVerseIds[0]) : null;
  const lastSelected = anchor ? parseBibleVerseId(anchor) : null;
  qsa<HTMLElement>('.verse[id^="v"]').forEach((element) => {
    const isSelected = selected.has(element.id);
    element.classList.toggle('studynav-verse-selected', isSelected);
    element.classList.toggle('studynav-verse-toolbar-anchor', isSelected && element.id === anchor);
    const toolbar = element.querySelector<HTMLElement>(':scope > .studynav-para-tools');
    if (toolbar && element.id !== anchor) {
      delete toolbar.dataset.snVerseFloating;
      toolbar.removeAttribute('style');
    }
    toolbar?.querySelectorAll<HTMLElement>('[data-single-verse-only="1"]').forEach((control) => {
      control.hidden = selectedVerseIds.length > 1;
    });
    const audioButton = toolbar?.querySelector<HTMLButtonElement>('.studynav-verse-audio');
    if (audioButton) {
      const isRangeAnchor = selectedVerseIds.length > 1 && element.id === anchor && firstSelected && lastSelected;
      audioButton.textContent = isRangeAnchor
        ? t('download_range_audio', [String(firstSelected.verse), String(lastSelected.verse)])
        : t('download_audio');
      audioButton.title = isRangeAnchor
        ? t('download_range_audio_title', [String(firstSelected.verse), String(lastSelected.verse)])
        : t('download_audio_title');
    }
    const rangeButton = toolbar?.querySelector<HTMLButtonElement>('.studynav-verse-range-control');
    if (rangeButton) {
      const isPicking = verseRangePickAnchorId === element.id;
      rangeButton.textContent = selectedVerseIds.length > 1
        ? t('clear_verse_selection')
        : isPicking ? t('cancel_range_selection') : t('select_several_verses');
      rangeButton.title = selectedVerseIds.length > 1
        ? t('clear_verse_selection_title')
        : isPicking ? t('cancel_range_selection_title') : t('select_several_verses_title');
      rangeButton.setAttribute('aria-pressed', String(isPicking));
    }
  });
  if (selectedVerseIds.length) scheduleVerseToolbarPosition();
  else stopVerseToolbarPositioning();
}

const verseSelectionHandler = (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const number = target.closest('.verse .jsHighlightOnly, .verse .verseNum a, .verse .chapterNum a');
  const verse = number?.closest<HTMLElement>('.verse[id^="v"]');
  const clicked = verse ? parseBibleVerseId(verse.id) : null;
  if (!verse || !clicked) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const rangeAnchorId = verseRangePickAnchorId || selectedVerseIds[0] || null;
  const anchorElement = rangeAnchorId ? document.getElementById(rangeAnchorId) : null;
  const anchor = anchorElement ? parseBibleVerseId(anchorElement.id) : null;
  if ((event.shiftKey || verseRangePickAnchorId) && anchor && anchor.book === clicked.book && anchor.chapter === clicked.chapter) {
    const low = Math.min(anchor.verse, clicked.verse);
    const high = Math.max(anchor.verse, clicked.verse);
    selectedVerseIds = verseElementsInDocumentOrder()
      .filter((candidate) => {
        const current = parseBibleVerseId(candidate.id);
        return !!current && current.book === clicked.book && current.chapter === clicked.chapter &&
          current.verse >= low && current.verse <= high;
      })
      .map((candidate) => candidate.id);
    verseRangePickAnchorId = null;
    toast(t('verse_range_selected', [String(low), String(high)]));
  } else if (selectedVerseIds.length === 1 && selectedVerseIds[0] === verse.id) {
    selectedVerseIds = [];
    verseRangePickAnchorId = null;
  } else {
    selectedVerseIds = [verse.id];
    verseRangePickAnchorId = null;
  }
  syncVerseSelectionPresentation();
};

function syncVerseSelectionListener(enabled: boolean) {
  if (enabled === verseSelectionListening) return;
  verseSelectionListening = enabled;
  if (enabled) {
    window.addEventListener('click', verseSelectionHandler, true);
    window.addEventListener('resize', scheduleVerseToolbarPosition);
    window.addEventListener('scroll', scheduleVerseToolbarPosition, true);
  }
  else {
    window.removeEventListener('click', verseSelectionHandler, true);
    stopVerseToolbarPositioning();
    selectedVerseIds = [];
    verseRangePickAnchorId = null;
    qsa<HTMLElement>('.studynav-verse-selected').forEach((el) => {
      el.classList.remove('studynav-verse-selected');
      el.classList.remove('studynav-verse-toolbar-anchor');
    });
  }
}

async function downloadVerseAudio(verseElements: readonly HTMLElement[], button: HTMLButtonElement) {
  const verses = verseElements
    .map((element) => ({ element, verse: parseBibleVerseId(element.id) }))
    .filter((item): item is { element: HTMLElement; verse: NonNullable<ReturnType<typeof parseBibleVerseId>> } => !!item.verse);
  const first = verses[0];
  const last = verses.at(-1);
  if (!first || !last) return;
  const verseIds = verses.map(({ element }) => element.id);
  const jobId = verseIds.join(':');
  if (verseAudioJobs.has(jobId)) return;

  const resources = [
    ...performance.getEntriesByType('resource').map((entry) => entry.name),
    ...embeddedBibleAudioApiUrls(),
  ];
  const apiUrl = findBibleAudioApiUrl(resources, first.element.id, chapterAudioUrl());
  if (!apiUrl) {
    toast(t('chapter_audio_not_ready'));
    return;
  }

  verseAudioJobs.add(jobId);
  button.disabled = true;
  button.dataset.state = 'preparing';
  button.dataset.preparingLabel = t('preparing');
  button.setAttribute('aria-busy', 'true');
  try {
    const request: VerseAudioRequest = {
      type: 'DOWNLOAD_VERSE_AUDIO',
      verseIds,
      apiUrl,
      label: bibleReferenceLabel(),
    };
    const response: unknown = await chrome.runtime.sendMessage(request);
    if (
      !response ||
      typeof response !== 'object' ||
      !('ok' in response) ||
      response.ok !== true ||
      !('base64' in response) ||
      typeof response.base64 !== 'string' ||
      !('filename' in response) ||
      typeof response.filename !== 'string' ||
      response.base64.length > MAX_WAV_BASE64_CHARS
    ) {
      const error = response && typeof response === 'object' && 'error' in response && typeof response.error === 'string'
        ? response.error
        : t('verse_audio_prepare_failed');
      throw new Error(error);
    }

    const bytes = base64ToBytes(response.base64);
    const wavBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(wavBuffer).set(bytes);
    const url = URL.createObjectURL(new Blob([wavBuffer], { type: 'audio/wav' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = response.filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    const verseLabel = first.verse.verse === last.verse.verse
      ? String(first.verse.verse)
      : `${first.verse.verse}–${last.verse.verse}`;
    toast(t('verse_audio_downloaded', [String(first.verse.chapter), verseLabel]));
  } catch (error) {
    toast(error instanceof Error ? error.message : t('verse_audio_download_failed'));
  } finally {
    verseAudioJobs.delete(jobId);
    if (button.isConnected) {
      button.disabled = false;
      delete button.dataset.state;
      delete button.dataset.preparingLabel;
      button.removeAttribute('aria-busy');
    }
  }
}

function runCopyAndLinks(articleRoots: HTMLElement[], flags: FeatureFlags) {
  const hasBibleVerses = articleRoots.some((root) => !!root.querySelector('.verse[id^="v"]'));
  syncVerseSelectionListener(hasBibleVerses && !!(
    (!MOBILE_BUILD && flags.verseAudio) || flags.copyText || flags.parLink || flags.annotations
  ));
  paragraphNodes(articleRoots).forEach((el) => {
    const existing = el.querySelector(':scope > .studynav-para-tools');
    if (existing) existing.remove();
    el.dataset.snTools = '1';
    el.classList.add('studynav-para');
    const bar = document.createElement('span');
    bar.className = 'studynav-para-tools';
    bar.setAttribute('data-studynav-owned', '1');
    bar.setAttribute('aria-label', t('study_tools_aria'));

    STUDYNAV_DESKTOP_ONLY: if (!MOBILE_BUILD && flags.verseAudio && parseBibleVerseId(el.id)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'studynav-verse-audio';
      button.textContent = t('download_audio');
      button.title = t('download_audio_title');
      button.dataset.verseAudio = el.id;
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const selected = currentSelectedVerseElements();
        void downloadVerseAudio(selected.length > 1 && selected.includes(el) ? selected : [el], button);
      });
      bar.appendChild(button);
    }

    if (((!MOBILE_BUILD && flags.verseAudio) || flags.copyText || flags.parLink) && parseBibleVerseId(el.id)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'studynav-verse-range-control';
      button.textContent = t('select_several_verses');
      button.title = t('select_several_verses_title');
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectedVerseIds.length > 1) {
          selectedVerseIds = [];
          verseRangePickAnchorId = null;
          toast(t('verse_selection_cleared'));
        } else if (verseRangePickAnchorId === el.id) {
          verseRangePickAnchorId = null;
          toast(t('range_selection_cancelled'));
        } else {
          selectedVerseIds = [el.id];
          verseRangePickAnchorId = el.id;
          toast(t('select_range_last_verse'));
        }
        syncVerseSelectionPresentation();
      });
      bar.appendChild(button);
    }

    if (flags.annotations) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = t('mark');
      button.title = t('mark_title');
      if (parseBibleVerseId(el.id)) button.dataset.singleVerseOnly = '1';
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openAnnotationEditorForElement(el);
      });
      bar.appendChild(button);
    }

    if (flags.copyText) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = t('copy');
      button.title = t('copy_text_title');
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const selected = currentSelectedVerseElements();
        copy(selected.length > 1 && selected.includes(el) ? verseRangeText(selected) : textForCopy(el));
      });
      bar.appendChild(button);
    }

    if (flags.parLink) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = t('link');
      button.title = t('copy_paragraph_link_title');
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const selected = currentSelectedVerseElements();
        const rangeLink = selected.length > 1 && selected.includes(el) ? preciseLinkForVerseRange(selected) : null;
        copy(rangeLink || deepestLinkFor(el), t('link_copied'));
      });
      bar.appendChild(button);
    }

    if (bar.childElementCount) el.appendChild(bar);
    else bar.remove();
  });
  syncVerseSelectionPresentation();
}

function runLangCount(articleRoots: HTMLElement[]) {
  teardownLanguageBadge();

  // The live jw.org chooser is mounted outside the article root. Prefer the
  // largest page-level language select, including its stable public id, before
  // falling back to article-local lists and text.
  const knownSelects = qsa<HTMLSelectElement>(
    'select#otherAvailLangsChooser, #otherAvailLangs select',
  ).sort((left, right) => right.options.length - left.options.length);
  let anchor: HTMLElement | null = knownSelects[0] || null;
  let count = anchor instanceof HTMLSelectElement ? anchor.options.length : 0;
  let besideControl = count > 0;
  if (!count) {
    const fallbackSelects = qsa<HTMLSelectElement>(
      'select[name*="lang" i], select[id*="lang" i]',
    ).sort((left, right) => right.options.length - left.options.length);
    anchor = fallbackSelects[0] || null;
    count = anchor instanceof HTMLSelectElement ? anchor.options.length : 0;
    besideControl = count > 0;
  }

  const containers = articleRoots.length
    ? uniqueElementsForLang([
        ...articleRoots,
        ...articleRoots
          .map((root) => root.closest('main, #content'))
          .filter((root): root is HTMLElement => !!root),
      ])
    : queryWithinRoots<HTMLElement>(ARTICLE_ROOT_SELECTORS, [document]);
  for (const root of containers) {
    if (count) break;
    const langSelect = qs<HTMLSelectElement>('select[name*="lang" i], select[id*="lang" i]', root);
    if (langSelect?.options.length) {
      count = langSelect.options.length;
      anchor = langSelect;
      besideControl = true;
      break;
    }
    const items = qsa<HTMLElement>('[class*="language"] li, [class*="LanguageList"] li, .mosaicLanguageList li, .languagePicker li', root);
    if (items.length) {
      count = items.length;
      anchor = items[0].closest<HTMLElement>('[class*="language"], [class*="Language"]') || root;
      break;
    }
    const candidates = qsa<HTMLElement>('a[href*="/languages/"], [data-language], [class*="language"] option, .languagePicker option', root);
    if (candidates.length > 5) {
      count = candidates.length;
      anchor = candidates[0].closest<HTMLElement>('[class*="language"], [class*="Language"]') || root;
      break;
    }
    const textAnchor = qsa<HTMLElement>('p, li, [class*="language"], [class*="Language"]', root)
      .find((node) => /available in\s+\d+\s+languages/i.test(node.innerText || '')) || root;
    const match = (textAnchor.innerText || '').match(/available in\s+(\d+)\s+languages/i);
    if (match) {
      count = Number(match[1]);
      anchor = textAnchor;
      break;
    }
  }

  if (!count || !anchor) return;
  const label = t('languages_count', String(count));
  const badge = document.createElement('span');
  badge.id = 'studynav-langcount';
  badge.className = 'studynav-langcount';
  badge.dataset.placement = besideControl ? 'control' : 'content';
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '9');
  const meridians = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  meridians.setAttribute('d', 'M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18');
  icon.append(circle, meridians);
  const text = document.createElement('span');
  text.textContent = besideControl ? String(count) : label;
  badge.append(icon, text);
  badge.title = label;
  badge.setAttribute('aria-label', label);
  badge.setAttribute('data-studynav-owned', '1');
  if (anchor instanceof HTMLSelectElement) anchor.insertAdjacentElement('afterend', badge);
  else if (articleRoots.includes(anchor)) anchor.insertBefore(badge, anchor.firstChild);
  else anchor.insertAdjacentElement('afterend', badge);
}

function uniqueElementsForLang<T extends Element>(nodes: T[]): T[] {
  const seen = new Set<T>();
  for (const node of nodes) seen.add(node);
  return [...seen];
}

function runImgGet(articleRoots: HTMLElement[]) {
  const images = queryWithinRoots<HTMLImageElement>(['img', 'figure img'], articleRoots)
    .filter(isSubstantiveArticleImage);
  images.forEach((img) => {
    const anchor = imageHelperAnchor(img);
    const next = anchor.nextElementSibling;
    if (next?.classList.contains('studynav-imgdl')) next.remove();
    img.dataset.snDl = '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'studynav-imgdl';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" />
      </svg><span>${escapeHtml(t('download_image'))}</span>`;
    btn.setAttribute('aria-label', t('download_image'));
    btn.title = t('download_image');
    btn.setAttribute('data-studynav-owned', '1');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const src = img.currentSrc || img.src;
      if (!src) return;
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Image request failed with ${res.status}`);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (src.split('/').pop() || 'image.jpg').split('?')[0];
        a.click();
        URL.revokeObjectURL(a.href);
        toast(t('image_download_started'));
      } catch {
        const opened = window.open(src, '_blank', 'noopener,noreferrer');
        if (opened) opened.opener = null;
      }
    });
    anchor.insertAdjacentElement('afterend', btn);
  });
}

function activeVideo(): HTMLVideoElement | null {
  const vids = qsa<HTMLVideoElement>('video').filter((video) => !video.closest('[data-studynav-owned]'));
  return vids.find((v) => !v.paused) || vids[0] || null;
}

function activePlayableMedia(): HTMLMediaElement | null {
  const media = qsa<HTMLMediaElement>('video, audio')
    .filter((item) => !item.closest('[data-studynav-owned]'));
  const focused = document.activeElement;
  if (focused instanceof HTMLMediaElement && media.includes(focused)) return focused;
  return media.find((item) => !item.paused) || media.find((item) => item instanceof HTMLVideoElement) || media[0] || null;
}

const mediaKeyHandler = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const v = activePlayableMedia();
  if (!v) return;
  const k = e.key.toLowerCase();
  const handled = k === ' ' || e.code === 'Space' || ['k', 'j', 'l', 'm', 'f'].includes(k);
  if (!handled || (e.repeat && (k === ' ' || e.code === 'Space' || k === 'k'))) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (k === ' ' || k === 'k') {
    if (v.paused) {
      void v.play().catch(() => {
        // Playback can be interrupted by another key press or browser policy.
        // The keyboard shortcut must not leak that expected rejection globally.
      });
    } else {
      v.pause();
    }
  } else if (k === 'j') {
    v.currentTime = Math.max(0, v.currentTime - 10);
  } else if (k === 'l') {
    v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 10);
  } else if (k === 'm') {
    v.muted = !v.muted;
  } else if (k === 'f') {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void v.requestFullscreen?.().catch(() => {});
    }
  }
};

function transcriptDomText(): string {
  return qsa<HTMLElement>('[class*="transcript"], [id*="transcript"], [class*="subtitle"]')
    .filter((node) => !node.closest('[data-studynav-owned]'))
    .map((node) => (node.innerText || '').trim())
    .filter((line) => line.length > 40)
    .join('\n\n');
}

export function officialMediaSourceFromCandidates(candidates: readonly unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const source = candidate.trim();
    if (source && isJwCdnUrl(source)) return source;
  }
  return null;
}

export function onlyOfficialMediaSourceFromCandidates(candidates: readonly unknown[]): string | null {
  const sources = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const source = candidate.trim();
    if (source && isJwCdnUrl(source)) sources.add(source);
  }
  return sources.size === 1 ? sources.values().next().value || null : null;
}

function recentOfficialMediaResource(media: HTMLMediaElement): string {
  const expected = media instanceof HTMLVideoElement
    ? /\.(?:mp4|m4v|webm)(?:$|[?#])/i
    : /\.(?:mp3|m4a|aac|wav)(?:$|[?#])/i;
  const candidates = performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => expected.test(name));
  // A page can preload several publications. Refuse an ambiguous fallback
  // instead of transferring or clipping the wrong official media file.
  return onlyOfficialMediaSourceFromCandidates(candidates) || '';
}

function mediaSource(media: HTMLMediaElement | null): string | null {
  if (!media) return null;
  const childSources = Array.from(media.querySelectorAll<HTMLSourceElement>('source[src]'));
  const source = officialMediaSourceFromCandidates([
    media.currentSrc,
    media.getAttribute('src'),
    media.src,
    ...childSources.flatMap((child) => [child.getAttribute('src'), child.src]),
    lastOfficialMediaSources.get(media),
    recentOfficialMediaResource(media),
  ]);
  if (source) lastOfficialMediaSources.set(media, source);
  return source;
}

function openSecondDisplay() {
  const sourceMedia = activePlayableMedia();
  const source = mediaSource(sourceMedia);
  if (!sourceMedia || !source) {
    toast(t('clip_source_unavailable'));
    return;
  }
  const wasPlaying = !sourceMedia.paused && !sourceMedia.ended;
  const startTime = Number.isFinite(sourceMedia.currentTime) ? sourceMedia.currentTime : 0;
  const playbackState = {
    muted: sourceMedia.muted,
    volume: sourceMedia.volume,
    playbackRate: sourceMedia.playbackRate,
  };
  const tag = sourceMedia instanceof HTMLAudioElement ? 'audio' : 'video';
  const popupUrl = URL.createObjectURL(new Blob([`<!doctype html>
    <html lang="${escapeHtml(document.documentElement.lang || 'en')}">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(pageDocumentTitle())}</title>
        <style>
          :root { color-scheme: dark; background: #080b10; }
          * { box-sizing: border-box; }
          body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #080b10; }
          video { width: 100vw; height: 100vh; object-fit: contain; background: #000; }
          audio { width: min(760px, calc(100vw - 40px)); }
          output { position: fixed; left: 50%; bottom: 18px; translate: -50% 0; max-width: calc(100vw - 32px);
            padding: 8px 12px; border-radius: 8px; background: rgba(18,26,39,.94); color: #eef3fb;
            font: 13px/1.35 system-ui,sans-serif; text-align: center; }
        </style>
      </head>
      <body>
        <${tag} id="studynav-second-player" controls ${wasPlaying ? 'autoplay' : ''} preload="auto" src="${escapeHtml(source)}"></${tag}>
        <output id="studynav-second-status" hidden></output>
      </body>
    </html>`], { type: 'text/html' }));
  const popup = window.open(popupUrl, 'studynav-second', 'popup=yes,width=960,height=540');
  if (!popup) {
    URL.revokeObjectURL(popupUrl);
    toast(t('second_display_blocked'));
    return;
  }
  sourceMedia.pause();
  popup.addEventListener('load', () => {
    URL.revokeObjectURL(popupUrl);
    const playerNode = popup.document.getElementById('studynav-second-player');
    const statusNode = popup.document.getElementById('studynav-second-status');
    if (!playerNode || !['AUDIO', 'VIDEO'].includes(playerNode.tagName) || statusNode?.tagName !== 'OUTPUT') {
      popup.opener = null;
      return;
    }
    // The popup has its own DOM realm, so opener-realm instanceof checks are
    // false. The parser-created tag names are the stable boundary here.
    const player = playerNode as HTMLMediaElement;
    const status = statusNode as HTMLOutputElement;
    player.muted = playbackState.muted;
    player.volume = playbackState.volume;
    player.playbackRate = playbackState.playbackRate;
    let resumed = false;
    const resume = async () => {
      if (resumed) return;
      resumed = true;
      player.currentTime = Math.min(startTime, Number.isFinite(player.duration) ? player.duration : startTime);
      popup.opener = null;
      if (!wasPlaying) return;
      try {
        await player.play();
      } catch {
        status.textContent = t('second_display_press_play');
        status.hidden = false;
      }
    };
    player.addEventListener('loadedmetadata', () => void resume(), { once: true });
    player.addEventListener('error', () => { popup.opener = null; }, { once: true });
    if (player.readyState >= HTMLMediaElement.HAVE_METADATA) void resume();
    player.focus();
  }, { once: true });
  window.setTimeout(() => {
    URL.revokeObjectURL(popupUrl);
    if (!popup.closed) popup.opener = null;
  }, 10_000);
}

function formatClipInput(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3_600);
  const minutes = Math.floor((whole % 3_600) / 60);
  const rest = whole % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}

function waitForClipMediaEvent(media: HTMLMediaElement, eventName: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(t('clip_video_load_failed')));
    }, timeoutMs);
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(t('clip_video_load_failed')));
    };
    const cleanup = () => {
      clearTimeout(timer);
      media.removeEventListener(eventName, onReady);
      media.removeEventListener('error', onError);
    };
    media.addEventListener(eventName, onReady, { once: true });
    media.addEventListener('error', onError, { once: true });
  });
}

async function recordVideoClip(request: ValidatedMediaVideoClipRequest): Promise<void> {
  if (!('MediaRecorder' in window) || !('captureStream' in HTMLMediaElement.prototype)) {
    throw new Error(t('clip_video_unsupported'));
  }
  const probe = await fetch(request.mediaUrl, {
    cache: 'no-store',
    credentials: 'omit',
    headers: { Range: 'bytes=0-0' },
  });
  if (!probe.ok) throw new Error(t('clip_source_download_failed'));
  if (!isJwCdnUrl(probe.url)) throw new Error(t('chapter_audio_redirected'));
  await probe.body?.cancel();

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'metadata';
  video.playsInline = true;
  video.muted = false;
  video.src = request.mediaUrl;
  video.setAttribute('data-studynav-owned', '1');
  Object.assign(video.style, {
    position: 'fixed',
    left: '0',
    bottom: '0',
    width: '2px',
    height: '2px',
    opacity: '0.01',
    pointerEvents: 'none',
    zIndex: '-1',
  });
  document.documentElement.appendChild(video);

  let audioContext: AudioContext | null = null;
  let stream: MediaStream | null = null;
  try {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) await waitForClipMediaEvent(video, 'loadedmetadata', 45_000);
    if (!Number.isFinite(video.duration) || request.endSeconds > video.duration + 0.25) {
      throw new Error(t('clip_outside_media'));
    }
    video.currentTime = request.startSeconds;
    if (video.seeking || Math.abs(video.currentTime - request.startSeconds) > 0.1) {
      await waitForClipMediaEvent(video, 'seeked', 30_000);
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForClipMediaEvent(video, 'loadeddata', 30_000);
    }

    audioContext = new AudioContext();
    const sourceNode = audioContext.createMediaElementSource(video);
    const audioDestination = audioContext.createMediaStreamDestination();
    const silentOutput = audioContext.createGain();
    silentOutput.gain.value = 0;
    sourceNode.connect(audioDestination);
    sourceNode.connect(silentOutput);
    silentOutput.connect(audioContext.destination);
    await audioContext.resume();

    const captured = (video as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
    const videoTrack = captured.getVideoTracks()[0];
    if (!videoTrack) throw new Error(t('clip_video_unsupported'));
    stream = new MediaStream([videoTrack, ...audioDestination.stream.getAudioTracks()]);
    const mimeType = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) throw new Error(t('clip_video_unsupported'));

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 1_600_000,
      audioBitsPerSecond: 128_000,
    });
    const chunks: Blob[] = [];
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener('stop', () => resolve(), { once: true });
      recorder.addEventListener('error', () => reject(new Error(t('clip_video_recorder_failed'))), { once: true });
    });
    recorder.start(250);
    await video.play();
    await new Promise<void>((resolve, reject) => {
      const deadline = window.setTimeout(() => {
        clearInterval(poll);
        reject(new Error(t('clip_video_timeout')));
      }, Math.ceil((request.endSeconds - request.startSeconds) * 1_000) + 10_000);
      const check = () => {
        if (video.currentTime >= request.endSeconds - 0.03 || video.ended) {
          clearTimeout(deadline);
          clearInterval(poll);
          resolve();
        }
      };
      const poll = window.setInterval(check, 50);
      check();
    });
    video.pause();
    recorder.stop();
    await stopped;

    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size <= 0 || blob.size > MAX_MEDIA_VIDEO_BYTES) throw new Error(t('clip_video_too_large'));
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = request.filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
    stream?.getTracks().forEach((track) => track.stop());
    if (audioContext) await audioContext.close();
  }
}

function downloadMediaResponse(response: unknown, fallbackMessage: string): boolean {
  if (
    !response ||
    typeof response !== 'object' ||
    !('ok' in response) ||
    response.ok !== true ||
    !('base64' in response) ||
    typeof response.base64 !== 'string' ||
    !('filename' in response) ||
    typeof response.filename !== 'string' ||
    response.base64.length > MAX_WAV_BASE64_CHARS
  ) {
    const error = response && typeof response === 'object' && 'error' in response && typeof response.error === 'string'
      ? response.error
      : fallbackMessage;
    throw new Error(error);
  }
  const mime = 'mime' in response && (response.mime === 'audio/wav' || response.mime === 'video/webm')
    ? response.mime
    : 'audio/wav';
  const bytes = base64ToBytes(response.base64);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = response.filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return true;
}

function openMediaClipPanel() {
  document.getElementById('studynav-clip-panel')?.remove();
  const media = activePlayableMedia();
  if (!media || !mediaSource(media)) {
    toast(t('clip_source_unavailable'));
    return;
  }

  const startAt = Number.isFinite(media.currentTime) ? media.currentTime : 0;
  const duration = Number.isFinite(media.duration) ? media.duration : startAt + 30;
  const endAt = Math.min(duration, startAt + 30);
  const panel = document.createElement('form');
  panel.id = 'studynav-clip-panel';
  panel.className = 'studynav-clip-panel';
  panel.setAttribute('data-studynav-owned', '1');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t('media_clip_title'));

  const title = document.createElement('strong');
  title.textContent = t('media_clip_title');
  const fields = document.createElement('div');
  fields.className = 'studynav-clip-fields';
  const formatLabel = document.createElement('label');
  formatLabel.textContent = t('clip_format');
  const format = document.createElement('select');
  const audioOption = document.createElement('option');
  audioOption.value = 'audio';
  audioOption.textContent = t('clip_format_audio');
  format.appendChild(audioOption);
  if (media instanceof HTMLVideoElement) {
    const videoOption = document.createElement('option');
    videoOption.value = 'video';
    videoOption.textContent = t('clip_format_video');
    format.appendChild(videoOption);
  }
  formatLabel.appendChild(format);
  fields.appendChild(formatLabel);
  const createField = (labelText: string, value: string) => {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = value;
    label.appendChild(input);
    fields.appendChild(label);
    return input;
  };
  const start = createField(t('clip_start'), formatClipInput(startAt));
  const end = createField(t('clip_end'), formatClipInput(endAt));
  const error = document.createElement('p');
  error.className = 'studynav-clip-error';
  error.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div');
  actions.className = 'studynav-clip-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = t('clip_cancel');
  cancel.addEventListener('click', () => panel.remove());
  const download = document.createElement('button');
  download.type = 'submit';
  const updateDownloadLabel = () => {
    download.textContent = format.value === 'video' ? t('clip_download_video') : t('clip_download_audio');
  };
  format.addEventListener('change', updateDownloadLabel);
  updateDownloadLabel();
  actions.append(cancel, download);
  panel.append(title, fields, error, actions);
  panel.addEventListener('submit', async (event) => {
    event.preventDefault();
    const startSeconds = parseUserMediaTime(start.value);
    const endSeconds = parseUserMediaTime(end.value);
    if (startSeconds === null || endSeconds === null || endSeconds <= startSeconds) {
      error.textContent = t('clip_invalid_time');
      return;
    }
    const isVideoClip = format.value === 'video';
    const maxSeconds = isVideoClip ? MAX_MEDIA_VIDEO_CLIP_SECONDS : MAX_MEDIA_CLIP_SECONDS;
    if (endSeconds - startSeconds > maxSeconds) {
      error.textContent = isVideoClip ? t('clip_video_too_long') : t('clip_too_long');
      return;
    }
    const source = mediaSource(media);
    if (!source) {
      error.textContent = t('clip_source_unavailable');
      return;
    }
    const request: MediaAudioClipRequest | MediaVideoClipRequest = isVideoClip
      ? {
          type: 'DOWNLOAD_MEDIA_VIDEO_CLIP',
          mediaUrl: source,
          startSeconds,
          endSeconds,
          label: pageDocumentTitle(),
        }
      : {
          type: 'DOWNLOAD_MEDIA_AUDIO_CLIP',
          mediaUrl: source,
          startSeconds,
          endSeconds,
          label: pageDocumentTitle(),
    };
    download.disabled = true;
    cancel.disabled = true;
    panel.setAttribute('aria-busy', 'true');
    download.textContent = isVideoClip ? t('clip_recording') : t('clip_preparing');
    try {
      if (request.type === 'DOWNLOAD_MEDIA_VIDEO_CLIP') {
        const validated = validateMediaVideoClipRequest(request, window.location.href);
        if (!validated) throw new Error(t('clip_request_rejected'));
        await recordVideoClip(validated);
      } else {
        const response: unknown = await chrome.runtime.sendMessage(request);
        downloadMediaResponse(response, t('clip_failed'));
      }
      toast(t('clip_downloaded'));
      panel.remove();
    } catch (caught) {
      error.textContent = caught instanceof Error ? caught.message : t('clip_failed');
    } finally {
      if (download.isConnected) {
        download.disabled = false;
        cancel.disabled = false;
        panel.removeAttribute('aria-busy');
        updateDownloadLabel();
      }
    }
  });
  document.documentElement.appendChild(panel);
  start.focus();
  start.select();
}

function syncToolbarButton(
  actions: HTMLElement,
  id: string,
  enabled: boolean,
  label: string,
  action: () => void,
) {
  let button = actions.querySelector<HTMLButtonElement>(`#${id}`);
  if (!enabled) {
    button?.remove();
    return;
  }
  if (!button) {
    button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = 'studynav-media-action';
  }
  button.textContent = label;
  button.onclick = () => {
    const details = button?.closest('details');
    if (details instanceof HTMLDetailsElement) details.open = false;
    action();
  };
  actions.appendChild(button);
}

function mountMediaToolbar(flags: FeatureFlags, mediaSupported: boolean): HTMLElement | null {
  const anyEnabled = flags.mediaTS || flags.mediaClip || flags.sndDisp || flags.transcCreate || flags.continueWatching;
  if (!mediaSupported || !anyEnabled) {
    teardownMediaToolbar();
    return null;
  }

  const media = activePlayableMedia();
  const isVideo = media instanceof HTMLVideoElement;
  const playerHost = isVideo ? media.closest<HTMLElement>(
    '.video-js, .jwplayer, [class*="mediaPlayer"], [class*="MediaPlayer"]',
  ) : null;
  const audioShell = !isVideo
    ? media?.closest<HTMLElement>('.mejs-container, [role="application"][aria-label*="audio" i]') || null
    : null;
  const wolArticleAnchor = !isVideo && location.hostname === 'wol.jw.org'
    ? qs<HTMLElement>('#article > .scalableui, #article, article > .scalableui, article')
    : null;
  const parent = playerHost || wolArticleAnchor || audioShell?.parentElement || media?.parentElement || null;
  if (!media || !parent) {
    teardownMediaToolbar();
    return null;
  }

  let bar = document.getElementById('studynav-media-bar');
  const placement = playerHost ? 'player' : 'inline';
  const kind = isVideo ? 'video' : 'audio';
  if (bar && (
    bar.parentElement !== parent ||
    bar.dataset.placement !== placement ||
    bar.dataset.kind !== kind
  )) {
    teardownMediaToolbar();
    bar = null;
  }
  if (!bar) {
    const toolsLabel = t(isVideo ? 'video_tools' : 'audio_tools');
    const summaryLabel = t(isVideo ? 'media_summary_video' : 'media_summary_audio');
    bar = document.createElement('div');
    bar.id = 'studynav-media-bar';
    bar.className = 'studynav-media-bar';
    bar.dataset.placement = placement;
    bar.dataset.kind = kind;
    bar.setAttribute('data-studynav-owned', '1');
    bar.innerHTML = `
      <details>
        <summary title="${escapeHtml(toolsLabel)}">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6"/></svg>
          <span>${escapeHtml(summaryLabel)}</span><span class="studynav-sr-only"> · ${escapeHtml(toolsLabel)}</span>
        </summary>
        <div class="studynav-media-menu">
          <strong>${escapeHtml(toolsLabel)}</strong>
          <div class="studynav-media-actions"></div>
        </div>
      </details>`;
    bar.onkeydown = (event) => {
      if (event.key !== 'Escape') return;
      const details = bar?.querySelector('details');
      if (!(details instanceof HTMLDetailsElement) || !details.open) return;
      event.preventDefault();
      details.open = false;
      bar?.querySelector<HTMLElement>('summary')?.focus();
    };
    if (playerHost) {
      playerHost.dataset.studynavMediaHost = '1';
      if (getComputedStyle(playerHost).position === 'static') playerHost.dataset.studynavPositioned = '1';
      playerHost.appendChild(bar);
    } else if (wolArticleAnchor) {
      wolArticleAnchor.prepend(bar);
    } else {
      (audioShell || media).insertAdjacentElement('afterend', bar);
    }
  }

  const actions = bar.querySelector<HTMLElement>('.studynav-media-actions');
  if (!actions) {
    teardownMediaToolbar();
    return null;
  }
  syncToolbarButton(actions, 'studynav-copy-page-time', !!flags.mediaTS, t(isVideo ? 'copy_video_time' : 'copy_audio_time'), () => {
    const activeMedia = activePlayableMedia();
    const url = canonicalCurrentPageUrl();
    const value = url ? formatPageAndTime(url, activeMedia?.currentTime || 0) : null;
    if (value) void copy(value, t(isVideo ? 'video_time_copied' : 'audio_time_copied'));
  });
  syncToolbarButton(actions, 'studynav-media-clip', !!flags.mediaClip, t('media_clip'), openMediaClipPanel);
  syncToolbarButton(actions, 'studynav-second-display', !!flags.sndDisp, t('second_display'), openSecondDisplay);
  syncToolbarButton(
    actions,
    'studynav-transcript-button',
    !!flags.transcCreate && isVideo,
    t('transcript'),
    () => void openTranscript(),
  );
  return actions;
}

export async function readTranscriptFromTracks(
  video: Pick<HTMLVideoElement, 'textTracks'> | null,
  waitForCuesMs = 0,
): Promise<string> {
  if (!video) return '';
  const tracks = Array.from(video.textTracks || []);
  for (const track of tracks) {
    const priorMode = track.mode;
    try {
      track.mode = 'hidden';
      const deadline = Date.now() + Math.max(0, waitForCuesMs);
      while ((!track.cues || !track.cues.length) && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      }
      const cues = track.cues;
      if (!cues || !cues.length) continue;
      const lines: string[] = [];
      for (let i = 0; i < cues.length; i++) {
        const cue = cues[i] as TextTrackCue & { text?: string };
        lines.push(String(cue.text ?? ''));
      }
      const text = lines.join('\n').trim();
      if (text) return text;
    } catch {
      /* ignore */
    } finally {
      try {
        track.mode = priorMode;
      } catch {
        /* ignore */
      }
    }
  }
  return '';
}

async function openTranscript() {
  let panel = document.getElementById('studynav-transcript');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'studynav-transcript';
    panel.className = 'studynav-transcript';
    panel.setAttribute('data-studynav-owned', '1');
    panel.innerHTML = `
      <div class="head"><strong>${escapeHtml(t('transcript'))}</strong>
        <input id="studynav-tr-q" aria-label="${escapeHtml(t('transcript_search'))}" placeholder="${escapeHtml(t('transcript_search'))}" />
        <button type="button" id="studynav-tr-dl">${escapeHtml(t('transcript_download'))}</button>
        <button type="button" id="studynav-tr-x" aria-label="${escapeHtml(t('close_transcript_aria'))}">✕</button>
      </div>
      <pre id="studynav-tr-body">${escapeHtml(t('loading'))}</pre>`;
    document.documentElement.appendChild(panel);
    panel.querySelector('#studynav-tr-x')!.addEventListener('click', () => panel!.classList.add('hidden'));
    panel.querySelector('#studynav-tr-dl')!.addEventListener('click', () => {
      const text = (panel!.querySelector('#studynav-tr-body') as HTMLElement).innerText;
      const blob = new Blob([text], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'transcript.txt';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    panel.querySelector('#studynav-tr-q')!.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value.toLowerCase();
      const body = panel!.querySelector('#studynav-tr-body') as HTMLElement;
      const full = body.dataset.full || body.innerText;
      if (!q) {
        body.textContent = full;
        return;
      }
      body.textContent = full.split(/\n/).filter((line) => line.toLowerCase().includes(q)).join('\n') || t('no_matches');
    });
  }

  panel.classList.remove('hidden');
  const body = panel.querySelector('#studynav-tr-body') as HTMLElement;

  let text = transcriptDomText();
  if (!text) text = await readTranscriptFromTracks(activeVideo(), 2_400);
  if (!text) text = t('no_transcript_detected');

  body.dataset.full = text;
  body.textContent = text;
}

export function applyFeatures(flags: FeatureFlags) {
  try {
    const support = currentSupport();
    const plan = deriveFeaturePlan(flags, support);

    if (plan.teardownAll) {
      teardownFeatures();
      document.documentElement.dataset.studynav = plan.state === 'off' ? 'off' : 'unsupported';
      return;
    }

    if (!flags.qrShare) teardownQrOverlay();

    if (plan.teardown.languageBadge) teardownLanguageBadge();
    if (plan.teardown.altText) teardownAltText();
    if (plan.teardown.copyAndLinks) teardownCopyAndLinks();
    if (plan.teardown.annotations) teardownStudyRuntime();
    STUDYNAV_DESKTOP_ONLY: if (!MOBILE_BUILD) {
      if (plan.teardown.mediaToolbar) teardownMediaToolbar();
      if (plan.teardown.transcript) teardownTranscript();
      if (plan.teardown.imgGet) teardownImgGet();
      if (plan.teardown.palette) teardownPalette();
      if (plan.teardown.mediaCtrl) teardownMediaCtrl();
      if (plan.teardown.continueWatching) teardownContinueWatching();
    }

    markArticleRoots(support.article ? support.articleRoots : []);

    const css = cssFor(plan.styleFlags, location.hostname);
    if (css) ensureStyle(css);
    else removeStyle();

    document.documentElement.classList.add('studynav-on');
    document.documentElement.dataset.studynav = '1';

    if (flags.annotations || flags.bookmarks || flags.copyText || flags.parLink) {
      applyStudyRuntime(support.article ? support.articleRoots : [], {
        annotations: flags.annotations,
        bookmarks: flags.bookmarks,
        copyText: flags.copyText,
        parLink: flags.parLink,
      });
    }

    if (flags.altText && support.article) runAltText(support.articleRoots);
    if (!flags.parLink) clearOwnedAnchors();
    if ((flags.copyText || flags.parLink || (!MOBILE_BUILD && flags.verseAudio) || flags.annotations) && support.article) {
      runCopyAndLinks(support.articleRoots, flags);
    }
    if (flags.langCount && support.language) runLangCount(support.articleRoots);
    STUDYNAV_DESKTOP_ONLY: if (!MOBILE_BUILD) {
      if (flags.advSearch && support.palette) {
        mountPalette();
        window.addEventListener('keydown', paletteHotkeyHandler, true);
      }
      if (flags.imgGet && support.article) runImgGet(support.articleRoots);
      if (flags.mediaCtrl && support.media) window.addEventListener('keydown', mediaKeyHandler, true);
      const mediaToolbar = mountMediaToolbar(flags, support.media);
      if (flags.continueWatching && support.media) {
        applyContinueWatching(
          qsa<HTMLVideoElement>('video').filter((video) => !video.closest('[data-studynav-owned]')),
          mediaToolbar,
        );
      }
    }
  } catch (e) {
    console.warn('StudyNav feature error', e);
  }
}
