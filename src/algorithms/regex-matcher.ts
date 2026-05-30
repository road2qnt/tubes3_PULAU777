import type { MatchResult } from '../types';

const substitutions: Record<string, string> = {
  o: '[o0O]', a: '[a4@A]', i: '[i1lI!]', e: '[e3E]',
  s: '[s5S$]', g: '[g9G]', z: '[z2Z]', l: '[l1L|]', t: '[t7T]', b: '[b6B]',
};

function buildFuzzyCharClass(keyword: string): string {
  return keyword.toLowerCase().split('').map((c) => substitutions[c] ?? c).join('');
}

export function buildKeywordRegex(keyword: string): RegExp {
  return new RegExp(`\\b${buildFuzzyCharClass(keyword)}\\d*\\b`, 'gi');
}

export function runRegex(text: string, keyword: string): MatchResult {
  const start = performance.now();
  const regex = buildKeywordRegex(keyword);
  const positions: number[] = [];
  const matchLengths: number[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    positions.push(match.index);
    matchLengths.push(match[0].length);
    if (match[0].length === 0) regex.lastIndex++;
  }

  const end = performance.now();
  return { keyword, algorithm: 'Regex', positions, matchLengths, count: positions.length, executionTimeMs: end - start };
}

export function runRegexAll(text: string, keywords: string[]): Map<string, MatchResult> {
  const results = new Map<string, MatchResult>();
  for (const kw of keywords) {
    const result = runRegex(text, kw);
    if (result.count > 0) results.set(kw, result);
  }
  return results;
}
