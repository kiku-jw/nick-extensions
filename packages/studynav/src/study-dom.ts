import {
  createTextSelector,
  resolveTextSelector,
  rootReferenceKey,
  type AnnotationRecord,
  type RootReference,
  type RootTextSnapshot,
  type TextResolution,
  type TextSelector,
} from './study-data';

export type TextSegment = {
  node: Text;
  start: number;
  end: number;
};

export type CleanTextSnapshot = RootTextSnapshot & {
  element: HTMLElement;
  segments: TextSegment[];
};

export type DomAnnotationResolution = {
  element: HTMLElement;
  range: Range;
  resolution: TextResolution;
  selector: TextSelector;
};

const EXCLUDED_TEXT_SELECTOR = [
  '[data-studynav-owned]',
  '.studynav-para-tools',
  'script',
  'style',
  'noscript',
  'template',
].join(',');

export function rootReferenceForElement(element: HTMLElement): RootReference | null {
  if (element.id) return { id: element.id };
  const dataPid = element.getAttribute('data-pid');
  if (dataPid) return { dataPid };
  const dataVerse = element.getAttribute('data-verse');
  if (dataVerse) return { dataVerse };
  return null;
}

export function elementForRootReference(
  reference: RootReference,
  roots: readonly HTMLElement[],
): HTMLElement | null {
  const key = rootReferenceKey(reference);
  if (!key) return null;
  return roots.find((element) => {
    const candidate = rootReferenceForElement(element);
    return !!candidate && rootReferenceKey(candidate) === key;
  }) || null;
}

export function cleanTextSnapshot(element: HTMLElement): CleanTextSnapshot | null {
  const root = rootReferenceForElement(element);
  if (!root) return null;
  const segments: TextSegment[] = [];
  let text = '';
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !node.nodeValue) return NodeFilter.FILTER_REJECT;
      const excluded = parent.closest(EXCLUDED_TEXT_SELECTOR);
      if (excluded && element.contains(excluded)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const value = node.nodeValue || '';
    if (!value) continue;
    const start = text.length;
    text += value;
    segments.push({ node: node as Text, start, end: text.length });
  }
  return { element, root, text, segments };
}

function boundaryOffset(snapshot: CleanTextSnapshot, container: Node, offset: number): number | null {
  if (container.nodeType !== Node.TEXT_NODE) return null;
  const segment = snapshot.segments.find((item) => item.node === container);
  if (!segment || offset < 0 || offset > segment.node.data.length) return null;
  return segment.start + offset;
}

export function offsetsForRange(
  snapshot: CleanTextSnapshot,
  range: Pick<Range, 'startContainer' | 'startOffset' | 'endContainer' | 'endOffset'>,
): { start: number; end: number } | null {
  const start = boundaryOffset(snapshot, range.startContainer, range.startOffset);
  const end = boundaryOffset(snapshot, range.endContainer, range.endOffset);
  return start != null && end != null && start < end ? { start, end } : null;
}

function pointForOffset(
  snapshot: CleanTextSnapshot,
  offset: number,
  preferNext: boolean,
): { node: Text; offset: number } | null {
  if (offset < 0 || offset > snapshot.text.length) return null;
  for (let index = 0; index < snapshot.segments.length; index += 1) {
    const segment = snapshot.segments[index];
    if (offset < segment.end || (!preferNext && offset === segment.end)) {
      return { node: segment.node, offset: offset - segment.start };
    }
    if (preferNext && offset === segment.end && snapshot.segments[index + 1]) {
      return { node: snapshot.segments[index + 1].node, offset: 0 };
    }
  }
  const last = snapshot.segments.at(-1);
  return last && offset === snapshot.text.length
    ? { node: last.node, offset: last.node.data.length }
    : null;
}

export function rangeForOffsets(
  snapshot: CleanTextSnapshot,
  start: number,
  end: number,
): Range | null {
  if (start < 0 || end <= start || end > snapshot.text.length) return null;
  const startPoint = pointForOffset(snapshot, start, true);
  const endPoint = pointForOffset(snapshot, end, false);
  if (!startPoint || !endPoint) return null;
  const range = snapshot.element.ownerDocument.createRange();
  try {
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    return range;
  } catch {
    range.detach?.();
    return null;
  }
}

export function selectorForRange(element: HTMLElement, range: Range): {
  root: RootReference;
  selector: TextSelector;
} | null {
  const snapshot = cleanTextSnapshot(element);
  if (!snapshot) return null;
  const offsets = offsetsForRange(snapshot, range);
  if (!offsets) return null;
  const selector = createTextSelector(snapshot.text, offsets.start, offsets.end);
  return selector ? { root: snapshot.root, selector } : null;
}

export function selectorForWholeElement(element: HTMLElement): {
  root: RootReference;
  selector: TextSelector;
  range: Range;
} | null {
  const snapshot = cleanTextSnapshot(element);
  if (!snapshot || !snapshot.text.trim()) return null;
  const firstContent = snapshot.text.search(/\S/u);
  const trailing = snapshot.text.match(/\s*$/u)?.[0].length || 0;
  const end = snapshot.text.length - trailing;
  if (firstContent < 0 || end <= firstContent) return null;
  const selector = createTextSelector(snapshot.text, firstContent, end);
  const range = rangeForOffsets(snapshot, firstContent, end);
  return selector && range ? { root: snapshot.root, selector, range } : null;
}

export function resolveAnnotationInDom(
  annotation: AnnotationRecord,
  roots: readonly HTMLElement[],
): DomAnnotationResolution | null {
  const snapshots = roots.map(cleanTextSnapshot).filter((value): value is CleanTextSnapshot => !!value);
  const saved = snapshots.find((snapshot) => rootReferenceKey(snapshot.root) === rootReferenceKey(annotation.root));
  const resolution = resolveTextSelector(
    annotation.selector,
    annotation.root,
    saved?.text,
    snapshots.map(({ root, text }) => ({ root, text })),
  );
  if (!resolution) return null;
  const snapshot = snapshots.find((candidate) =>
    rootReferenceKey(candidate.root) === rootReferenceKey(resolution.root));
  if (!snapshot) return null;
  const range = rangeForOffsets(snapshot, resolution.start, resolution.end);
  if (!range) return null;
  const selector = createTextSelector(snapshot.text, resolution.start, resolution.end);
  return selector ? { element: snapshot.element, range, resolution, selector } : null;
}
