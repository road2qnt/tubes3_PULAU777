import type { OcrImageResult } from '../types';
import { runKMP } from './kmp';
import { runBoyerMoore } from './boyer-moore';
import { runRegex } from './regex-matcher';
import { runLevenshtein } from './weighted-levenshtein';

const _censoredImages = new Map<
  HTMLImageElement,
  { originalSrc: string; originalStyle: string }
>();

const _ocrCache = new Map<string, string>();

declare const Tesseract: {
  recognize(
    image: string | HTMLImageElement | Blob,
    lang: string,
    options?: { workerPath?: string; langPath?: string; corePath?: string }
  ): Promise<{ data: { text: string } }>;
  createWorker(options?: Record<string, unknown>): Promise<TesseractWorker>;
};

interface TesseractWorker {
  loadLanguage(lang: string): Promise<void>;
  initialize(lang: string): Promise<void>;
  recognize(image: string | HTMLImageElement): Promise<{ data: { text: string } }>;
  terminate(): Promise<void>;
}

let _workerPromise: Promise<TesseractWorker> | null = null;

function getWorker(): Promise<TesseractWorker> {
  if (_workerPromise) return _workerPromise;

  _workerPromise = (async () => {
    const workerPath = chrome.runtime.getURL('tesseract-worker.js');
    const langPath = 'https://tessdata.projectnaptha.com/4.0.0';
    const corePath = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4/tesseract-core.wasm.js';

    const worker: TesseractWorker = await Tesseract.createWorker({
      workerPath,
      langPath,
      corePath,
      logger: () => {}, // silent
    });

    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    return worker;
  })();

  return _workerPromise;
}

async function extractTextFromImage(img: HTMLImageElement): Promise<string> {
  const src = img.src || img.currentSrc;
  if (!src) return '';

  // Pakai cache kalau sudah pernah di-scan
  if (_ocrCache.has(src)) return _ocrCache.get(src)!;

  try {
    const worker = await getWorker();
    const result = await worker.recognize(img);
    const text = result.data.text.trim();
    _ocrCache.set(src, text);
    return text;
  } catch (err) {
    console.warn('[JudolDetector OCR] Gagal baca gambar:', src, err);
    _ocrCache.set(src, ''); // cache string kosong agar tidak retry terus
    return '';
  }
}

function matchTextAgainstKeywords(text: string, keywords: string[]): string[] {
  const matched = new Set<string>();

  for (const kw of keywords) {
    if (kw.length < 2) continue;

    const kmpResult = runKMP(text, kw);
    const bmResult = runBoyerMoore(text, kw);
    const regexResult = runRegex(text, kw);

    const exactHit = kmpResult.count > 0 || bmResult.count > 0;
    const regexHit = regexResult.count > 0;

    if (exactHit || regexHit) {
      matched.add(kw);
      continue;
    }

    // Fuzzy fallback
    const fuzzy = runLevenshtein(text, kw);
    if (fuzzy && fuzzy.count > 0) {
      matched.add(kw);
    }
  }

  return [...matched];
}

function censorImage(img: HTMLImageElement): void {
  if (_censoredImages.has(img)) return;

  _censoredImages.set(img, {
    originalSrc: img.src,
    originalStyle: img.getAttribute('style') ?? '',
  });

  img.setAttribute('data-judol-censored', 'true');
  img.style.filter = 'blur(16px)';
  img.style.opacity = '0.3';
  img.title = '[JudolDetector] Gambar ini mengandung konten judol';
}

export async function ocrScanAllImages(
  keywords: string[],
  censor = false
): Promise<OcrImageResult[]> {
  const images = Array.from(document.querySelectorAll<HTMLImageElement>('img'));
  // Filter gambar yang terlalu kecil (kemungkinan icon/dekorasi)
  const candidates = images.filter((img) => {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    return w >= 50 && h >= 50;
  });

  const results: OcrImageResult[] = [];

  for (const img of candidates) {
    const t0 = performance.now();
    const extractedText = await extractTextFromImage(img);
    const matchedKeywords = extractedText.length > 0
      ? matchTextAgainstKeywords(extractedText, keywords)
      : [];
    const executionTimeMs = performance.now() - t0;

    const hasmatch = matchedKeywords.length > 0;

    if (hasmatch && censor) {
      censorImage(img);
    }

    results.push({
      src: img.src || img.currentSrc,
      extractedText,
      matchedKeywords,
      executionTimeMs,
      censored: hasmatch && censor,
    });
  }

  return results;
}

export function restoreCensoredImages(): void {
  for (const [img, saved] of _censoredImages) {
    img.src = saved.originalSrc;
    if (saved.originalStyle) {
      img.setAttribute('style', saved.originalStyle);
    } else {
      img.removeAttribute('style');
    }
    img.removeAttribute('data-judol-censored');
    img.removeAttribute('title');
  }
  _censoredImages.clear();
}

export function clearOcrCache(): void {
  _ocrCache.clear();
}

export async function terminateOcrWorker(): Promise<void> {
  if (!_workerPromise) return;
  try {
    const worker = await _workerPromise;
    await worker.terminate();
  } catch (_) {}
  finally {
    _workerPromise = null;
  }
}