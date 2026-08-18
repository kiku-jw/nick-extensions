import {
  HIGHLIGHT_COLORS,
  MAX_ANNOTATIONS,
  MAX_BACKUP_JSON_BYTES,
  MAX_BOOKMARKS,
  MAX_TEXT_LENGTH,
  createBookmarkId,
  createBookmarkRecord,
  mergeStudyData,
  normalizeStudyTargetUrl,
  normalizeTags,
  parseStudyDataBackup,
  serializeStudyData,
  validateAnnotation,
  type AnnotationRecord,
  type BookmarkRecord,
  type HighlightColor,
  type StudyDataV2,
  type TextSelector,
  type RootReference,
} from './study-data';
import {
  cleanTextSnapshot,
  resolveAnnotationInDom,
  selectorForRange,
  selectorForWholeElement,
} from './study-dom';
import { loadStudyData, mutateStudyData, studyDataChanged } from './study-storage';
import { canonicalStudyUrl, cleanCitationText } from './document-actions';
import { t, type MessageKey } from './i18n';
import { copy, deepestLinkFor, paragraphNodes, qs, toast } from './util';

const SELECTION_TOOLS_ID = 'studynav-selection-tools';
const EDITOR_ID = 'studynav-note-editor';
const PANEL_ID = 'studynav-study-panel';
const NOTE_RAIL_ID = 'studynav-note-rail';
const HIGHLIGHT_PREFIX = 'studynav-';

type SelectionCandidate = {
  root: RootReference;
  selector: TextSelector;
  range: Range;
};

type AnnotationEditorState = {
  candidate: SelectionCandidate | null;
  existing: AnnotationRecord | null;
};

type HighlightRegistryLike = {
  delete(name: string): boolean;
  set(name: string, value: unknown): void;
};

let enabled = false;
let annotationsEnabled = false;
let bookmarksEnabled = false;
let copyTextEnabled = false;
let parLinkEnabled = false;
let articleRoots: HTMLElement[] = [];
let currentCandidate: SelectionCandidate | null = null;
let pendingReattachId: string | null = null;
let selectionTimer: number | null = null;
let renderGeneration = 0;
let storageListening = false;
let railResizeListening = false;
let highlightClickListening = false;
let panelScope: 'page' | 'all' = 'page';
let panelView: 'notes' | 'bookmarks' = 'notes';
let panelReturnFocus: HTMLElement | null = null;
let editorReturnFocus: HTMLElement | null = null;
let editorState: AnnotationEditorState | null = null;
let unresolvedIds = new Set<string>();
let resolvedElements = new Map<string, HTMLElement>();
let resolvedRanges = new Map<string, Range>();
let lastSelectionError = '';

function registry(): HighlightRegistryLike | null {
  if (typeof CSS === 'undefined') return null;
  return (CSS as unknown as { highlights?: HighlightRegistryLike }).highlights || null;
}

function highlightConstructor(): (new (...ranges: Range[]) => unknown) | null {
  return (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight || null;
}

function clearHighlightRegistry() {
  const highlights = registry();
  if (!highlights) return;
  for (const color of HIGHLIGHT_COLORS) highlights.delete(`${HIGHLIGHT_PREFIX}${color}`);
}

function currentPageUrl(): string | null {
  const canonical = qs<HTMLLinkElement>('link[rel="canonical"][href]')?.href || null;
  return canonicalStudyUrl(location.href, canonical);
}

function currentPageTitle(): string {
  const heading = qs<HTMLElement>('#article h1, article h1, main h1, h1');
  return cleanCitationText(heading?.innerText || heading?.textContent || document.title || 'JW.ORG').slice(0, 512);
}

export type StudyBookmarkCandidate = {
  pageUrl: string;
  targetUrl: string;
  title: string;
  reference: string;
};

function bookmarkForCandidate(candidate: StudyBookmarkCandidate, now: number): BookmarkRecord | null {
  const id = createBookmarkId(candidate.targetUrl);
  if (!id) return null;
  return createBookmarkRecord({
    id,
    pageUrl: candidate.pageUrl,
    targetUrl: candidate.targetUrl,
    title: candidate.title,
    reference: candidate.reference,
    createdAt: now,
    updatedAt: now,
  });
}

export async function isStudyBookmarkSaved(targetUrl: string): Promise<boolean> {
  const normalized = normalizeStudyTargetUrl(targetUrl);
  if (!normalized) return false;
  const data = await loadStudyData();
  return data.bookmarks.some((bookmark) => bookmark.targetUrl === normalized);
}

export async function toggleStudyBookmark(
  candidate: StudyBookmarkCandidate,
): Promise<{ ok: boolean; message: string; saved: boolean }> {
  if (!enabled || !bookmarksEnabled) {
    return { ok: false, message: t('bookmarks_off'), saved: false };
  }
  let saved = false;
  try {
    await mutateStudyData((current) => {
      const normalized = normalizeStudyTargetUrl(candidate.targetUrl);
      if (!normalized) throw new Error(t('not_available_page'));
      const existing = current.bookmarks.find((bookmark) => bookmark.targetUrl === normalized);
      if (existing) {
        saved = false;
        return {
          ...current,
          bookmarks: current.bookmarks.filter((bookmark) => bookmark.id !== existing.id),
        };
      }
      if (current.bookmarks.length >= MAX_BOOKMARKS) throw new Error(t('bookmark_limit'));
      const record = bookmarkForCandidate(candidate, Date.now());
      if (!record) throw new Error(t('not_available_page'));
      saved = true;
      return { ...current, bookmarks: [record, ...current.bookmarks] };
    });
    return {
      ok: true,
      message: t(saved ? 'place_saved' : 'saved_place_removed'),
      saved,
    };
  } catch (error) {
    storageFailure(error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : t('study_data_save_failed'),
      saved: false,
    };
  }
}

function activeParagraphRoots(): HTMLElement[] {
  articleRoots = articleRoots.filter((root) => root.isConnected);
  return paragraphNodes(articleRoots);
}

function nextId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `sn-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function storageFailure(error: unknown) {
  console.warn('StudyNav study data', error);
  toast(error instanceof Error ? error.message : t('study_data_save_failed'));
}

function annotationWithTarget(
  candidate: Pick<SelectionCandidate, 'root' | 'selector'>,
  color: HighlightColor,
  note: string,
  tags: string[],
  existing?: AnnotationRecord | null,
): AnnotationRecord | null {
  const pageUrl = existing?.pageUrl || currentPageUrl();
  if (!pageUrl) return null;
  const now = Date.now();
  return validateAnnotation({
    id: existing?.id || nextId(),
    pageUrl,
    title: existing ? existing.title : currentPageTitle(),
    root: candidate.root,
    selector: candidate.selector,
    color,
    note,
    tags,
    createdAt: existing?.createdAt || now,
    updatedAt: existing ? Math.max(now, existing.updatedAt + 1) : now,
  });
}

async function storeAnnotation(record: AnnotationRecord): Promise<void> {
  await mutateStudyData((current) => {
    const index = current.annotations.findIndex((item) => item.id === record.id);
    const annotations = [...current.annotations];
    if (index >= 0) annotations[index] = record;
    else {
      if (annotations.length >= MAX_ANNOTATIONS) throw new Error(t('annotation_limit'));
      annotations.push(record);
    }
    return { ...current, annotations };
  });
}

async function saveCandidate(
  candidate: SelectionCandidate,
  color: HighlightColor,
  note: string,
  tags: string[],
  existing?: AnnotationRecord | null,
) {
  const record = annotationWithTarget(candidate, color, note, tags, existing);
  if (!record) {
    toast(t('selection_cannot_save'));
    return false;
  }
  try {
    await storeAnnotation(record);
    pendingReattachId = null;
    window.getSelection()?.removeAllRanges();
    hideSelectionTools();
    toast(existing ? t('note_updated') : t('highlight_saved'));
    return true;
  } catch (error) {
    storageFailure(error);
    return false;
  }
}

function selectionRoot(range: Range): HTMLElement | null {
  return activeParagraphRoots().find((root) =>
    root.contains(range.startContainer) && root.contains(range.endContainer)) || null;
}

function candidateFromSelection(): SelectionCandidate | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  const root = selectionRoot(range);
  if (!root) return null;
  const target = selectorForRange(root, range);
  if (!target || !target.selector.exact.trim()) return null;
  return { ...target, range: range.cloneRange() };
}

function selectionError(): string {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return '';
  const range = selection.getRangeAt(0);
  const roots = activeParagraphRoots();
  const startRoot = roots.find((root) => root.contains(range.startContainer));
  const endRoot = roots.find((root) => root.contains(range.endContainer));
  if (startRoot && endRoot && startRoot !== endRoot) {
    return t('select_one_paragraph');
  }
  if (startRoot && startRoot === endRoot) {
    return t('select_character_count', MAX_TEXT_LENGTH.toLocaleString());
  }
  return '';
}

function hideSelectionTools() {
  document.getElementById(SELECTION_TOOLS_ID)?.remove();
  currentCandidate = null;
}

function preserveSelectionOnPointerDown(button: HTMLButtonElement) {
  button.addEventListener('pointerdown', (event) => event.preventDefault());
  button.addEventListener('mousedown', (event) => event.preventDefault());
}

function colorButton(color: HighlightColor, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'studynav-color-button';
  button.dataset.color = color;
  const localizedColor = t(`color_${color}` as MessageKey);
  button.setAttribute('aria-label', t('highlight_color_aria', localizedColor));
  button.title = t('highlight_color_aria', localizedColor);
  preserveSelectionOnPointerDown(button);
  button.addEventListener('click', onClick);
  return button;
}

function positionSelectionTools(tools: HTMLElement, range: Range) {
  const rect = range.getBoundingClientRect();
  const fallback = selectionRoot(range)?.getBoundingClientRect();
  const anchor = rect.width || rect.height ? rect : fallback;
  if (!anchor) return;
  const width = tools.offsetWidth || 260;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, anchor.left + anchor.width / 2 - width / 2));
  const top = Math.max(8, anchor.top - (tools.offsetHeight || 44) - 8);
  tools.style.left = `${left}px`;
  tools.style.top = `${top}px`;
}

async function commitPendingReattach(candidate: SelectionCandidate) {
  if (!pendingReattachId) return;
  try {
    const data = await loadStudyData();
    const existing = data.annotations.find((item) => item.id === pendingReattachId);
    if (!existing) {
      pendingReattachId = null;
      toast(t('note_missing'));
      return;
    }
    if (existing.pageUrl !== currentPageUrl()) {
      pendingReattachId = null;
      hideSelectionTools();
      toast(t('reattach_source_first'));
      return;
    }
    await saveCandidate(candidate, existing.color, existing.note, existing.tags, existing);
  } catch (error) {
    storageFailure(error);
  }
}

function showSelectionTools(candidate: SelectionCandidate) {
  hideSelectionTools();
  currentCandidate = candidate;
  const tools = document.createElement('div');
  tools.id = SELECTION_TOOLS_ID;
  tools.className = 'studynav-selection-tools';
  tools.setAttribute('data-studynav-owned', '1');
  tools.setAttribute('role', 'toolbar');
  tools.setAttribute('aria-label', t(pendingReattachId ? 'reattach_note_aria' : 'selection_actions_aria'));

  if (pendingReattachId) {
    const reattach = document.createElement('button');
    reattach.type = 'button';
    reattach.textContent = t('reattach_here');
    preserveSelectionOnPointerDown(reattach);
    reattach.addEventListener('click', () => void commitPendingReattach(candidate));
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'studynav-secondary-button';
    cancel.textContent = t('cancel');
    preserveSelectionOnPointerDown(cancel);
    cancel.addEventListener('click', () => {
      pendingReattachId = null;
      hideSelectionTools();
      toast(t('reattach_cancelled'));
    });
    tools.append(reattach, cancel);
  } else {
    if (annotationsEnabled) {
      for (const color of HIGHLIGHT_COLORS) {
        tools.appendChild(colorButton(color, () => void saveCandidate(candidate, color, '', [])));
      }
      const note = document.createElement('button');
      note.type = 'button';
      note.textContent = t('add_note');
      preserveSelectionOnPointerDown(note);
      note.addEventListener('click', () => openAnnotationEditor(candidate));
      tools.appendChild(note);
    }

    if (copyTextEnabled) {
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'studynav-secondary-button';
      copyButton.textContent = t('copy');
      preserveSelectionOnPointerDown(copyButton);
      copyButton.addEventListener('click', () => {
        void copy(cleanCitationText(candidate.selector.exact));
        window.getSelection()?.removeAllRanges();
        hideSelectionTools();
      });
      tools.appendChild(copyButton);
    }

    if (parLinkEnabled) {
      const linkButton = document.createElement('button');
      linkButton.type = 'button';
      linkButton.className = 'studynav-secondary-button';
      linkButton.textContent = t('link');
      preserveSelectionOnPointerDown(linkButton);
      linkButton.addEventListener('click', () => {
        const root = selectionRoot(candidate.range);
        if (root) void copy(deepestLinkFor(root), t('link_copied'));
        window.getSelection()?.removeAllRanges();
        hideSelectionTools();
      });
      tools.appendChild(linkButton);
    }
  }

  document.documentElement.appendChild(tools);
  positionSelectionTools(tools, candidate.range);
}

function updateSelectionTools() {
  if (!enabled || (!annotationsEnabled && !copyTextEnabled && !parLinkEnabled) || document.getElementById(EDITOR_ID)) return;
  const candidate = candidateFromSelection();
  if (!candidate) {
    hideSelectionTools();
    const message = selectionError();
    if (message && message !== lastSelectionError) toast(message);
    lastSelectionError = message;
    return;
  }
  lastSelectionError = '';
  showSelectionTools(candidate);
}

const selectionChangeHandler = () => {
  if (selectionTimer != null) window.clearTimeout(selectionTimer);
  selectionTimer = window.setTimeout(() => {
    selectionTimer = null;
    updateSelectionTools();
  }, 0);
};

function closeEditor(rerender = true) {
  editorState = null;
  document.getElementById(EDITOR_ID)?.remove();
  window.removeEventListener('keydown', editorEscapeHandler, true);
  if (editorReturnFocus?.isConnected) editorReturnFocus.focus();
  editorReturnFocus = null;
  if (rerender && enabled) {
    void loadStudyData().then(renderPageNoteRail).catch(storageFailure);
  }
}

function editorEscapeHandler(event: KeyboardEvent) {
  if (event.key === 'Escape' && document.getElementById(EDITOR_ID)) {
    event.preventDefault();
    closeEditor();
  }
}

function annotationEditorForm(state: AnnotationEditorState): HTMLFormElement {
  const existing = state.existing;
  const form = document.createElement('form');
  form.id = EDITOR_ID;
  form.className = 'studynav-note-rail-editor';
  form.setAttribute('data-studynav-owned', '1');
  form.setAttribute('aria-labelledby', 'studynav-editor-title');
  const head = document.createElement('div');
  head.className = 'studynav-panel-head';
  const title = document.createElement('strong');
  title.id = 'studynav-editor-title';
  title.textContent = t(existing ? 'edit_highlight' : 'new_highlight');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'studynav-icon-button';
  close.textContent = t('close');
  close.setAttribute('aria-label', t('close_highlight_editor_aria'));
  close.addEventListener('click', () => closeEditor());
  head.append(title, close);

  const colors = document.createElement('fieldset');
  colors.className = 'studynav-color-fieldset';
  const legend = document.createElement('legend');
  legend.textContent = t('highlight_color');
  colors.appendChild(legend);
  for (const color of HIGHLIGHT_COLORS) {
    const label = document.createElement('label');
    label.className = 'studynav-color-choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'color';
    input.value = color;
    input.checked = color === (existing?.color || 'yellow');
    const swatch = document.createElement('span');
    swatch.dataset.color = color;
    const text = document.createElement('span');
    text.textContent = t(`color_${color}` as MessageKey);
    label.append(input, swatch, text);
    colors.appendChild(label);
  }

  const noteLabel = document.createElement('label');
  noteLabel.className = 'studynav-field';
  noteLabel.textContent = t('note');
  const note = document.createElement('textarea');
  note.id = 'studynav-note-text';
  note.rows = 5;
  note.maxLength = 20_000;
  note.placeholder = t('write_private_note');
  note.value = existing?.note || '';
  noteLabel.appendChild(note);

  const tagsLabel = document.createElement('label');
  tagsLabel.className = 'studynav-field';
  tagsLabel.textContent = t('tags');
  const tagEditor = document.createElement('div');
  tagEditor.className = 'studynav-tag-editor';
  const chips = document.createElement('div');
  chips.className = 'studynav-tag-chips';
  const tagInput = document.createElement('input');
  tagInput.id = 'studynav-note-tags';
  tagInput.type = 'text';
  tagInput.placeholder = t('tags_placeholder');
  tagInput.setAttribute('aria-label', t('tag_input_aria'));
  let tagValues = [...(existing?.tags || [])];
  const renderChips = () => {
    chips.replaceChildren();
    for (const [index, value] of tagValues.entries()) {
      const chip = document.createElement('span');
      chip.className = 'studynav-tag-chip';
      chip.append(document.createTextNode(value));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', t('remove_tag_aria', value));
      remove.addEventListener('click', () => {
        tagValues.splice(index, 1);
        renderChips();
        tagInput.focus();
      });
      chip.appendChild(remove);
      chips.appendChild(chip);
    }
  };
  renderChips();
  tagEditor.append(chips, tagInput);
  tagsLabel.appendChild(tagEditor);

  const error = document.createElement('p');
  error.className = 'studynav-form-error';
  error.setAttribute('aria-live', 'polite');
  const commitTagText = (value: string): boolean => {
    const normalized = normalizeTags([...tagValues, value].join(','));
    if (!normalized) {
      error.textContent = t('tags_error');
      return false;
    }
    tagValues = normalized;
    error.textContent = '';
    renderChips();
    return true;
  };
  tagInput.addEventListener('keydown', (event) => {
    if (event.key === ',' || event.key === 'Enter') {
      event.preventDefault();
      if (!tagInput.value.trim()) return;
      if (commitTagText(tagInput.value)) tagInput.value = '';
      return;
    }
    if (event.key === 'Backspace' && !tagInput.value && tagValues.length) {
      tagValues = tagValues.slice(0, -1);
      renderChips();
    }
  });
  tagInput.addEventListener('input', () => {
    tagInput.value = tagInput.value.replace(/^\s+/u, '');
    const lastComma = tagInput.value.lastIndexOf(',');
    if (lastComma < 0) return;
    const completed = tagInput.value.slice(0, lastComma);
    const remainder = tagInput.value.slice(lastComma + 1).replace(/^\s+/u, '');
    if (commitTagText(completed)) tagInput.value = remainder;
  });
  const actions = document.createElement('div');
  actions.className = 'studynav-panel-actions';
  if (existing) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'studynav-danger-button';
    remove.textContent = t('delete');
    remove.addEventListener('click', async () => {
      if (await deleteAnnotation(existing)) {
        closeEditor(false);
        void renderStudyState();
      }
    });
    actions.appendChild(remove);
  }
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'studynav-secondary-button';
  cancel.textContent = t('cancel');
  cancel.addEventListener('click', () => closeEditor());
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = t('save_locally');
  actions.append(cancel, save);
  form.append(head, colors, noteLabel, tagsLabel, error, actions);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const normalizedTags = normalizeTags([...tagValues, tagInput.value].join(','));
    const color = new FormData(form).get('color');
    if (!normalizedTags || !HIGHLIGHT_COLORS.includes(color as HighlightColor)) {
      error.textContent = t('tags_error');
      return;
    }
    const activeTarget = state.candidate || (existing ? {
      root: existing.root,
      selector: existing.selector,
      range: document.createRange(),
    } : null);
    if (!activeTarget) return;
    save.disabled = true;
    const saved = await saveCandidate(activeTarget, color as HighlightColor, note.value, normalizedTags, existing);
    save.disabled = false;
    if (saved) {
      closeEditor(false);
      void renderStudyState();
    }
  });
  return form;
}

function openAnnotationEditor(candidate: SelectionCandidate | null, existing?: AnnotationRecord | null) {
  if (!candidate && !existing) return;
  closeEditor(false);
  hideSelectionTools();
  closeStudyPanel();
  editorReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  editorState = { candidate, existing: existing || null };
  window.addEventListener('keydown', editorEscapeHandler, true);
  void loadStudyData().then((data) => {
    if (!editorState) return;
    renderPageNoteRail(data);
    window.requestAnimationFrame(() => {
      document.getElementById('studynav-note-text')?.focus();
    });
  }).catch(storageFailure);
}

export function openAnnotationEditorForElement(element: HTMLElement): boolean {
  if (!enabled || !annotationsEnabled) return false;
  const target = selectorForWholeElement(element);
  if (!target) {
    toast(t('paragraph_mark_unreliable'));
    return false;
  }
  openAnnotationEditor({ root: target.root, selector: target.selector, range: target.range });
  return true;
}

async function persistRecoveredTargets(recovered: AnnotationRecord[]) {
  if (!recovered.length) return;
  await mutateStudyData((current) => {
    const byId = new Map(recovered.map((record) => [record.id, record]));
    return {
      ...current,
      annotations: current.annotations.map((record) => {
        const candidate = byId.get(record.id);
        return candidate && candidate.updatedAt > record.updatedAt ? candidate : record;
      }),
    };
  });
}

async function renderStudyState(dataValue?: StudyDataV2) {
  const generation = ++renderGeneration;
  if (!enabled) return;
  try {
    const data = dataValue || await loadStudyData();
    if (!enabled || generation !== renderGeneration) return;
    const pageUrl = currentPageUrl();
    const roots = activeParagraphRoots();
    const rangesByColor = new Map<HighlightColor, Range[]>(HIGHLIGHT_COLORS.map((color) => [color, []]));
    const nextUnresolved = new Set<string>();
    const nextElements = new Map<string, HTMLElement>();
    const nextRanges = new Map<string, Range>();
    const recovered: AnnotationRecord[] = [];

    for (const annotation of annotationsEnabled
      ? data.annotations.filter((item) => item.pageUrl === pageUrl)
      : []) {
      const dom = resolveAnnotationInDom(annotation, roots);
      if (!dom) {
        nextUnresolved.add(annotation.id);
        continue;
      }
      rangesByColor.get(annotation.color)?.push(dom.range);
      nextElements.set(annotation.id, dom.element);
      nextRanges.set(annotation.id, dom.range.cloneRange());
      if (dom.resolution.recovered) {
        recovered.push({
          ...annotation,
          root: dom.resolution.root,
          selector: dom.selector,
          updatedAt: Math.max(Date.now(), annotation.updatedAt + 1),
        });
      }
    }

    clearHighlightRegistry();
    const highlights = registry();
    const HighlightCtor = highlightConstructor();
    if (highlights && HighlightCtor) {
      for (const color of HIGHLIGHT_COLORS) {
        const ranges = rangesByColor.get(color) || [];
        if (ranges.length) highlights.set(`${HIGHLIGHT_PREFIX}${color}`, new HighlightCtor(...ranges));
      }
    }
    unresolvedIds = nextUnresolved;
    resolvedElements = nextElements;
    resolvedRanges = nextRanges;
    renderPageNoteRail(data);
    if (document.getElementById(PANEL_ID)) await renderStudyPanel(data);
    if (recovered.length) await persistRecoveredTargets(recovered);
  } catch (error) {
    storageFailure(error);
  }
}

function highlightIdAtPoint(x: number, y: number): string | null {
  for (const [id, range] of resolvedRanges) {
    try {
      if (Array.from(range.getClientRects()).some((rect) =>
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      )) return id;
    } catch {
      /* A route update can detach a saved range between render and click. */
    }
  }
  return null;
}

const highlightClickHandler = (event: MouseEvent) => {
  if (!enabled || !annotationsEnabled || event.button !== 0) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target || target.closest('[data-studynav-owned], a, button, input, textarea, select, summary')) return;
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) return;
  const annotationId = highlightIdAtPoint(event.clientX, event.clientY);
  if (!annotationId) return;
  void loadStudyData().then((data) => {
    const annotation = data.annotations.find((item) => item.id === annotationId);
    if (annotation) openAnnotationEditor(null, annotation);
  }).catch(storageFailure);
};

function positionPageNoteRail() {
  const rail = document.getElementById(NOTE_RAIL_ID);
  if (!rail) return;
  const rightEdge = Math.max(0, ...activeParagraphRoots().map((root) => root.getBoundingClientRect().right));
  const fitsWithoutTextOverlap = window.innerWidth >= 980 && window.innerWidth - rightEdge >= 356;
  rail.dataset.mode = fitsWithoutTextOverlap ? 'rail' : editorState ? 'drawer' : 'button';
}

function pageRailCard(annotation: AnnotationRecord): HTMLElement {
  const card = document.createElement('article');
  card.className = 'studynav-note-rail-item';
  card.dataset.annotationId = annotation.id;
  const head = document.createElement('div');
  head.className = 'studynav-note-rail-item-head';
  const swatch = document.createElement('span');
  swatch.className = 'studynav-note-swatch';
  swatch.dataset.color = annotation.color;
  const quote = document.createElement('strong');
  quote.textContent = annotation.selector.exact;
  head.append(swatch, quote);
  card.appendChild(head);
  if (annotation.note.trim()) {
    const note = document.createElement('p');
    note.textContent = annotation.note;
    card.appendChild(note);
  }
  if (annotation.tags.length) {
    const tags = document.createElement('div');
    tags.className = 'studynav-note-tags';
    for (const value of annotation.tags) {
      const tag = document.createElement('span');
      tag.textContent = value;
      tags.appendChild(tag);
    }
    card.appendChild(tags);
  }
  const actions = document.createElement('div');
  actions.className = 'studynav-note-actions';
  actions.append(
    panelButton(t('locate'), () => openAnnotationSource(annotation), 'studynav-secondary-button'),
    panelButton(t(annotation.note.trim() ? 'edit' : 'add_note'), () => openAnnotationEditor(null, annotation)),
    panelButton(t('delete'), async () => { await deleteAnnotation(annotation); }, 'studynav-danger-button'),
  );
  card.appendChild(actions);
  return card;
}

function renderPageNoteRail(data: StudyDataV2) {
  const pageUrl = currentPageUrl();
  const notes = annotationsEnabled
    ? data.annotations
      .filter((annotation) => annotation.pageUrl === pageUrl)
      .sort((a, b) => b.updatedAt - a.updatedAt)
    : [];
  if (!notes.length && !editorState) {
    document.getElementById(NOTE_RAIL_ID)?.remove();
    return;
  }

  let rail = document.getElementById(NOTE_RAIL_ID);
  if (!rail) {
    rail = document.createElement('aside');
    rail.id = NOTE_RAIL_ID;
    rail.className = 'studynav-note-rail';
    rail.setAttribute('data-studynav-owned', '1');
    rail.setAttribute('aria-label', t('page_notes'));
    document.documentElement.appendChild(rail);
  }

  let head = rail.querySelector<HTMLElement>(':scope > .studynav-note-rail-head');
  if (!head) {
    head = document.createElement('div');
    head.className = 'studynav-note-rail-head';
    rail.prepend(head);
  }
  const heading = document.createElement('strong');
  heading.textContent = t('page_notes');
  const count = document.createElement('span');
  count.textContent = String(notes.length);
  const open = panelButton(t('open_all_notes'), () => { void openStudyPanel(); }, 'studynav-secondary-button');
  head.replaceChildren(heading, count, open);

  let list = rail.querySelector<HTMLElement>(':scope > .studynav-note-rail-list');
  if (!list) {
    list = document.createElement('div');
    list.className = 'studynav-note-rail-list';
    rail.appendChild(list);
  }
  list.querySelectorAll(':scope > .studynav-note-rail-item').forEach((card) => card.remove());
  if (editorState && !list.querySelector(`#${EDITOR_ID}`)) {
    list.prepend(annotationEditorForm(editorState));
  }
  for (const annotation of notes.slice(0, 50)) list.appendChild(pageRailCard(annotation));
  positionPageNoteRail();
}

function closeStudyPanel() {
  document.getElementById(PANEL_ID)?.remove();
  window.removeEventListener('keydown', panelEscapeHandler, true);
  if (panelReturnFocus?.isConnected) panelReturnFocus.focus();
  panelReturnFocus = null;
}

function panelEscapeHandler(event: KeyboardEvent) {
  if (event.key === 'Escape' && document.getElementById(PANEL_ID)) {
    event.preventDefault();
    closeStudyPanel();
  }
}

function panelButton(label: string, action: () => void | Promise<void>, className = ''): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = className;
  button.addEventListener('click', () => void action());
  return button;
}

function beginReattach(annotation: AnnotationRecord) {
  if (annotation.pageUrl !== currentPageUrl()) return;
  pendingReattachId = annotation.id;
  closeStudyPanel();
  toast(t('reattach_instruction'));
}

async function deleteAnnotation(annotation: AnnotationRecord): Promise<boolean> {
  if (!window.confirm(t('delete_highlight_confirm'))) return false;
  try {
    await mutateStudyData((current) => ({
      ...current,
      annotations: current.annotations.filter((item) => item.id !== annotation.id),
    }));
    toast(t('highlight_deleted'));
    return true;
  } catch (error) {
    storageFailure(error);
    return false;
  }
}

function openAnnotationSource(annotation: AnnotationRecord) {
  const localElement = resolvedElements.get(annotation.id);
  if (annotation.pageUrl === currentPageUrl() && localElement) {
    localElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    localElement.classList.add('studynav-locate-pulse');
    window.setTimeout(() => localElement.classList.remove('studynav-locate-pulse'), 1400);
    return;
  }
  const target = new URL(annotation.pageUrl);
  if (annotation.root.id) target.hash = annotation.root.id;
  const opened = window.open(target.toString(), '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
}

function annotationCard(annotation: AnnotationRecord): HTMLElement {
  const card = document.createElement('article');
  card.className = 'studynav-note-card';
  card.dataset.annotationId = annotation.id;
  const head = document.createElement('div');
  head.className = 'studynav-note-card-head';
  const swatch = document.createElement('span');
  swatch.className = 'studynav-note-swatch';
  swatch.dataset.color = annotation.color;
  const title = document.createElement('strong');
  title.textContent = annotation.title || 'JW.ORG';
  head.append(swatch, title);
  if (unresolvedIds.has(annotation.id) && annotation.pageUrl === currentPageUrl()) {
    const orphan = document.createElement('span');
    orphan.className = 'studynav-orphan-badge';
    orphan.textContent = t('needs_attention');
    head.appendChild(orphan);
  }
  const quote = document.createElement('blockquote');
  quote.textContent = annotation.selector.exact;
  card.append(head, quote);
  if (annotation.note) {
    const note = document.createElement('p');
    note.className = 'studynav-note-body';
    note.textContent = annotation.note;
    card.appendChild(note);
  }
  if (annotation.tags.length) {
    const tags = document.createElement('div');
    tags.className = 'studynav-note-tags';
    for (const value of annotation.tags) {
      const tag = document.createElement('span');
      tag.textContent = value;
      tags.appendChild(tag);
    }
    card.appendChild(tags);
  }
  const actions = document.createElement('div');
  actions.className = 'studynav-note-actions';
  actions.append(
    panelButton(annotation.pageUrl === currentPageUrl() ? t('locate') : t('open_page'), () => openAnnotationSource(annotation)),
    panelButton(t('edit'), () => openAnnotationEditor(null, annotation)),
    panelButton(t('delete'), async () => { await deleteAnnotation(annotation); }, 'studynav-danger-button'),
  );
  if (unresolvedIds.has(annotation.id) && annotation.pageUrl === currentPageUrl()) {
    actions.appendChild(panelButton(t('reattach'), () => beginReattach(annotation)));
  }
  card.appendChild(actions);
  return card;
}

function openBookmarkSource(bookmark: BookmarkRecord) {
  const opened = window.open(bookmark.targetUrl, '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
}

async function deleteBookmark(bookmark: BookmarkRecord) {
  if (!window.confirm(t('remove_saved_place_confirm'))) return;
  try {
    await mutateStudyData((current) => ({
      ...current,
      bookmarks: current.bookmarks.filter((item) => item.id !== bookmark.id),
    }));
    toast(t('saved_place_removed'));
  } catch (error) {
    storageFailure(error);
  }
}

function bookmarkCard(bookmark: BookmarkRecord): HTMLElement {
  const card = document.createElement('article');
  card.className = 'studynav-note-card studynav-bookmark-card';
  card.dataset.bookmarkId = bookmark.id;

  const head = document.createElement('div');
  head.className = 'studynav-note-card-head';
  const title = document.createElement('strong');
  title.textContent = bookmark.title || 'JW.ORG';
  head.appendChild(title);
  card.appendChild(head);

  if (bookmark.reference) {
    const reference = document.createElement('p');
    reference.className = 'studynav-bookmark-reference';
    reference.textContent = bookmark.reference;
    card.appendChild(reference);
  }
  const target = document.createElement('p');
  target.className = 'studynav-bookmark-url';
  target.textContent = bookmark.targetUrl;
  card.appendChild(target);

  const actions = document.createElement('div');
  actions.className = 'studynav-note-actions';
  actions.append(
    panelButton(t('open_saved_place'), () => openBookmarkSource(bookmark)),
    panelButton(t('remove_saved_place_action'), () => deleteBookmark(bookmark), 'studynav-danger-button'),
  );
  card.appendChild(actions);
  return card;
}

function panelElements() {
  const panel = document.getElementById(PANEL_ID);
  return panel ? {
    panel,
    search: panel.querySelector<HTMLInputElement>('#studynav-note-search')!,
    tag: panel.querySelector<HTMLSelectElement>('#studynav-note-tag')!,
    count: panel.querySelector<HTMLElement>('#studynav-note-count')!,
    list: panel.querySelector<HTMLElement>('#studynav-note-list')!,
    notesView: panel.querySelector<HTMLButtonElement>('[data-view="notes"]')!,
    bookmarksView: panel.querySelector<HTMLButtonElement>('[data-view="bookmarks"]')!,
    pageScope: panel.querySelector<HTMLButtonElement>('[data-scope="page"]')!,
    allScope: panel.querySelector<HTMLButtonElement>('[data-scope="all"]')!,
  } : null;
}

async function renderStudyPanel(dataValue?: StudyDataV2) {
  const elements = panelElements();
  if (!elements) return;
  try {
    const data = dataValue || await loadStudyData();
    const pageUrl = currentPageUrl();
    if (!annotationsEnabled && bookmarksEnabled) panelView = 'bookmarks';
    if (!bookmarksEnabled) panelView = 'notes';
    elements.notesView.hidden = !annotationsEnabled;
    elements.bookmarksView.hidden = !bookmarksEnabled;
    elements.notesView.setAttribute('aria-pressed', String(panelView === 'notes'));
    elements.bookmarksView.setAttribute('aria-pressed', String(panelView === 'bookmarks'));
    elements.pageScope.textContent = t('this_page');
    elements.allScope.textContent = t(panelView === 'notes' ? 'all_notes' : 'all_pages');
    elements.search.placeholder = t(panelView === 'notes' ? 'search_notes_placeholder' : 'search_saved_places');
    elements.search.setAttribute('aria-label', t(panelView === 'notes' ? 'search_notes' : 'search_saved_places'));
    elements.tag.hidden = panelView !== 'notes';
    elements.panel.querySelector<HTMLElement>('.studynav-study-filters')!.dataset.view = panelView;
    elements.list.replaceChildren();

    const query = cleanCitationText(elements.search.value).toLowerCase();
    if (panelView === 'bookmarks') {
      const records = data.bookmarks.filter((bookmark) => {
        if (panelScope === 'page' && bookmark.pageUrl !== pageUrl) return false;
        if (!query) return true;
        return [bookmark.title, bookmark.reference, bookmark.targetUrl]
          .join(' ').toLowerCase().includes(query);
      });
      for (const bookmark of records) elements.list.appendChild(bookmarkCard(bookmark));
      if (!records.length) {
        const empty = document.createElement('p');
        empty.className = 'studynav-empty-state';
        empty.textContent = data.bookmarks.length ? t('no_saved_places_filtered') : t('no_saved_places_yet');
        elements.list.appendChild(empty);
      }
      elements.count.textContent = t(
        records.length === 1 ? 'saved_places_count_one' : 'saved_places_count_many',
        String(records.length),
      );
    } else {
    const allTags = [...new Set(data.annotations.flatMap((annotation) => annotation.tags))].sort();
    const selectedTag = elements.tag.value;
    elements.tag.replaceChildren(new Option(t('all_tags'), ''));
    for (const tag of allTags) elements.tag.appendChild(new Option(tag, tag));
    elements.tag.value = allTags.includes(selectedTag) ? selectedTag : '';

    const tag = elements.tag.value;
    const records = data.annotations.filter((annotation) => {
      if (panelScope === 'page' && annotation.pageUrl !== pageUrl) return false;
      if (tag && !annotation.tags.includes(tag)) return false;
      if (!query) return true;
      return [annotation.title, annotation.selector.exact, annotation.note, annotation.tags.join(' ')]
        .join(' ').toLowerCase().includes(query);
    });
    for (const annotation of records) elements.list.appendChild(annotationCard(annotation));
    if (!records.length) {
      const empty = document.createElement('p');
      empty.className = 'studynav-empty-state';
      empty.textContent = data.annotations.length ? t('no_notes_filtered') : t('no_notes_yet');
      elements.list.appendChild(empty);
    }
    elements.count.textContent = t(records.length === 1 ? 'notes_count_one' : 'notes_count_many', String(records.length));
    }
    elements.panel.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.scope === panelScope));
    });
  } catch (error) {
    storageFailure(error);
  }
}

async function exportStudyData() {
  try {
    const data = await loadStudyData();
    const json = serializeStudyData(data);
    if (!json) throw new Error(t('study_export_failed'));
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `studynav-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t('study_backup_downloaded'));
  } catch (error) {
    storageFailure(error);
  }
}

async function importStudyData(file: File) {
  try {
    if (file.size > MAX_BACKUP_JSON_BYTES) {
      toast(t('backup_too_large'));
      return;
    }
    const parsed = parseStudyDataBackup(await file.text());
    if (!parsed.data) {
      toast(parsed.error === 'too-large' ? t('backup_too_large') : t('backup_invalid'));
      return;
    }
    let stats = { accepted: 0, updated: 0, ignored: 0, rejected: 0 };
    await mutateStudyData((current) => {
      const merged = mergeStudyData(current, parsed.data);
      stats = merged.stats;
      return merged.data;
    });
    toast(t('import_summary', [
      String(stats.accepted),
      String(stats.updated),
      String(stats.ignored),
      String(stats.rejected),
    ]));
  } catch (error) {
    storageFailure(error);
  }
}

function mountStudyPanel() {
  closeStudyPanel();
  panelReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const panel = document.createElement('aside');
  panel.id = PANEL_ID;
  panel.className = 'studynav-study-panel';
  panel.setAttribute('data-studynav-owned', '1');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'studynav-study-title');

  const head = document.createElement('div');
  head.className = 'studynav-study-head';
  const headingWrap = document.createElement('div');
  const title = document.createElement('strong');
  title.id = 'studynav-study-title';
  title.textContent = t('study_library');
  const count = document.createElement('span');
  count.id = 'studynav-note-count';
  count.textContent = t('notes_count_many', '0');
  headingWrap.append(title, count);
  const close = panelButton(t('close'), closeStudyPanel, 'studynav-icon-button');
  close.setAttribute('aria-label', t('close_study_library_aria'));
  head.append(headingWrap, close);

  if (!annotationsEnabled && bookmarksEnabled) panelView = 'bookmarks';
  if (!bookmarksEnabled) panelView = 'notes';
  const view = document.createElement('div');
  view.className = 'studynav-view-switch';
  for (const [value, label] of [['notes', t('notes_tab')], ['bookmarks', t('saved_places_tab')]] as const) {
    const button = panelButton(label, () => {
      panelView = value;
      panelScope = 'page';
      search.value = '';
      tag.value = '';
      void renderStudyPanel();
    });
    button.dataset.view = value;
    button.hidden = value === 'notes' ? !annotationsEnabled : !bookmarksEnabled;
    button.setAttribute('aria-pressed', String(panelView === value));
    view.appendChild(button);
  }

  const scope = document.createElement('div');
  scope.className = 'studynav-scope-switch';
  for (const [value, label] of [['page', t('this_page')], ['all', t('all_notes')]] as const) {
    const button = panelButton(label, () => {
      panelScope = value;
      void renderStudyPanel();
    });
    button.dataset.scope = value;
    button.setAttribute('aria-pressed', String(panelScope === value));
    scope.appendChild(button);
  }

  const filters = document.createElement('div');
  filters.className = 'studynav-study-filters';
  const search = document.createElement('input');
  search.id = 'studynav-note-search';
  search.type = 'search';
  search.placeholder = t('search_notes_placeholder');
  search.setAttribute('aria-label', t('search_notes'));
  const tag = document.createElement('select');
  tag.id = 'studynav-note-tag';
  tag.setAttribute('aria-label', t('filter_notes_tag'));
  tag.appendChild(new Option(t('all_tags'), ''));
  search.addEventListener('input', () => void renderStudyPanel());
  tag.addEventListener('change', () => void renderStudyPanel());
  filters.append(search, tag);

  const list = document.createElement('div');
  list.id = 'studynav-note-list';
  list.className = 'studynav-note-list';
  const footer = document.createElement('div');
  footer.className = 'studynav-study-footer';
  const exportButton = panelButton(t('export_json'), exportStudyData);
  const importLabel = document.createElement('label');
  importLabel.className = 'studynav-import-label';
  importLabel.textContent = t('import_json');
  importLabel.tabIndex = 0;
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.addEventListener('change', () => {
    const selected = file.files?.[0];
    if (selected) void importStudyData(selected);
    file.value = '';
  });
  importLabel.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      file.click();
    }
  });
  importLabel.appendChild(file);
  footer.append(exportButton, importLabel);
  panel.append(head, view, scope, filters, list, footer);
  document.documentElement.appendChild(panel);
  window.addEventListener('keydown', panelEscapeHandler, true);
  search.focus();
}

export async function openStudyPanel(): Promise<{ ok: boolean; message: string }> {
  if (!enabled) return { ok: false, message: t('study_tools_off') };
  mountStudyPanel();
  await renderStudyState();
  return { ok: true, message: t('study_library_opened') };
}

const localStorageChangeHandler = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => {
  if (enabled && studyDataChanged(changes, areaName)) void renderStudyState();
};

export type StudyRuntimeOptions = {
  annotations: boolean;
  bookmarks: boolean;
  copyText?: boolean;
  parLink?: boolean;
};

export function applyStudyRuntime(
  nextArticleRoots: HTMLElement[],
  options: StudyRuntimeOptions = { annotations: true, bookmarks: false, copyText: false, parLink: false },
) {
  articleRoots = [...nextArticleRoots];
  const annotationStateChanged = annotationsEnabled !== options.annotations;
  const selectionConfigChanged = annotationsEnabled !== options.annotations ||
    copyTextEnabled !== (options.copyText === true) ||
    parLinkEnabled !== (options.parLink === true);
  const selectionWasEnabled = annotationsEnabled || copyTextEnabled || parLinkEnabled;
  annotationsEnabled = options.annotations;
  bookmarksEnabled = options.bookmarks;
  copyTextEnabled = options.copyText === true;
  parLinkEnabled = options.parLink === true;
  const selectionIsEnabled = annotationsEnabled || copyTextEnabled || parLinkEnabled;
  if (!enabled) {
    enabled = true;
  }
  if (selectionConfigChanged) hideSelectionTools();
  if (selectionIsEnabled) {
    document.addEventListener('selectionchange', selectionChangeHandler, true);
  } else if (selectionWasEnabled) {
    document.removeEventListener('selectionchange', selectionChangeHandler, true);
    pendingReattachId = null;
    hideSelectionTools();
  }
  if (annotationsEnabled) {
    if (!highlightClickListening) {
      highlightClickListening = true;
      document.addEventListener('click', highlightClickHandler, true);
    }
  } else if (annotationStateChanged) {
    if (highlightClickListening) {
      highlightClickListening = false;
      document.removeEventListener('click', highlightClickHandler, true);
    }
    pendingReattachId = null;
    closeEditor(false);
    clearHighlightRegistry();
    unresolvedIds = new Set();
    resolvedElements = new Map();
    resolvedRanges = new Map();
  }
  if (!storageListening) {
    storageListening = true;
    chrome.storage.onChanged.addListener(localStorageChangeHandler);
  }
  if (!railResizeListening) {
    railResizeListening = true;
    window.addEventListener('resize', positionPageNoteRail);
  }
  void renderStudyState();
}

export function teardownStudyRuntime() {
  enabled = false;
  annotationsEnabled = false;
  bookmarksEnabled = false;
  copyTextEnabled = false;
  parLinkEnabled = false;
  articleRoots = [];
  pendingReattachId = null;
  lastSelectionError = '';
  renderGeneration += 1;
  if (selectionTimer != null) window.clearTimeout(selectionTimer);
  selectionTimer = null;
  document.removeEventListener('selectionchange', selectionChangeHandler, true);
  if (highlightClickListening) {
    highlightClickListening = false;
    document.removeEventListener('click', highlightClickHandler, true);
  }
  if (storageListening) {
    storageListening = false;
    chrome.storage.onChanged.removeListener(localStorageChangeHandler);
  }
  if (railResizeListening) {
    railResizeListening = false;
    window.removeEventListener('resize', positionPageNoteRail);
  }
  hideSelectionTools();
  closeEditor(false);
  closeStudyPanel();
  document.getElementById(NOTE_RAIL_ID)?.remove();
  clearHighlightRegistry();
  unresolvedIds = new Set();
  resolvedElements = new Map();
  resolvedRanges = new Map();
}

export function studyRuntimeStatus() {
  return {
    enabled,
    annotationsEnabled,
    bookmarksEnabled,
    copyTextEnabled,
    parLinkEnabled,
    panelOpen: !!document.getElementById(PANEL_ID),
    noteRailOpen: !!document.getElementById(NOTE_RAIL_ID),
    selectionToolsOpen: !!document.getElementById(SELECTION_TOOLS_ID),
    unresolvedCount: unresolvedIds.size,
  };
}
