import type { OcrImageResult } from '../types';
import { runKMP } from './kmp';
import { runBoyerMoore } from './boyer-moore';
import { runRegex } from './regex-matcher';
import { runLevenshtein } from './weighted-levenshtein';
import { createWorker } from 'tesseract.js'

const _censoredImages = new Map<
  HTMLImageElement,
  { originalSrc: string; originalStyle: string }
>();

const _ocrCache = new Map<string, string>();

console.log(
  "runtime:",
  chrome.runtime.getURL("")
);

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

let _workerPromise: Promise<TesseractWorker> | null = null;

function getWorker(): Promise<TesseractWorker> {
  console.log("[OCR] getWorker called");
  if (_workerPromise) {
    console.log("[OCR] reuse worker");
    return _workerPromise;
  }

  _workerPromise = (async () => {
    console.log("[OCR] before createWorker");
    try {
      const worker = await createWorker("eng");
      console.log("[OCR] worker created");
      return worker;
    } catch (err) {
      console.error("[OCR] createWorker failed", err);
      throw err;
    }
  })();
  return _workerPromise;
}

function getBase64FromImage(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (err) {
    return null; 
  }
}

function fetchImageViaBackground(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "FETCH_IMAGE",
        url
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        if (!response?.success) {
          reject(response?.error);
          return;
        }
        resolve(response.dataUrl);
      }
    );
  });
}

async function extractTextFromImage(img: HTMLImageElement): Promise<string> {
  console.log("[OCR] extractTextFromImage");
  const src = img.src || img.currentSrc;
  if (!src) return '';

  if (src.startsWith("data:image/svg+xml")) {
    _ocrCache.set(src, "");
    return "";
  }
  try {
    const url = new URL(src);
    if (url.pathname.toLowerCase().endsWith(".svg")) {
      _ocrCache.set(src, "");
      return "";
    }
  } catch {}

  if (_ocrCache.has(src)) return _ocrCache.get(src)!;
  try {
    const worker = await getWorker();
    
    let target = getBase64FromImage(img);
    
    if (!target) {
      try {
        target = await fetchImageViaBackground(src);
      } catch (err) {
        console.warn("[OCR] background fetch failed:", src, err);
        throw new Error("Gagal mengambil data gambar untuk OCR");
      }
    }
    const result = await worker.recognize(target);
    const text = result.data.text.trim();

    console.log(
      '[JudolDetector OCR] Hasil teks:',
      src.slice(0, 60),
      '->',
      text.slice(0, 80)
    );

    _ocrCache.set(src, text);
    return text;
  } catch (err) {
    console.warn('[JudolDetector OCR] Gagal baca gambar:', src, err);
    _ocrCache.set(src, '');
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
  console.log("[OCR] Total img:", images.length);
  
  const candidates = images.filter((img) => {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    console.log(
      img.src,
      img.naturalWidth,
      img.naturalHeight
    );
    return w >= 50 && h >= 50;
  });
  console.log("[OCR] Candidates:", candidates.length);

  const results: OcrImageResult[] = [];

  for (const img of candidates) {
    console.log("[OCR] Scan image:", img.src);
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
  } catch {
  } finally {
    _workerPromise = null;
  }
}