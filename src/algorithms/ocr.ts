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

let _schedulerPromise: Promise<any> | null = null;

function getScheduler(): Promise<any> {
  if (_schedulerPromise) return _schedulerPromise;

  _schedulerPromise = (async () => {
    const Tesseract = await import('tesseract.js');
    const scheduler = Tesseract.createScheduler();

    const workerPath = chrome.runtime.getURL('tesseract-worker.js');
    const langPath = 'https://tessdata.projectnaptha.com/4.0.0';
    const corePath = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4/tesseract-core.wasm.js';

    // Buat pekerja berdasarkan ketersediaan core CPU untuk Multithreading
    const numWorkers = Math.min(4, navigator.hardwareConcurrency || 2);
    for (let i = 0; i < numWorkers; i++) {
      // Tesseract.js v5+ menggabungkan loadLanguage dan initialize ke dalam parameter createWorker
      const worker = await Tesseract.createWorker('eng', 1, {
        workerPath,
        langPath,
        corePath,
        logger: () => {}, // silent
      });
      scheduler.addWorker(worker);
    }
    return scheduler;
  })();

  return _schedulerPromise;
}

async function getSafeImageData(img: HTMLImageElement): Promise<string | Blob | HTMLImageElement> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.8);
    }
  } catch (e) {
    try {
      const res = await fetch(img.src);
      return await res.blob();
    } catch (err) {}
  }
  return img;
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
  const candidates = images.filter((img) => {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    return w >= 50 && h >= 50;
  });

  const results: OcrImageResult[] = [];
  if (candidates.length === 0) return results;

  const scheduler = await getScheduler();

  const promises = candidates.map(async (img) => {
    const src = img.src || img.currentSrc;
    if (!src) return;

    let extractedText = '';
    let executionTimeMs = 0;

    if (_ocrCache.has(src)) {
      extractedText = _ocrCache.get(src)!;
    } else {
      try {
        const t0 = performance.now();
        const safeImage = await getSafeImageData(img);
        const result = await scheduler.addJob('recognize', safeImage);
        extractedText = result.data.text.trim();
        executionTimeMs = performance.now() - t0;
        _ocrCache.set(src, extractedText);
      } catch (err) {
        console.warn('[JudolDetector OCR] Gagal baca gambar:', src, err);
        _ocrCache.set(src, '');
      }
    }

    const matchedKeywords = extractedText.length > 0
      ? matchTextAgainstKeywords(extractedText, keywords)
      : [];

    const hasmatch = matchedKeywords.length > 0;

    if (hasmatch && censor) {
      censorImage(img);
    }

    results.push({
      src,
      extractedText,
      matchedKeywords,
      executionTimeMs,
      censored: hasmatch && censor,
    });
  });

  // Eksekusi pekerjaan secara konkuren (multithreading)
  await Promise.all(promises);

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
  if (!_schedulerPromise) return;
  try {
    const scheduler = await _schedulerPromise;
    await scheduler.terminate();
  } catch (_) {}
  finally {
    _schedulerPromise = null;
  }
}