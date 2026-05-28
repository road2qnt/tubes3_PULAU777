import type { ExtMessage, ScanStats } from '../types';

document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scan-btn') as HTMLButtonElement;
  const blurToggle = document.getElementById('blur-toggle') as HTMLInputElement;
  const ocrToggle = document.getElementById('ocr-toggle') as HTMLInputElement;
  const resultsContent = document.getElementById('results-content') as HTMLDivElement;
  const loading = document.getElementById('loading') as HTMLDivElement;
  const algorithmSelect = document.getElementById('algorithm') as HTMLSelectElement;

  let currentStats: ScanStats | null = null;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
      if (response && response.stats) {
        if (currentTab.url && response.stats.url === currentTab.url) {
          currentStats = response.stats;
          displayStats(currentStats);
        } else {
          displayStats(null);
        }
      }
    });
  });

  algorithmSelect.addEventListener('change', () => {
    displayStats(currentStats);
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
             if ((response as any).error) {
                resultsContent.innerHTML = `<p class="empty-state" style="color: red;">Error: ${(response as any).error}</p>`;
             } else {
                currentStats = response.stats ? response.stats : response;
                displayStats(currentStats!);
             }
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

    const selectedAlgo = algorithmSelect.value;
    const matchCount = stats.byAlgorithm[selectedAlgo as keyof typeof stats.byAlgorithm] ?? 0;

    if (matchCount === 0) {
      resultsContent.innerHTML = `<p class="empty-state">Tidak ada match untuk algoritma ${selectedAlgo}.<br><small>Total semua algoritma: ${stats.totalMatches}</small></p>`;
      return;
    }

    let html = `<div class="stat-row">
      <span class="stat-label">Total Match (${selectedAlgo}):</span>
      <span class="stat-value">${matchCount}</span>
    </div>`;

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