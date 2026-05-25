import type { MatchResult } from '../types';

export function buildFailureFunction(pattern: string): number[] {
  const m = pattern.length;
  const failure = new Array<number>(m).fill(0);
  let k = 0;
  for (let i = 1; i < m; i++) {
    while (k > 0 && pattern[k] !== pattern[i]) k = failure[k - 1];
    if (pattern[k] === pattern[i]) k++;
    failure[i] = k;
  }
  return failure;
}

export function kmpSearch(text: string, pattern: string): { positions: number[]; comparisons: number } {
  const n = text.length, m = pattern.length;
  const positions: number[] = [];
  let comparisons = 0;
  if (m === 0 || m > n) return { positions, comparisons };

  const textLC = text.toLowerCase(), patLC = pattern.toLowerCase();
  const failure = buildFailureFunction(patLC);
  let q = 0;

  for (let i = 0; i < n; i++) {
    comparisons++;
    while (q > 0 && patLC[q] !== textLC[i]) { q = failure[q - 1]; comparisons++; }
    if (patLC[q] === textLC[i]) q++;
    if (q === m) { positions.push(i - m + 1); q = failure[q - 1]; }
  }
  return { positions, comparisons };
}

export function runKMP(text: string, keyword: string): MatchResult {
  const start = performance.now();
  const { positions } = kmpSearch(text, keyword);
  const end = performance.now();
  return { keyword, algorithm: 'KMP', positions, count: positions.length, executionTimeMs: end - start };
}
