import '../styles/content.css';
import type { ExtMessage } from '../types';
import { runScan, toggleBlur, toggleOcr, startObserver } from './scanner';
import { clearHighlights } from './highlighter';
import { setupTooltipListeners } from './tooltip';

async function init(): Promise<void> {
  setupTooltipListeners();

  chrome.storage.local.get(['blurEnabled', 'ocrEnabled', 'autoScan'], (data) => {
    if (data['blurEnabled']) toggleBlur(true);
    if (data['ocrEnabled']) toggleOcr(true);

    if (data['autoScan'] !== false) {
      startObserver();
      runScan()
        .then((stats) => {
          chrome.runtime.sendMessage({ type: 'SCAN_COMPLETE', stats }).catch(() => {});
        })
        .catch((err) => console.error('[JudolDetector] Auto-scan error:', err));
    }
  });
}

chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  switch (msg.type) {
    case 'TRIGGER_SCAN': {
      runScan()
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
