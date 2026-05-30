import '../styles/content.css';
import type { ExtMessage, ScanStats } from '../types';
import { runScan, toggleBlur, toggleOcr, startObserver } from './scanner';
import { clearHighlights } from './highlighter';
import { setupTooltipListeners } from './tooltip';
import { runKMP } from '../algorithms/kmp';
import { runBoyerMoore } from '../algorithms/boyer-moore';
import { runRegex } from '../algorithms/regex-matcher';

let _extraKeywords: string[] | null = null;

async function loadKeywordsForExtra(): Promise<string[]> {
  if (_extraKeywords) return _extraKeywords;
  try {
    const url = chrome.runtime.getURL('keywords/keywords.txt');
    console.log('[JudolDetector] Fetching keywords from:', url);
    const res = await fetch(url);
    const text = await res.text();
    _extraKeywords = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    console.log('[JudolDetector] Loaded', _extraKeywords.length, 'keywords. First 10:', _extraKeywords.slice(0, 10));
    return _extraKeywords;
  } catch (err) {
    console.error('[JudolDetector] Failed to load keywords:', err);
    return [];
  }
}

async function scanExtraSources(): Promise<Partial<ScanStats>> {
  const keywords = await loadKeywordsForExtra();
  const extra: Partial<ScanStats> = {
    totalMatches: 0,
    byAlgorithm: {},
    byKeyword: {},
    executionTimeMs: {},
  };

  const inputValues = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
  )
    .map((el) => el.value)
    .filter((v) => v.trim().length > 1);

  const sources: string[] = [location.href, document.title, ...inputValues];

  console.log('[JudolDetector] scanExtraSources — scanning sources:', sources);

  for (const text of sources) {
    if (!text || text.trim().length < 2) continue;
    for (const kw of keywords) {
      if (kw.length < 2) continue;

      const kmpResult = runKMP(text, kw);
      const bmResult = runBoyerMoore(text, kw);
      const regexResult = runRegex(text, kw);

      const hits = [
        ...(kmpResult.count > 0 ? [kmpResult] : []),
        ...(bmResult.count > 0 ? [bmResult] : []),
        ...(regexResult.count > 0 ? [regexResult] : []),
      ];

      if (hits.length > 0) {
        console.log('[JudolDetector] EXTRA HIT — kw:', kw, '| source:', text.slice(0, 80), '| hits:', hits.map(h => h.algorithm + ':' + h.count));
      }

      for (const r of hits) {
        extra.totalMatches! += r.count;
        extra.byAlgorithm![r.algorithm] = (extra.byAlgorithm![r.algorithm] ?? 0) + r.count;
        extra.byKeyword![r.keyword] = (extra.byKeyword![r.keyword] ?? 0) + r.count;
        extra.executionTimeMs![r.algorithm] =
          (extra.executionTimeMs![r.algorithm] ?? 0) + r.executionTimeMs;
      }
    }
  }

  console.log('[JudolDetector] scanExtraSources result — totalMatches:', extra.totalMatches, '| byKeyword:', extra.byKeyword);
  return extra;
}

function mergeStats(main: ScanStats, extra: Partial<ScanStats>): ScanStats {
  const merged = { ...main };
  merged.totalMatches += extra.totalMatches ?? 0;
  for (const [algo, count] of Object.entries(extra.byAlgorithm ?? {})) {
    (merged.byAlgorithm as Record<string, number>)[algo] =
      ((merged.byAlgorithm as Record<string, number>)[algo] ?? 0) + count;
  }
  for (const [kw, count] of Object.entries(extra.byKeyword ?? {})) {
    merged.byKeyword[kw] = (merged.byKeyword[kw] ?? 0) + count;
  }
  for (const [algo, ms] of Object.entries(extra.executionTimeMs ?? {})) {
    (merged.executionTimeMs as Record<string, number>)[algo] =
      ((merged.executionTimeMs as Record<string, number>)[algo] ?? 0) + ms;
  }
  console.log('[JudolDetector] mergeStats — final totalMatches:', merged.totalMatches, '| byKeyword:', merged.byKeyword);
  return merged;
}

async function fullScan(): Promise<ScanStats> {
  console.log('[JudolDetector] fullScan() started — URL:', location.href);
  const [mainStats, extraStats] = await Promise.all([runScan(), scanExtraSources()]);
  console.log('[JudolDetector] runScan() result — totalMatches:', mainStats.totalMatches);
  return mergeStats(mainStats, extraStats);
}

async function init(): Promise<void> {
  setupTooltipListeners();

  chrome.storage.local.get(['blurEnabled', 'ocrEnabled', 'autoScan'], (data) => {
    if (data['blurEnabled']) toggleBlur(true);
    if (data['ocrEnabled']) toggleOcr(true);

    if (data['autoScan'] !== false) {
      // startObserver();  dimatikan karena sensor image jadi kedap-kedip
      fullScan()
        .then((stats) => {
          if (chrome.runtime?.id) {
            chrome.runtime.sendMessage({
              type: 'SCAN_COMPLETE',
              stats
            }).catch(() => {});
          }
        })
        .catch((err) => console.error('[JudolDetector] Auto-scan error:', err));
    }
  });
}

chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  switch (msg.type) {
    case 'TRIGGER_SCAN': {
      fullScan()
        .then((stats) => {
          chrome.runtime.sendMessage({ type: 'SCAN_COMPLETE', stats }).catch(() => {});
          sendResponse({ ok: true, stats });
        })
        .catch((err) => {
          console.error('[JudolDetector] Scan error:', err);
          sendResponse({ ok: false, error: String(err) });
        });
      return true;
    }

    case 'CLEAR_HIGHLIGHTS': {
      clearHighlights();
      sendResponse({ ok: true });
      break;
    }

    case 'TOGGLE_BLUR': {
      toggleBlur(msg.enabled);
      chrome.storage.local.set({ blurEnabled: msg.enabled });
      sendResponse({ ok: true });
      break;
    }

    case 'TOGGLE_OCR': {
      toggleOcr(msg.enabled);
      chrome.storage.local.set({ ocrEnabled: msg.enabled });
      sendResponse({ ok: true });
      break;
    }

    default:
      break;
  }
});

init();
