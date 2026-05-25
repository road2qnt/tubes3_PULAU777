import type { MatchResult } from '../types';

export function buildLastOccurrence(pattern: string): Map<string, number> {
  const lastOcc = new Map<string, number>();
  for (let i = 0; i < pattern.length; i++) lastOcc.set(pattern[i], i);
  return lastOcc;
}

export function buildGoodSuffix(pattern: string): number[] {
  const m = pattern.length;
  const shift = new Array<number>(m + 1).fill(m);
  const border = new Array<number>(m + 1).fill(0);
  let i = m, j = m + 1;
  border[i] = j;

  while (i > 0) {
    while (j <= m && pattern[i - 1] !== pattern[j - 1]) {
      if (shift[j] === m) shift[j] = j - i;
      j = border[j];
    }
    i--; j--;
    border[i] = j;
  }

  j = border[0];
  for (i = 0; i <= m; i++) {
    if (shift[i] === m) shift[i] = j;
    if (i === j) j = border[j];
  }
  return shift;
}

export function boyerMooreSearch(text: string, pattern: string): { positions: number[]; comparisons: number } {
  const n = text.length, m = pattern.length;
  const positions: number[] = [];
  let comparisons = 0;
  if (m === 0 || m > n) return { positions, comparisons };

  const textLC = text.toLowerCase(), patLC = pattern.toLowerCase();
  const lastOcc = buildLastOccurrence(patLC);
  const goodSuffix = buildGoodSuffix(patLC);

  for (let s = 0; s <= n - m;) {
    let j = m - 1;
    while (j >= 0) { comparisons++; if (patLC[j] === textLC[s + j]) j--; else break; }
    if (j < 0) { positions.push(s); s += goodSuffix[0]; }
    else s += Math.max(j - (lastOcc.get(textLC[s + j]) ?? -1), goodSuffix[j + 1]);
  }
  return { positions, comparisons };
}

export function runBoyerMoore(text: string, keyword: string): MatchResult {
  const start = performance.now();
  const { positions } = boyerMooreSearch(text, keyword);
  const end = performance.now();
  return { keyword, algorithm: 'BoyerMoore', positions, count: positions.length, executionTimeMs: end - start };
}
