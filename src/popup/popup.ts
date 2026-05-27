import type { ExtMessage, ScanStats } from '../types';

document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scan-btn') as HTMLButtonElement;
  const blurToggle = document.getElementById('blur-toggle') as HTMLInputElement;
  const ocrToggle = document.getElementById('ocr-toggle') as HTMLInputElement;
  const resultsContent = document.getElementById('results-content') as HTMLDivElement;
  const loading = document.getElementById('loading') as HTMLDivElement;
  // NOTE: Algorithm select is part of the UI but algorithms are run in parallel currently.
  // We keep it for visual completeness.

  // Initial load
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
    if (response && response.stats) {
      displayStats(response.stats);
    }
  });

  chrome.storage.local.get(['blurEnabled', 'ocrEnabled'], (data) => {
    blurToggle.checked = !!data.blurEnabled;
    ocrToggle.checked = !!data.ocrEnabled;
  });

  scanBtn.addEventListener('click', async () => {
    loading.classList.remove('hidden');
    resultsContent.classList.add('hidden');
    scanBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_SCAN' } as ExtMessage, (response) => {
          if (chrome.runtime.lastError) {
             console.error(chrome.runtime.lastError);
             resultsContent.innerHTML = '<p class="empty-state">Content script tidak ditemukan. Coba refresh halaman.</p>';
          } else if (response) {
             displayStats(response.stats ? response.stats : response);
          }
          loading.classList.add('hidden');
          resultsContent.classList.remove('hidden');
          scanBtn.disabled = false;
        });
      }
    } catch (err) {
      console.error(err);
      loading.classList.add('hidden');
      resultsContent.classList.remove('hidden');
      scanBtn.disabled = false;
    }
  });

  blurToggle.addEventListener('change', async () => {
    const enabled = blurToggle.checked;
    chrome.storage.local.set({ blurEnabled: enabled });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_BLUR', enabled } as ExtMessage);
    }
  });

  ocrToggle.addEventListener('change', async () => {
    const enabled = ocrToggle.checked;
    chrome.storage.local.set({ ocrEnabled: enabled });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OCR', enabled } as ExtMessage);
    }
  });

  function displayStats(stats: ScanStats) {
    if (!stats || stats.totalMatches === 0) {
      resultsContent.innerHTML = '<p class="empty-state">Aman! Tidak ada indikasi judol ditemukan.</p>';
      return;
    }

    let html = `<div class="stat-row">
      <span class="stat-label">Total Match:</span>
      <span class="stat-value">${stats.totalMatches}</span>
    </div>`;

    if (stats.byAlgorithm && Object.keys(stats.byAlgorithm).length > 0) {
      html += `<div style="margin-top: 10px; font-weight: bold; font-size: 0.85rem; color: #555;">Berdasarkan Algoritma:</div>`;
      for (const [algo, count] of Object.entries(stats.byAlgorithm)) {
        html += `<div class="stat-row">
          <span class="stat-label">${algo}:</span>
          <span class="stat-value">${count}</span>
        </div>`;
      }
    }
    
    if (stats.byKeyword && Object.keys(stats.byKeyword).length > 0) {
      html += `<div style="margin-top: 10px; font-weight: bold; font-size: 0.85rem; color: #555;">Top Keywords:</div>`;
      const sortedKw = Object.entries(stats.byKeyword).sort((a, b) => b[1] - a[1]).slice(0, 5);
      for (const [kw, count] of sortedKw) {
         html += `<div class="stat-row">
          <span class="stat-label">${kw}:</span>
          <span class="stat-value">${count}</span>
        </div>`;
      }
    }

    resultsContent.innerHTML = html;
  }
});