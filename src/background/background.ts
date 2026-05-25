import type { ExtMessage, ScanStats, StorageState } from '../types';

const DEFAULT_STATE: StorageState = { lastStats: null, blurEnabled: false, ocrEnabled: false, autoScan: true };

chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  if (msg.type === 'SCAN_COMPLETE') { chrome.storage.local.set({ lastStats: msg.stats }); sendResponse({ ok: true }); return true; }
  if (msg.type === 'GET_STATS') { chrome.storage.local.get('lastStats', (data) => { sendResponse({ stats: data['lastStats'] as ScanStats | null }); }); return true; }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(Object.keys(DEFAULT_STATE), (existing) => {
    const toSet: Partial<StorageState> = {};
    for (const [k, v] of Object.entries(DEFAULT_STATE)) { if (!(k in existing)) (toSet as Record<string, unknown>)[k] = v; }
    if (Object.keys(toSet).length > 0) chrome.storage.local.set(toSet);
  });
});
