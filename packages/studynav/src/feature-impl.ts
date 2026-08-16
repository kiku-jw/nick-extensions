import type { FeatureFlags } from './features';
import { resolveQuery } from './mnemonics';
import {
  buildOfficialFinderUrl,
  canonicalStudyUrl,
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
  parseBibleVerseId,
  type VerseAudioRequest,
} from './verse-audio';

const STYLE_ID = 'studynav-dynamic-style';
const ARTICLE_MARKER = 'data-studynav-article';
const QR_OVERLAY_ID = 'studynav-qr-overlay';
const verseAudioJobs = new Set<string>();
let verseSelectionListening = false;
let selectedVerseId: string | null = null;
let verseToolbarFrame: number | null = null;
let qrReturnFocus: HTMLElement | null = null;

function positionSelectedVerseToolbar() {
  verseToolbarFrame = null;
  if (!selectedVerseId) return;
  const verse = document.getElementById(selectedVerseId);
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
  const left = Math.min(Math.max(verseRect.left, edge), maxLeft);
  const above = verseRect.top - toolbarRect.height - gap;
  const below = verseRect.bottom + gap;
  const maxTop = Math.max(edge, window.innerHeight - toolbarRect.height - edge);
  const top = above >= edge
    ? above
    : Math.min(Math.max(below, edge), maxTop);

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
  if (flags.actionBar && !isWol) {
    bits.push(`
      #regionHeader {
        position: sticky !important; top: 0 !important; z-index: 9990 !important;
        backdrop-filter: saturate(1.2) blur(6px);
      }
    `);
  }
  if (flags.expandWidth && !isWol) {
    bits.push(`
      [${ARTICLE_MARKER}="1"] {
        max-width: min(1100px, 96vw) !important;
        width: 100% !important;
        box-sizing: border-box !important;
        margin-left: auto !important; margin-right: auto !important;
      }
    `);
  }
  if (flags.cstblView && !isWol) {
    bits.push(`
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
  if (flags.mediaPlayerUI) {
    bits.push(`
      .vjs-control-bar, .video-js .vjs-control-bar, [class*="player"] [class*="controls"],
      .jwplayer .jw-controls, [class*="mediaPlayer"] [class*="control"] {
        opacity: 0.35 !important; transition: opacity .2s;
      }
      .vjs-control-bar:hover, .video-js:hover .vjs-control-bar,
      [class*="player"]:hover [class*="controls"],
      .jwplayer:hover .jw-controls { opacity: 1 !important; }
    `);
  }
  if (flags.customSub) {
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
  selectedVerseId = null;
  removeOwnedNodes('.studynav-para-tools');
  qsa<HTMLElement>('[data-sn-tools], .studynav-para').forEach((el) => {
    delete el.dataset.snTools;
    el.classList.remove('studynav-para');
  });
  qsa<HTMLElement>('.studynav-verse-selected').forEach((el) => {
    el.classList.remove('studynav-verse-selected');
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
      mediaToolbar: true,
      annotations: !flags.annotations && !flags.bookmarks,
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
  teardownPalette();
  teardownAltText();
  teardownCopyAndLinks();
  teardownImgGet();
  teardownLanguageBadge();
  teardownMediaToolbar();
  teardownTranscript();
  teardownToast();
  teardownQrOverlay();
  teardownMediaCtrl();
  teardownContinueWatching();
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

  const selectedVerse = qs<HTMLElement>('.verse.studynav-verse-selected[id^="v"], .verse.jwac-textHighlight[id^="v"]');
  if (selectedVerse && parseBibleVerseId(selectedVerse.id)) {
    return {
      element: selectedVerse,
      quote: textForCopy(selectedVerse),
      reference: referenceForElement(selectedVerse),
      fragment: elementFragment(selectedVerse),
    };
  }

  return { element: null, quote: '', reference: '', fragment: null };
}

function pageDocumentTitle(): string {
  const heading = qs<HTMLElement>('#article h1, article h1, main h1, h1');
  return (heading?.innerText || heading?.textContent || document.title || 'JW.ORG').trim();
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
  return {
    pub: data?.getAttribute('data-pub') || article?.getAttribute('data-bible-pub'),
    bible: data?.getAttribute('data-bible') || computedBible,
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
    reference: target.reference || title,
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
    ...(copied ? { copiedText: citation } : {}),
  };
}

export function showCurrentQr(): { ok: boolean; message: string } {
  const url = currentPreciseStudyUrl();
  const svg = url ? qrSvgForStudyUrl(url) : null;
  if (!url || !svg) return { ok: false, message: t('qr_unavailable') };

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
  image.innerHTML = svg;
  image.querySelector('svg')?.setAttribute('aria-label', t('qr_image_aria'));
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

export function openOfficialJwLink(): { ok: boolean; message: string } {
  const url = currentOfficialFinderUrl();
  if (!url) return { ok: false, message: t('not_available_page') };
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
  return { ok: true, message: t('official_link_opened') };
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

function runAltText(articleRoots: HTMLElement[]) {
  const images = queryWithinRoots<HTMLImageElement>(['img', 'figure img'], articleRoots);
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
    img.insertAdjacentElement('afterend', div);
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

const verseSelectionHandler = (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const number = target.closest('.verse .jsHighlightOnly, .verse .verseNum a, .verse .chapterNum a');
  const verse = number?.closest<HTMLElement>('.verse[id^="v"]');
  if (!verse || !parseBibleVerseId(verse.id)) return;
  if (selectedVerseId === verse.id) {
    selectedVerseId = null;
    verse.classList.remove('studynav-verse-selected');
    stopVerseToolbarPositioning();
    return;
  }
  selectedVerseId = verse.id;
  qsa<HTMLElement>('.studynav-verse-selected').forEach((selected) => {
    selected.classList.toggle('studynav-verse-selected', selected === verse);
  });
  verse.classList.add('studynav-verse-selected');
  scheduleVerseToolbarPosition();
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
    selectedVerseId = null;
    qsa<HTMLElement>('.studynav-verse-selected').forEach((el) => {
      el.classList.remove('studynav-verse-selected');
    });
  }
}

async function downloadVerseAudio(verseElement: HTMLElement, button: HTMLButtonElement) {
  const verse = parseBibleVerseId(verseElement.id);
  if (!verse || verseAudioJobs.has(verseElement.id)) return;

  const resources = [
    ...performance.getEntriesByType('resource').map((entry) => entry.name),
    ...embeddedBibleAudioApiUrls(),
  ];
  const apiUrl = findBibleAudioApiUrl(resources, verseElement.id, chapterAudioUrl());
  if (!apiUrl) {
    toast(t('chapter_audio_not_ready'));
    return;
  }

  verseAudioJobs.add(verseElement.id);
  button.disabled = true;
  button.dataset.state = 'preparing';
  button.dataset.preparingLabel = t('preparing');
  button.setAttribute('aria-busy', 'true');
  try {
    const request: VerseAudioRequest = {
      type: 'DOWNLOAD_VERSE_AUDIO',
      verseId: verseElement.id,
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
      response.base64.length > 34 * 1024 * 1024
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
    toast(t('verse_audio_downloaded', [String(verse.chapter), String(verse.verse)]));
  } catch (error) {
    toast(error instanceof Error ? error.message : t('verse_audio_download_failed'));
  } finally {
    verseAudioJobs.delete(verseElement.id);
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
  syncVerseSelectionListener(!!flags.verseAudio && hasBibleVerses);
  paragraphNodes(articleRoots).forEach((el) => {
    const existing = el.querySelector(':scope > .studynav-para-tools');
    if (existing) existing.remove();
    el.dataset.snTools = '1';
    el.classList.add('studynav-para');
    if (parseBibleVerseId(el.id)) {
      el.classList.toggle('studynav-verse-selected', el.id === selectedVerseId);
    }

    const bar = document.createElement('span');
    bar.className = 'studynav-para-tools';
    bar.setAttribute('data-studynav-owned', '1');
    bar.setAttribute('aria-label', t('study_tools_aria'));

    if (flags.verseAudio && parseBibleVerseId(el.id)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'studynav-verse-audio';
      button.textContent = t('download_audio');
      button.title = t('download_audio_title');
      button.dataset.verseAudio = el.id;
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void downloadVerseAudio(el, button);
      });
      bar.appendChild(button);
    }

    if (flags.annotations) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = t('mark');
      button.title = t('mark_title');
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
        copy(textForCopy(el));
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
        copy(deepestLinkFor(el), t('link_copied'));
      });
      bar.appendChild(button);
    }

    if (bar.childElementCount) el.appendChild(bar);
    else bar.remove();
  });
  scheduleVerseToolbarPosition();
}

function runLangCount(articleRoots: HTMLElement[]) {
  teardownLanguageBadge();

  // The live jw.org chooser is mounted outside the article root. Prefer the
  // largest page-level language select, including its stable public id, before
  // falling back to article-local lists and text.
  const knownSelectCounts = qsa<HTMLSelectElement>(
    'select#otherAvailLangsChooser, #otherAvailLangs select',
  ).map((select) => select.options.length);
  let count = Math.max(0, ...knownSelectCounts);
  if (!count) {
    const fallbackSelectCounts = qsa<HTMLSelectElement>(
      'select[name*="lang" i], select[id*="lang" i]',
    ).map((select) => select.options.length);
    count = Math.max(0, ...fallbackSelectCounts);
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
      break;
    }
    const items = qsa<HTMLElement>('[class*="language"] li, [class*="LanguageList"] li, .mosaicLanguageList li, .languagePicker li', root);
    if (items.length) {
      count = items.length;
      break;
    }
    const candidates = qsa<HTMLElement>('a[href*="/languages/"], [data-language], [class*="language"] option, .languagePicker option', root);
    if (candidates.length > 5) {
      count = candidates.length;
      break;
    }
    const bodyText = (root as HTMLElement).innerText || '';
    const match = bodyText.match(/available in\s+(\d+)\s+languages/i);
    if (match) {
      count = Number(match[1]);
      break;
    }
  }

  if (!count) return;
  const badge = document.createElement('div');
  badge.id = 'studynav-langcount';
  badge.className = 'studynav-langcount';
  badge.textContent = t('languages_count', String(count));
  badge.setAttribute('data-studynav-owned', '1');
  document.documentElement.appendChild(badge);
}

function uniqueElementsForLang<T extends Element>(nodes: T[]): T[] {
  const seen = new Set<T>();
  for (const node of nodes) seen.add(node);
  return [...seen];
}

function runImgGet(articleRoots: HTMLElement[]) {
  const images = queryWithinRoots<HTMLImageElement>(['img', 'figure img'], articleRoots);
  images.forEach((img) => {
    const next = img.nextElementSibling;
    if (next?.classList.contains('studynav-imgdl')) next.remove();
    img.dataset.snDl = '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'studynav-imgdl';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" />
      </svg>`;
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
        window.open(src, '_blank');
      }
    });
    img.insertAdjacentElement('afterend', btn);
  });
}

function activeVideo(): HTMLVideoElement | null {
  const vids = qsa<HTMLVideoElement>('video');
  return vids.find((v) => !v.paused) || vids[0] || null;
}

const mediaKeyHandler = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  const v = activeVideo();
  if (!v) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'k') {
    e.preventDefault();
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

function mountMediaToolbar(flags: FeatureFlags, mediaSupported: boolean): HTMLElement | null {
  teardownMediaToolbar();
  if (!mediaSupported || (!flags.mediaTS && !flags.sndDisp && !flags.transcCreate && !flags.continueWatching)) return null;

  const bar = document.createElement('div');
  bar.id = 'studynav-media-bar';
  bar.className = 'studynav-media-bar';
  bar.setAttribute('data-studynav-owned', '1');

  if (flags.mediaTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = t('copy_time_url');
    button.onclick = () => {
      const vid = activeVideo();
      const u = new URL(location.href);
      if (vid) u.searchParams.set('t', String(Math.floor(vid.currentTime)));
      copy(u.toString(), t('timestamp_url_copied'));
    };
    bar.appendChild(button);
  }

  if (flags.sndDisp) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = t('second_display');
    button.onclick = () => {
      const vid = activeVideo();
      const url = vid?.currentSrc || vid?.src || location.href;
      window.open(url, 'studynav-second', 'popup=yes,width=960,height=540');
    };
    bar.appendChild(button);
  }

  if (flags.transcCreate) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = t('transcript');
    button.onclick = () => void openTranscript();
    bar.appendChild(button);
  }

  document.documentElement.appendChild(bar);
  return bar;
}

export async function readTranscriptFromTracks(video: Pick<HTMLVideoElement, 'textTracks'> | null): Promise<string> {
  if (!video) return '';
  const tracks = Array.from(video.textTracks || []);
  for (const track of tracks) {
    const priorMode = track.mode;
    try {
      track.mode = 'hidden';
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

  let text = qsa<HTMLElement>('[class*="transcript"], [id*="transcript"], [class*="subtitle"]')
    .filter((node) => !node.closest('[data-studynav-owned]'))
    .map((node) => (node.innerText || '').trim())
    .filter((line) => line.length > 40)
    .join('\n\n');

  if (!text) text = await readTranscriptFromTracks(activeVideo());
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
    if (plan.teardown.mediaToolbar) teardownMediaToolbar();
    if (plan.teardown.transcript) teardownTranscript();
    if (plan.teardown.altText) teardownAltText();
    if (plan.teardown.copyAndLinks) teardownCopyAndLinks();
    if (plan.teardown.imgGet) teardownImgGet();
    if (plan.teardown.palette) teardownPalette();
    if (plan.teardown.mediaCtrl) teardownMediaCtrl();
    if (plan.teardown.annotations) teardownStudyRuntime();
    if (plan.teardown.continueWatching) teardownContinueWatching();

    markArticleRoots(support.article ? support.articleRoots : []);

    const css = cssFor(plan.styleFlags, location.hostname);
    if (css) ensureStyle(css);
    else removeStyle();

    document.documentElement.classList.add('studynav-on');
    document.documentElement.dataset.studynav = '1';

    if (flags.annotations || flags.bookmarks) {
      applyStudyRuntime(support.article ? support.articleRoots : [], {
        annotations: flags.annotations,
        bookmarks: flags.bookmarks,
      });
    }

    if (flags.advSearch && support.palette) {
      mountPalette();
      window.addEventListener('keydown', paletteHotkeyHandler, true);
    }
    if (flags.altText && support.article) runAltText(support.articleRoots);
    if (!flags.parLink) clearOwnedAnchors();
    if ((flags.copyText || flags.parLink || flags.verseAudio || flags.annotations) && support.article) {
      runCopyAndLinks(support.articleRoots, flags);
    }
    if (flags.langCount && support.language) runLangCount(support.articleRoots);
    if (flags.imgGet && support.article) runImgGet(support.articleRoots);
    if (flags.mediaCtrl && support.media) window.addEventListener('keydown', mediaKeyHandler, true);
    const mediaToolbar = mountMediaToolbar(flags, support.media);
    if (flags.continueWatching && support.media) {
      applyContinueWatching(qsa<HTMLVideoElement>('video'), mediaToolbar);
    }
  } catch (e) {
    console.warn('StudyNav feature error', e);
  }
}
