import type { MatchResult } from '../types';

const BASE = 31;
const MOD = 1_000_000_007n;
const BIGN = BigInt(BASE);

function charCode(c: string): bigint { return BigInt(c.charCodeAt(0) - 96); }

function computeHash(s: string): bigint {
  let hash = 0n;
  for (let i = 0; i < s.length; i++) hash = (hash * BIGN + charCode(s[i])) % MOD;
  return hash;
}

function power(base: bigint, exp: number, mod: bigint): bigint {
  let result = 1n, b = base % mod, e = exp;
  while (e > 0) { if (e % 2 === 1) result = (result * b) % mod; b = (b * b) % mod; e = Math.floor(e / 2); }
  return result;
}

export function rabinKarpSearch(text: string, pattern: string): { positions: number[]; comparisons: number } {
  const n = text.length, m = pattern.length;
  const positions: number[] = [];
  let comparisons = 0;
  if (m === 0 || m > n) return { positions, comparisons };

  const textLC = text.toLowerCase(), patLC = pattern.toLowerCase();
  const patHash = computeHash(patLC);
  const highPow = power(BIGN, m - 1, MOD);
  let windowHash = computeHash(textLC.slice(0, m));

  for (let s = 0; s <= n - m; s++) {
    if (windowHash === patHash) {
      let match = true;
      for (let j = 0; j < m; j++) { comparisons++; if (textLC[s + j] !== patLC[j]) { match = false; break; } }
      if (match) positions.push(s);
    }
    if (s < n - m)
      windowHash = ((windowHash - charCode(textLC[s]) * highPow % MOD + MOD) * BIGN + charCode(textLC[s + m])) % MOD;
  }
  return { positions, comparisons };
}

export function runRabinKarp(text: string, keyword: string): MatchResult {
  const start = performance.now();
  const { positions } = rabinKarpSearch(text, keyword);
  const end = performance.now();
  return { keyword, algorithm: 'RabinKarp', positions, count: positions.length, executionTimeMs: end - start };
}
