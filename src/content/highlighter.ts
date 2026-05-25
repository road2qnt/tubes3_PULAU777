import type { MatchResult } from '../types';

export const MARK_ATTR = 'data-judol';
export const MARK_SELECTOR = `mark[${MARK_ATTR}]`;

export function highlightTextNode(textNode: Text, result: MatchResult): void {
  const text = textNode.textContent ?? '';
  const kw = result.keyword;
  const parent = textNode.parentNode;
  if (!parent) return;

  type Segment = { start: number; end: number; isMatch: boolean };
  const segments: Segment[] = [];
  let lastEnd = 0;
  const sortedPositions = [...new Set(result.positions)].sort((a, b) => a - b);

  for (const pos of sortedPositions) {
    const end = pos + kw.length;
    if (pos < lastEnd) continue;
    if (pos > lastEnd) segments.push({ start: lastEnd, end: pos, isMatch: false });
    segments.push({ start: pos, end, isMatch: true });
    lastEnd = end;
  }
  if (lastEnd < text.length) segments.push({ start: lastEnd, end: text.length, isMatch: false });
  if (segments.length === 0) return;

  const fragment = document.createDocumentFragment();
  for (const seg of segments) {
    const segText = text.slice(seg.start, seg.end);
    if (seg.isMatch) {
      const mark = document.createElement('mark');
      mark.setAttribute(MARK_ATTR, result.keyword);
      mark.setAttribute('data-algo', result.algorithm);
      mark.setAttribute('data-count', String(result.count));
      mark.setAttribute('data-time', `${result.executionTimeMs.toFixed(2)}ms`);
      if (result.similarity !== undefined) mark.setAttribute('data-similarity', result.similarity.toFixed(3));
      mark.className = 'judol-highlight';
      mark.textContent = segText;
      fragment.appendChild(mark);
    } else fragment.appendChild(document.createTextNode(segText));
  }
  parent.replaceChild(fragment, textNode);
}

export function clearHighlights(): void {
  const marks = document.querySelectorAll<HTMLElement>(MARK_SELECTOR);
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  }
}

export function setBlurMode(enabled: boolean): void {
  const marks = document.querySelectorAll<HTMLElement>(MARK_SELECTOR);
  for (const mark of marks) mark.classList.toggle('judol-blur', enabled);
}
