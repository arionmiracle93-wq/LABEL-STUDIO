/* ============================================================
   printing.js — CETAK
   Membangun HTML cetak skala 1:1 (mm), @page dinamis, dan
   handler beforeprint. buildPrintHTML juga dipakai designer.js
   untuk pengukuran overflow (cek muat).
   ============================================================ */

function buildPrintHTML() {
  const s = state.settings;
  const perPage = s.cols * s.rows;
  const displayEntries = buildDisplayEntries();
  const totalPages = Math.ceil(displayEntries.length / perPage) || 1;

  let pagesHtml = '';
  for (let p = 0; p < totalPages; p++) {
    const pageEntries = displayEntries.slice(p * perPage, (p + 1) * perPage);
    let cells = '';
    for (let i = 0; i < perPage; i++) {
      const entry = pageEntries[i];
      const num = p * perPage + i + 1;
      const content = entry ? renderTemplate(entry, num) : '';
      cells += `
        <div class="pcell" style="
          box-sizing: border-box;
          padding: ${s.padding}mm;
          border-radius: ${s.borderRadius}px;
          ${s.showCutLines ? 'border: 1px dashed #cbd5e1;' : ''}
          display: flex;
          overflow: hidden;
          position: relative;
          align-items: ${s.textAlign === 'center' ? 'center' : 'flex-start'};
          justify-content: ${s.textAlign === 'center' ? 'center' : 'flex-start'};">
          ${entry ? `<div style="${getTextStyle(1)}">${content}</div>` : ''}
          ${entry && s.showLabelNumber ? `<div style="position:absolute; top:2px; right:4px; font-size:8px; color:#999; font-weight: 600;">${num}</div>` : ''}
        </div>
      `;
    }
    pagesHtml += `
      <div style="
        width: ${s.pageWidth}mm;
        height: ${s.pageHeight}mm;
        box-sizing: border-box;
        padding: ${s.marginTop}mm ${s.marginLeft}mm;
        page-break-after: ${p < totalPages - 1 ? 'always' : 'auto'};">
        <div style="
          display: grid;
          grid-template-columns: repeat(${s.cols}, 1fr);
          grid-template-rows: repeat(${s.rows}, 1fr);
          gap: ${s.gapY}mm ${s.gapX}mm;
          width: 100%;
          height: 100%;">
          ${cells}
        </div>
      </div>
    `;
  }

  return pagesHtml;
}

function ensurePrintReady() {
  const s = state.settings;
  let style = document.getElementById('pageStyle');
  if (!style) {
    style = document.createElement('style');
    style.id = 'pageStyle';
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${s.pageWidth}mm ${s.pageHeight}mm; margin: 0; }`;
  document.getElementById('printArea').innerHTML = buildPrintHTML();
}

function doPrint() {
  if (state.entries.length === 0) {
    showToast('Tidak ada data untuk dicetak. Tambahkan data tamu terlebih dahulu.', 'warning');
    return;
  }
  ensurePrintReady();
  window.print();
}

window.addEventListener('beforeprint', ensurePrintReady);
