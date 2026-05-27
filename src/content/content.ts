import { runScan, startObserver, toggleBlur, toggleOcr } from './scanner';
import { setupTooltipListeners } from './tooltip';
import type { ExtMessage } from '../types';

// Initialize features
setupTooltipListeners();

// Load initial states and start
chrome.storage.local.get(['blurEnabled', 'ocrEnabled'], (data) => {
  if (data.blurEnabled) {
    toggleBlur(true);
  }
  if (data.ocrEnabled) {
    toggleOcr(true);
  }
  
  // Start the mutation observer to automatically scan new content
  startObserver();
  
  // Run initial scan
  runScan().then((stats) => {
    chrome.runtime.sendMessage({ type: 'SCAN_COMPLETE', stats }).catch(() => {});
  });
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  if (msg.type === 'TRIGGER_SCAN') {
    runScan().then(stats => {
      chrome.runtime.sendMessage({ type: 'SCAN_COMPLETE', stats }).catch(() => {});
      sendResponse(stats);
    });
    return true; // Keep the message channel open for async response
  }
  
  if (msg.type === 'TOGGLE_BLUR') {
    toggleBlur(msg.enabled);
    sendResponse({ ok: true });
    return false;
  }
  
  if (msg.type === 'TOGGLE_OCR') {
    toggleOcr(msg.enabled);
    sendResponse({ ok: true });
    return false;
  }
});