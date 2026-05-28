let tooltipElement: HTMLDivElement | null = null;

function createTooltip() {
  if (tooltipElement) return;
  tooltipElement = document.createElement('div');
  tooltipElement.className = 'judol-tooltip';
  document.body.appendChild(tooltipElement);
}

export function showTooltip(e: MouseEvent, keyword: string, algorithm: string, count: string, time: string) {
  createTooltip();
  if (!tooltipElement) return;

  tooltipElement.innerHTML = `
    <strong>Keyword:</strong> ${keyword}<br>
    <strong>Algoritma:</strong> ${algorithm}<br>
    <strong>Count:</strong> ${count}<br>
    <strong>Waktu:</strong> ${time}
  `;
  
  const x = e.pageX;
  const y = e.pageY - tooltipElement.offsetHeight - 15;
  
  tooltipElement.style.left = `${x}px`;
  tooltipElement.style.top = `${y}px`;
  tooltipElement.classList.add('visible');
}

export function hideTooltip() {
  if (tooltipElement) {
    tooltipElement.classList.remove('visible');
  }
}

export function setupTooltipListeners() {
  document.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'MARK' && target.classList.contains('judol-highlight')) {
      const keyword = target.getAttribute('data-judol') || 'Unknown';
      const algorithm = target.getAttribute('data-algo') || 'Unknown';
      const count = target.getAttribute('data-count') || '1';
      const time = target.getAttribute('data-time') || '0ms';
      showTooltip(e as MouseEvent, keyword, algorithm, count, time);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'MARK' && target.classList.contains('judol-highlight')) {
      hideTooltip();
    }
  });

  document.addEventListener('mousemove', (e) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'MARK' && target.classList.contains('judol-highlight')) {
      if (tooltipElement && tooltipElement.classList.contains('visible')) {
        const x = e.pageX;
        const y = e.pageY - tooltipElement.offsetHeight - 15;
        tooltipElement.style.left = `${x}px`;
        tooltipElement.style.top = `${y}px`;
      }
    }
  });
}
