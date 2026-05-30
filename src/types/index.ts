export type AlgorithmName =
  | 'KMP'
  | 'BoyerMoore'
  | 'Regex'
  | 'Levenshtein'
  | 'AhoCorasick'
  | 'RabinKarp'
  | 'OCR';

export interface MatchResult {
  keyword: string;
  algorithm: AlgorithmName;
  positions: number[];
  matchLengths?: number[];
  count: number;
  similarity?: number;
  executionTimeMs: number;
}

export interface OcrImageResult {
  src: string;
  extractedText: string;
  matchedKeywords: string[];
  executionTimeMs: number;
  censored: boolean;
}

export interface ScanStats {
  totalMatches: number;
  byAlgorithm: Partial<Record<AlgorithmName, number>>;
  byKeyword: Record<string, number>;
  executionTimeMs: Partial<Record<AlgorithmName, number>>;
  scannedAt: number;
  url: string;
  ocrImages?: OcrImageResult[];
}

export type ExtMessage =
  | { type: 'SCAN_COMPLETE'; stats: ScanStats }
  | { type: 'GET_STATS' }
  | { type: 'TRIGGER_SCAN' }
  | { type: 'TOGGLE_BLUR'; enabled: boolean }
  | { type: 'TOGGLE_OCR'; enabled: boolean }
  | { type: 'CLEAR_HIGHLIGHTS' };

export interface StorageState {
  lastStats: ScanStats | null;
  blurEnabled: boolean;
  ocrEnabled: boolean;
  autoScan: boolean;
}

export const VISUAL_WEIGHT_MAP: Record<string, Record<string, number>> = {
  o: { '0': 0.5, O: 0.3 },
  a: { '4': 0.5, '@': 0.4 },
  i: { '1': 0.5, l: 0.4, I: 0.3 },
  e: { '3': 0.5 },
  s: { '5': 0.5 },
  g: { '9': 0.5 },
  z: { '2': 0.5 },
};

export const LEVENSHTEIN_THRESHOLD = 0.85;
export const DEBOUNCE_MS = 300;
