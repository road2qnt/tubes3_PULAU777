import type { MatchResult, ScanStats } from '../types';
import { DEBOUNCE_MS } from '../types';
import { runKMP } from '../algorithms/kmp';
import { runBoyerMoore } from '../algorithms/boyer-moore';
import { runRegex } from '../algorithms/regex-matcher';
import { runLevenshtein } from '../algorithms/weighted-levenshtein';
import { highlightTextNode, clearHighlights, setBlurMode } from './highlighter';
import { ocrScanAllImages, restoreCensoredImages, clearOcrCache, terminateOcrWorker } from '../algorithms/ocr';

const SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','CANVAS','SVG','VIDEO','AUDIO','HEAD','META','LINK','INPUT','TEXTAREA']);

let _keywords: string[] | null = null;

async function loadKeywords(): Promise<string[]> {
  if (_keywords) return _keywords;
  try {
    const url = chrome.runtime.getURL('keywords/keywords.txt');
    const res = await fetch(url);
    const text = await res.text();
    _keywords = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
    return _keywords;
  } catch (err) { console.error('[JudolDetector] Failed to load keywords:', err); return []; }
}

function getTextNodes(root: Element | Document): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.hasAttribute('data-judol')) return NodeFilter.FILTER_REJECT;
      if ((node.textContent ?? '').trim().length === 0) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  return nodes;
}

function scanTextSync(text: string, keywords: string[]): MatchResult[] {
  if (text.trim().length < 2) return [];
  const allResults: MatchResult[] = [];
  const textLC = text.toLowerCase();

  for (const kw of keywords) {
    if (kw.length < 2) continue;
    
    const kwLC = kw.toLowerCase();
    const mightHaveExact = textLC.includes(kwLC);
    
    let exactHit = false;
    const regexResult = runRegex(text, kw);
    const regexHit = regexResult.count > 0;

    if (mightHaveExact) {
      const kmpResult = runKMP(text, kw);
      const bmResult = runBoyerMoore(text, kw);
      
      if (kmpResult.count > 0 || bmResult.count > 0) {
        exactHit = true;
        if (kmpResult.count > 0) allResults.push(kmpResult);
        if (bmResult.count > 0) allResults.push(bmResult);
      }
    }
    if (regexHit) allResults.push(regexResult);
    if (!exactHit && !regexHit) { const fuzzyResult = runLevenshtein(text, kw); if (fuzzyResult) allResults.push(fuzzyResult); }
  }
  return allResults;
}

let blurEnabled = false;
let ocrEnabled = false;
let domObserver: MutationObserver | null = null;
let scanPromise: Promise<ScanStats> | null = null;

function withoutObserver(action: () => void) {
  if (domObserver) domObserver.disconnect();
  try {
    action();
  } finally {
    if (domObserver) domObserver.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
  }
}

export async function runScan(): Promise<ScanStats> {
  if (scanPromise) return scanPromise;

  scanPromise = (async () => {
    try {
      const keywords = await loadKeywords();
      
      withoutObserver(() => clearHighlights());

      const stats: ScanStats = { totalMatches: 0, byAlgorithm: {}, byKeyword: {}, executionTimeMs: {}, scannedAt: Date.now(), url: location.href };
      const freshNodes = getTextNodes(document.body || document.documentElement);

      // Eksekusi pseudo-multithreading dengan memecah antrean agar tidak memblokir UI Thread
      const chunkSize = 150;
      for (let i = 0; i < freshNodes.length; i += chunkSize) {
        const chunk = freshNodes.slice(i, i + chunkSize);
        await new Promise<void>(resolve => {
          setTimeout(() => {
            withoutObserver(() => {
              for (const node of chunk) {
                const results = scanTextSync(node.textContent ?? '', keywords);
                const bestPerKeyword = new Map<string, MatchResult>();
                for (const r of results) {
                  const existing = bestPerKeyword.get(r.keyword);
                  if (!existing || r.algorithm === 'KMP') bestPerKeyword.set(r.keyword, r);
                }
                for (const [, result] of bestPerKeyword) { if (result.count > 0) highlightTextNode(node, result); }
                for (const r of results) {
                  stats.totalMatches += r.count;
                  stats.byAlgorithm[r.algorithm] = (stats.byAlgorithm[r.algorithm] ?? 0) + r.count;
                  stats.byKeyword[r.keyword] = (stats.byKeyword[r.keyword] ?? 0) + r.count;
                  stats.executionTimeMs[r.algorithm] = (stats.executionTimeMs[r.algorithm] ?? 0) + r.executionTimeMs;
                }
              }
            });
            resolve();
          }, 0);
        });
      }

      if (blurEnabled) {
        setBlurMode(stats.totalMatches > 0);
      }
      
      if (ocrEnabled) {
        restoreCensoredImages(); 
        clearOcrCache();
        
        // JANGAN gunakan withoutObserver untuk OCR, biarkan Ekstensi tetap "Melihat" jika ada konten baru dimuat!
        const ocrResults = await ocrScanAllImages(keywords, blurEnabled);
        
        stats.ocrImages = ocrResults;
        let ocrTotalTime = 0, ocrMatchCount = 0;
        for (const r of ocrResults) {
          ocrTotalTime += r.executionTimeMs;
          for (const kw of r.matchedKeywords) { ocrMatchCount++; stats.byKeyword[kw] = (stats.byKeyword[kw] ?? 0) + 1; }
        }
        if (ocrMatchCount > 0) { 
          stats.byAlgorithm['OCR'] = ocrMatchCount; 
          stats.executionTimeMs['OCR'] = ocrTotalTime; 
          stats.totalMatches += ocrMatchCount; 
        }
        if (blurEnabled && stats.totalMatches > 0) {
          setBlurMode(true);
        }
      }
      return stats;
    } finally {
      scanPromise = null;
    }
  })();

  return scanPromise;
}

export function toggleBlur(enabled: boolean): void { blurEnabled = enabled; if (!enabled) setBlurMode(false); else runScan().catch(() => {}); }

export function toggleOcr(enabled: boolean): void {
  ocrEnabled = enabled;
  if (!enabled) { restoreCensoredImages(); clearOcrCache(); terminateOcrWorker().catch(() => {}); }
  else { runScan().catch(() => {}); }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function startObserver(): void {
  if (domObserver) return;
  domObserver = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { 
      runScan().then((stats) => { 
        chrome.runtime.sendMessage({ type: 'SCAN_COMPLETE', stats }).catch(() => {}); 
      }).catch(() => {}); 
    }, DEBOUNCE_MS);
  });
  domObserver.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
}
