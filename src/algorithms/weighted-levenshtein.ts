import type { MatchResult } from '../types';
import { VISUAL_WEIGHT_MAP, LEVENSHTEIN_THRESHOLD } from '../types';

function substitutionCost(a: string, b: string): number {
  if (a === b) return 0;
  const aLC = a.toLowerCase(), bLC = b.toLowerCase();
  const weightA = VISUAL_WEIGHT_MAP[aLC];
  if (weightA && weightA[b] !== undefined) return weightA[b];
  const weightB = VISUAL_WEIGHT_MAP[bLC];
  if (weightB && weightB[a] !== undefined) return weightB[a];
  return 1.0;
}

export function weightedLevenshtein(s: string, t: string): number {
  const sLC = s.toLowerCase(), tLC = t.toLowerCase();
  const m = sLC.length, n = tLC.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + substitutionCost(sLC[i - 1], tLC[j - 1]));
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function similarity(s: string, t: string): number {
  const maxLen = Math.max(s.length, t.length);
  if (maxLen === 0) return 1;
  return 1 - weightedLevenshtein(s, t) / maxLen;
}

export function levenshteinSearch(text: string, keyword: string, threshold = LEVENSHTEIN_THRESHOLD): { positions: number[]; bestSimilarity: number } {
  const tokenRegex = /\S+/g;
  const positions: number[] = [];
  const matchLengths: number[] = [];
  let bestSimilarity = 0;

  let match: RegExpExecArray | null;
  const kwLen = keyword.length;

  while ((match = tokenRegex.exec(text)) !== null) {
    const token = match[0];
    // OPTIMASI MATEMATIS: Skip kalkulasi jika secara teori mustahil mencapai threshold
    const maxPossibleSim = 1 - Math.abs(token.length - kwLen) / Math.max(token.length, kwLen);
    if (maxPossibleSim < threshold) continue;

    const score = similarity(token, keyword);
    if (score >= threshold) { 
      positions.push(match.index); 
      matchLengths.push(match[0].length);
      if (score > bestSimilarity) bestSimilarity = score; 
    }
  }
  return { positions, matchLengths, bestSimilarity };
}

export function runLevenshtein(text: string, keyword: string, threshold = LEVENSHTEIN_THRESHOLD): MatchResult | null {
  const start = performance.now();
  const { positions, matchLengths, bestSimilarity } = levenshteinSearch(text, keyword, threshold);
  const end = performance.now();
  if (positions.length === 0) return null;
  return { keyword, algorithm: 'Levenshtein', positions, matchLengths, count: positions.length, similarity: bestSimilarity, executionTimeMs: end - start };
}
