/* ============================================================
   designer.js — LABEL MAKER (desain & preview)
   Preview real-time, template placeholder, format khusus nama,
   kontrol tipografi, preset template & lembar label Indonesia,
   cek muat (overflow) + auto-fit font, dan navigasi halaman.
   ============================================================ */

// ============================================
// LABEL MAKER
// ============================================
function updatePreview() {
  const s = state.settings;
  // FIX: use toNum/toInt so 0 is accepted as a valid value for margins,
  // gaps, offset & radius (previously `|| default` rejected 0). Also clamp
  // to sane minimums so a bad value can never produce a broken/infinite grid.
  s.pageWidth = Math.max(10, toNum(document.getElementById('pageWidth').value, 210));
  s.pageHeight = Math.max(10, toNum(document.getElementById('pageHeight').value, 297));
  s.cols = Math.max(1, toInt(document.getElementById('labelCols').value, 2));
  s.rows = Math.max(1, toInt(document.getElementById('labelRows').value, 5));
  s.marginTop = Math.max(0, toNum(document.getElementById('marginTop').value, 12));
  s.marginLeft = Math.max(0, toNum(document.getElementById('marginLeft').value, 8));
  s.gapX = Math.max(0, toNum(document.getElementById('gapX').value, 4));
  s.gapY = Math.max(0, toNum(document.getElementById('gapY').value, 3));
  s.startOffset = Math.max(0, toInt(document.getElementById('startOffset').value, 0));
  s.fontSize = Math.max(1, toNum(document.getElementById('fontSize').value, 11));
  s.fontFamily = document.getElementById('fontFamily').value;
  s.template = document.getElementById('labelTemplate').value;
  s.showCutLines = document.getElementById('showCutLines').checked;
  s.showLabelNumber = document.getElementById('showLabelNumber').checked;
  s.rotateText = document.getElementById('rotateText').checked;
  s.duplicateCount = Math.max(1, toInt(document.getElementById('duplicateCount').value, 1));
  s.borderRadius = Math.max(0, toInt(document.getElementById('borderRadius').value, 0));

  const usableW = s.pageWidth - s.marginLeft * 2 - s.gapX * (s.cols - 1);
  const usableH = s.pageHeight - s.marginTop * 2 - s.gapY * (s.rows - 1);
  const labelW = usableW / s.cols;
  const labelH = usableH / s.rows;
  document.getElementById('labelSize').textContent = `${labelW.toFixed(1)} × ${labelH.toFixed(1)} mm`;

  autoSaveIfEnabled();

  if (state.entries.length === 0) {
    document.getElementById('previewContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏷️</div>
        <h3>Tidak ada data</h3>
        <p>Import data tamu di Text Manager terlebih dahulu</p>
      </div>`;
    document.getElementById('pageInfo').textContent = 'Halaman 1 / 1';
    document.getElementById('totalPages').textContent = '1';
    document.getElementById('totalLabels').textContent = '0';
    scheduleFitCheck();
    return;
  }

  renderPreviewPage();
  scheduleFitCheck();
}

function buildDisplayEntries() {
  const s = state.settings;
  const displayEntries = [];
  for (let i = 0; i < s.startOffset; i++) displayEntries.push(null);
  state.entries.forEach(e => {
    for (let d = 0; d < s.duplicateCount; d++) {
      displayEntries.push({ ...e, _dup: d > 0 });
    }
  });
  return displayEntries;
}

function renderPreviewPage() {
  const s = state.settings;
  const zoom = state.zoom;
  const perPage = s.cols * s.rows;

  const displayEntries = buildDisplayEntries();
  const totalPages = Math.ceil(displayEntries.length / perPage) || 1;

  if (state.currentPage >= totalPages) state.currentPage = totalPages - 1;
  if (state.currentPage < 0) state.currentPage = 0;

  document.getElementById('pageInfo').textContent = `Halaman ${state.currentPage + 1} / ${totalPages}`;
  document.getElementById('totalPages').textContent = totalPages;
  document.getElementById('totalLabels').textContent = displayEntries.filter(e => e).length;

  const pageEntries = displayEntries.slice(state.currentPage * perPage, (state.currentPage + 1) * perPage);

  const pageW = s.pageWidth * PX_PER_MM * zoom;
  const pageH = s.pageHeight * PX_PER_MM * zoom;

  let cells = '';
  for (let i = 0; i < perPage; i++) {
    const entry = pageEntries[i];
    const content = entry ? renderTemplate(entry, state.currentPage * perPage + i + 1) : '';
    const isEmpty = !entry;

    cells += `
      <div class="label-cell ${s.showCutLines ? 'bordered' : ''} ${isEmpty ? 'empty' : ''}"
           style="padding: ${s.padding * PX_PER_MM * zoom}px;
                  align-items: ${s.textAlign === 'center' ? 'center' : 'flex-start'};
                  justify-content: ${s.textAlign === 'center' ? 'center' : 'flex-start'};
                  border-radius: ${s.borderRadius * zoom}px;">
        ${entry ? `<div class="label-content" style="${getTextStyle(zoom)}">${content}</div>${s.showLabelNumber ? `<div style="position: absolute; top: 4px; right: 6px; font-size: ${8 * zoom}px; color: #999; font-weight: 600;">${state.currentPage * perPage + i + 1}</div>` : ''}` : ''}
      </div>
    `;
  }

  // FIX: CSS `gap` shorthand order is `row-gap column-gap`. "Jarak Baris"
  // (gapY) is the vertical/row gap and "Jarak Kolom" (gapX) is the
  // horizontal/column gap, so they must be written in that order — matching
  // the order already used correctly in buildPrintHTML(). Previously this was
  // reversed, so the live preview did not match the actual printed layout.
  const html = `
    <div class="page-sheet" style="width: ${pageW}px; height: ${pageH}px; padding: ${s.marginTop * PX_PER_MM * zoom}px ${s.marginLeft * PX_PER_MM * zoom}px;">
      <div class="label-grid" style="grid-template-columns: repeat(${s.cols}, 1fr); grid-template-rows: repeat(${s.rows}, 1fr); gap: ${s.gapY * PX_PER_MM * zoom}px ${s.gapX * PX_PER_MM * zoom}px;">
        ${cells}
      </div>
    </div>
  `;

  document.getElementById('previewContainer').innerHTML = html;
  markOverflowOnPreview();
}

// Token unik untuk menandai posisi {nama} sebelum escaping — tidak
// mungkin muncul di data tamu dan lolos escapeHtml tanpa berubah.
const NAME_TOKEN = '\u0001__NAMA__\u0001';
const BLANK_LINE_TOKEN = '\u0001__BARIS_KOSONG__\u0001';

function nameStyleCss() {
  const ns = state.settings.nameStyle || {};
  let css = '';
  if (ns.bold) css += 'font-weight:bold;';
  if (ns.italic) css += 'font-style:italic;';
  if (ns.underline) css += 'text-decoration:underline;';
  if (ns.scale && Number(ns.scale) !== 100) css += `font-size:${Number(ns.scale)}%;`;
  if (ns.color) css += `color:${ns.color};`;
  return css;
}

function renderTemplate(entry, num) {
  // Single-pass token replacement (function replacer) — aman terhadap
  // `$&`/`$1` di data tamu dan tidak double-expand placeholder.
  let nama = String(entry.nama ?? '');

  if (state.settings.format.uppercase) nama = nama.toUpperCase();
  if (state.settings.format.smallcaps) nama = nama.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  const nsCss = nameStyleCss();

  const map = {
    // Jika ada format khusus nama, sisipkan token dulu — span baru
    // disuntikkan SETELAH escapeHtml agar markup tidak ikut ter-escape
    // dan data tamu tidak bisa menyuntik HTML.
    nama: nsCss ? NAME_TOKEN : nama,
    jabatan: String(entry.jabatan ?? ''),
    di: String(entry.di ?? ''),
    alamat: String(entry.alamat ?? ''),
    keterangan: String(entry.keterangan ?? ''),
    nomor: String(num)
  };

  let text = state.settings.template.replace(
    /\{(nama|jabatan|di|alamat|keterangan|nomor|baris-kosong)\}/g,
    (m, key) => key === 'baris-kosong' ? BLANK_LINE_TOKEN : map[key]
  );

  // Buang baris yang benar-benar kosong; token nama dianggap kosong
  // bila nama aslinya kosong (agar perilaku identik tanpa format khusus).
  text = text.split('\n').filter(l => {
    const check = nsCss ? l.split(NAME_TOKEN).join(nama) : l;
    return check.split(BLANK_LINE_TOKEN).join('').trim() || l.includes(BLANK_LINE_TOKEN);
  }).join('\n');

  let html = escapeHtml(text).replace(/\n/g, '<br>').split(BLANK_LINE_TOKEN).join('&nbsp;');

  if (nsCss) {
    // FIX: baris baru (\n) di dalam nama (mis. hasil gabung 2 baris lewat
    // tombol "Gabung" di tabel) harus ikut dikonversi ke <br> di sini juga —
    // sebelumnya hanya \n di TEMPLATE (di luar {nama}) yang dikonversi
    // (baris 175, sebelum token nama diekspansi), jadi \n bawaan nama
    // sendiri lolos sebagai karakter mentah dan tampil sebagai spasi
    // (browser meng-collapse \n di HTML biasa) alih-alih baris baru.
    const nameHtml = `<span style="${nsCss}">${escapeHtml(nama).replace(/\n/g, '<br>')}</span>`;
    html = html.split(NAME_TOKEN).join(nameHtml);
  }

  return html;
}

function getTextStyle(zoom) {
  const s = state.settings;
  const f = s.format;
  return `
    font-family: ${s.fontFamily};
    font-size: ${s.fontSize * 1.333 * zoom}px;
    line-height: ${s.lineHeight};
    letter-spacing: ${s.letterSpacing * zoom}px;
    text-align: ${s.textAlign};
    color: ${s.color};
    font-weight: ${f.bold ? 'bold' : 'normal'};
    font-style: ${f.italic ? 'italic' : 'normal'};
    text-decoration: ${f.underline ? 'underline' : ''} ${f.strike ? 'line-through' : ''};
    ${s.rotateText ? 'writing-mode: vertical-rl; text-orientation: mixed;' : ''}
    width: 100%;
  `;
}

function toggleFormat(fmt) {
  state.settings.format[fmt] = !state.settings.format[fmt];
  document.getElementById('btn' + fmt.charAt(0).toUpperCase() + fmt.slice(1)).classList.toggle('active', state.settings.format[fmt]);
  updatePreview();
}

// ============================================
// FORMAT KHUSUS BARIS NAMA ({nama})
// ============================================
function toggleNameStyle(key) {
  state.settings.nameStyle[key] = !state.settings.nameStyle[key];
  const btn = document.getElementById('ns' + key.charAt(0).toUpperCase() + key.slice(1));
  if (btn) btn.classList.toggle('active', state.settings.nameStyle[key]);
  updatePreview();
}

function setNameColor(color) {
  state.settings.nameStyle.color = color;
  updatePreview();
}

function resetNameColor() {
  state.settings.nameStyle.color = '';
  const inp = document.getElementById('nsColor');
  if (inp) inp.value = '#000000';
  updatePreview();
  showToast('Warna nama kembali mengikuti warna teks label', 'success');
}

function updateNameScale(val) {
  state.settings.nameStyle.scale = Math.max(80, Math.min(200, parseInt(val, 10) || 100));
  document.getElementById('nsScaleValue').textContent = state.settings.nameStyle.scale + '%';
  updatePreview();
}

function setColor(color) {
  state.settings.color = color;
  document.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-color="${color}"]`)?.classList.add('active');
  updatePreview();
}

function setAlign(align, btn) {
  state.settings.textAlign = align;
  document.querySelectorAll('.format-toolbar button[data-align]').forEach(b => b.classList.remove('active'));
  const target = btn || document.querySelector(`.format-toolbar button[data-align="${align}"]`);
  target?.classList.add('active');
  updatePreview();
}

function updatePadding(val) {
  state.settings.padding = parseFloat(val);
  document.getElementById('paddingValue').textContent = val + 'mm';
  updatePreview();
}

function updateLineHeight(val) {
  state.settings.lineHeight = parseFloat(val);
  document.getElementById('lineHeightValue').textContent = val;
  updatePreview();
}

function updateLetterSpacing(val) {
  state.settings.letterSpacing = parseFloat(val);
  document.getElementById('letterSpacingValue').textContent = val + 'px';
  updatePreview();
}

function updateZoom(val) {
  state.zoom = parseFloat(val);
  document.getElementById('zoomValue').textContent = Math.round(val * 100) + '%';
  if (state.entries.length > 0) renderPreviewPage();
}

function changePage(dir) {
  // FIX: guard against empty data — previously this re-rendered the page
  // grid over the "Tidak ada data" empty state.
  if (state.entries.length === 0) return;
  const s = state.settings;
  const perPage = s.cols * s.rows;
  const displayCount = buildDisplayEntries().length;
  const totalPages = Math.ceil(displayCount / perPage) || 1;

  state.currentPage = Math.min(Math.max(state.currentPage + dir, 0), totalPages - 1);
  renderPreviewPage();
}

function saveTemplate() {
  localStorage.setItem('labelUndangan_settings', JSON.stringify(state.settings));
  showToast('Template berhasil disimpan', 'success');
}

// ============================================
// TEMPLATE LABEL — preset siap pakai & sisip placeholder
// ============================================
const TEMPLATE_PRESETS = {
  standar: 'Kepada Yth.\n{nama}\n{jabatan}\n{di}\n{alamat}',
  tanpaJabatan: 'Kepada Yth.\n{nama}\n{di}\n{alamat}',
  sederhana: '{nama}\n{di}\n{alamat}',
  lengkap: 'Kepada Yth.\n{nama}\n{jabatan}\n{keterangan}\n{di}\n{alamat}',
  bernomor: '{nomor}. {nama}\n{jabatan}\n{di}\n{alamat}'
};

function applyTemplatePreset(key) {
  if (!key || !TEMPLATE_PRESETS[key]) return;
  document.getElementById('labelTemplate').value = TEMPLATE_PRESETS[key];
  updatePreview();
  showToast('Preset template diterapkan — silakan sesuaikan bila perlu', 'success');
}

function resetTemplate() {
  document.getElementById('labelTemplate').value = DEFAULT_SETTINGS.template;
  const sel = document.getElementById('templatePreset');
  if (sel) sel.value = '';
  updatePreview();
  showToast('Template dikembalikan ke bawaan', 'success');
}

function insertPlaceholder(ph) {
  const ta = document.getElementById('labelTemplate');
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  ta.value = ta.value.slice(0, start) + ph + ta.value.slice(end);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + ph.length;
  updatePreview();
}

function insertBlankLine() {
  const ta = document.getElementById('labelTemplate');
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  const prefix = before && !before.endsWith('\n') ? '\n' : '';
  const suffix = after && !after.startsWith('\n') ? '\n' : '';
  const insertion = prefix + '{baris-kosong}' + suffix;
  ta.value = before + insertion + after;
  ta.focus();
  const cursor = before.length + insertion.length;
  ta.selectionStart = ta.selectionEnd = cursor;
  updatePreview();
}

// ============================================
// PRESET LEMBAR LABEL STANDAR INDONESIA
// Ukuran label nominal (No.103 = 32×64mm dst.) dipertahankan persis;
// ukuran halaman dihitung dari grid + margin + jarak.
// ============================================
const LABEL_PRESETS = {
  '103':    { labelW: 64, labelH: 32, cols: 3, rows: 4,  gapX: 2, gapY: 2, marginLeft: 6, marginTop: 8,  name: 'No. 103 (12 label)' },
  '121':    { labelW: 64, labelH: 38, cols: 2, rows: 5,  gapX: 3, gapY: 2, marginLeft: 8, marginTop: 8,  name: 'No. 121 (10 label)' },
  '127':    { labelW: 70, labelH: 35, cols: 2, rows: 5,  gapX: 3, gapY: 2, marginLeft: 8, marginTop: 8,  name: 'No. 127 (10 label)' },
  '104':    { labelW: 75, labelH: 24, cols: 2, rows: 8,  gapX: 3, gapY: 2, marginLeft: 8, marginTop: 8,  name: 'No. 104 (16 label)' },
  '107':    { labelW: 50, labelH: 18, cols: 3, rows: 10, gapX: 2, gapY: 2, marginLeft: 6, marginTop: 8,  name: 'No. 107 (30 label)' },
  'a4-2x5': { pageW: 210, pageH: 297, cols: 2, rows: 5,  gapX: 4, gapY: 3, marginLeft: 8, marginTop: 12, name: 'A4 2×5' },
  'f4-2x5': { pageW: 215, pageH: 330, cols: 2, rows: 5,  gapX: 4, gapY: 3, marginLeft: 8, marginTop: 12, name: 'F4 2×5' }
};

function applyLabelPreset(key) {
  const p = LABEL_PRESETS[key];
  if (!p) return;
  let pageW, pageH;
  if (p.pageW) {
    pageW = p.pageW; pageH = p.pageH;
  } else {
    // Halaman dihitung agar tiap label berukuran PERSIS nominal preset.
    pageW = p.cols * p.labelW + (p.cols - 1) * p.gapX + p.marginLeft * 2;
    pageH = p.rows * p.labelH + (p.rows - 1) * p.gapY + p.marginTop * 2;
  }
  document.getElementById('pageWidth').value = +pageW.toFixed(1);
  document.getElementById('pageHeight').value = +pageH.toFixed(1);
  document.getElementById('labelCols').value = p.cols;
  document.getElementById('labelRows').value = p.rows;
  document.getElementById('gapX').value = p.gapX;
  document.getElementById('gapY').value = p.gapY;
  document.getElementById('marginLeft').value = p.marginLeft;
  document.getElementById('marginTop').value = p.marginTop;
  updatePreview();
  showToast('Preset ' + p.name + ' diterapkan' + (p.labelW ? ' — label ' + p.labelH + '×' + p.labelW + ' mm' : ''), 'success');
}

// ============================================
// CEK MUAT (OVERFLOW) & AUTO-FIT FONT
// Mengukur SEMUA label pada skala cetak 1:1 di container tersembunyi,
// lalu menandai label yang teksnya terpotong.
// ============================================
let fitCheckTimer = null;
let overflowInfo = { indexes: new Set(), names: [] };

function measureOverflow() {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;';
  holder.innerHTML = buildPrintHTML();
  document.body.appendChild(holder);

  const displayEntries = buildDisplayEntries();
  const cells = holder.querySelectorAll('.pcell');
  const indexes = new Set();
  const names = [];
  cells.forEach((cell, i) => {
    if (i >= displayEntries.length || !displayEntries[i]) return;
    if (cell.scrollHeight > cell.clientHeight + 1 || cell.scrollWidth > cell.clientWidth + 1) {
      indexes.add(i);
      names.push('#' + (i + 1) + ' ' + displayEntries[i].nama);
    }
  });
  holder.remove();
  return { indexes, names };
}

function runFitCheck() {
  const badge = document.getElementById('fitBadge');
  const btn = document.getElementById('autoFitBtn');
  if (state.entries.length === 0) {
    badge.style.display = 'none';
    btn.style.display = 'none';
    overflowInfo = { indexes: new Set(), names: [] };
    return;
  }
  overflowInfo = measureOverflow();
  badge.style.display = 'inline-flex';
  const textEl = document.getElementById('fitBadgeText');
  if (overflowInfo.indexes.size === 0) {
    badge.className = 'badge fit-badge-ok';
    badge.querySelector('i').className = 'fas fa-check-circle';
    textEl.textContent = 'Semua teks muat';
    btn.style.display = 'none';
  } else {
    badge.className = 'badge fit-badge-warn';
    badge.querySelector('i').className = 'fas fa-exclamation-triangle';
    textEl.textContent = overflowInfo.indexes.size + ' label terpotong — klik untuk detail';
    btn.style.display = 'inline-flex';
  }
  markOverflowOnPreview();
}

function scheduleFitCheck() {
  clearTimeout(fitCheckTimer);
  fitCheckTimer = setTimeout(runFitCheck, 600);
}

// Tandai sel yang terpotong pada halaman preview yang sedang tampil
function markOverflowOnPreview() {
  const s = state.settings;
  const perPage = s.cols * s.rows;
  document.querySelectorAll('#previewContainer .label-cell').forEach((cell, i) => {
    const displayIdx = state.currentPage * perPage + i;
    cell.classList.toggle('overflow-warn', overflowInfo.indexes.has(displayIdx));
  });
}

function showOverflowDetails() {
  if (overflowInfo.indexes.size === 0) return;
  const list = overflowInfo.names.slice(0, 15).join('\n');
  const more = overflowInfo.names.length > 15 ? '\n… dan ' + (overflowInfo.names.length - 15) + ' lainnya' : '';
  alert('Label dengan teks terpotong (' + overflowInfo.names.length + '):\n\n' + list + more +
        '\n\nSolusi: klik "Auto-Fit Font", kecilkan ukuran font manual, perbesar ukuran label, atau kurangi padding.');
}

function autoFitFont() {
  if (state.entries.length === 0) return;
  const input = document.getElementById('fontSize');
  let size = toNum(input.value, 11);
  const MIN = 6;
  let iter = 0;
  let result = measureOverflow();
  while (result.indexes.size > 0 && size > MIN && iter < 30) {
    size = Math.max(MIN, +(size - 0.5).toFixed(1));
    input.value = size;
    state.settings.fontSize = size;
    result = measureOverflow();
    iter++;
  }
  updatePreview();
  if (result.indexes.size === 0) {
    showToast('Auto-fit selesai — ukuran font ' + size + 'pt, semua teks muat', 'success');
  } else {
    showToast('Font sudah minimum (' + MIN + 'pt), ' + result.indexes.size + ' label masih terpotong — perbesar label atau kurangi isi template', 'warning');
  }
}
