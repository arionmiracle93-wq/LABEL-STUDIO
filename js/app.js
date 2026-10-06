/* ============================================================
   app.js — ORKESTRASI APLIKASI (WAJIB DIMUAT PALING AKHIR)
   Auto-save, sinkronisasi form, undo/redo, stepper alur kerja,
   pintasan keyboard, stepper angka custom, bantuan, dan INIT.
   ============================================================ */

// ============================================
// EDITOR DATA ACCORDION & UI HELPERS (v2 redesign)
// ============================================
function toggleEditorAccordion(headerEl, contentId) {
  headerEl.classList.toggle('active');
  // content is next sibling element; ensure visibility toggles correctly
  const content = document.getElementById(contentId);
  if (content) {
    // The CSS rule .ea-header.active + .ea-content handles display toggle
    // for the next-sibling relationship. When header toggles, the
    // adjacent-sibling selector automatically shows/hides content.
    // Nothing else needed here.
  }
}

// Update semua indikator UI counter di panel Editor Data
// Dipanggil setelah renderTable, select/deselect, filter.
function updateEditorCounters(filteredCount) {
  const total = state.entries.length;
  const selected = state.selected.size;

  // Counter header: jumlah tamu
  const ehcNum = document.getElementById('ehcNum');
  if (ehcNum) ehcNum.textContent = total;

  // Counter sub-header tabel
  const tsCount = document.getElementById('tsCount');
  if (tsCount) {
    if (typeof filteredCount === 'number' && filteredCount !== total) {
      tsCount.innerHTML = `Ditampilkan: <b>${filteredCount}</b> / ${total} baris`;
    } else {
      tsCount.innerHTML = `Total: <b>${total}</b> baris`;
    }
  }

  // Chip status Edit Massal (perlu pilih baris dulu atau sudah siap)
  const bulkChip = document.getElementById('eaBulkChip');
  if (bulkChip) {
    if (selected > 0) {
      bulkChip.textContent = `${selected} baris terpilih ✓`;
      bulkChip.classList.add('ea-chip-ready');
    } else {
      bulkChip.textContent = total > 0 ? 'Pilih baris dulu' : 'Belum ada data';
      bulkChip.classList.remove('ea-chip-ready');
    }
  }

  // Hint pencarian cepat
  const esHintText = document.getElementById('esHintText');
  if (esHintText) {
    const hasFilter = state.tableFilter && state.tableFilter.trim().length > 0;
    if (hasFilter) {
      const shown = typeof filteredCount === 'number' ? filteredCount : total;
      if (selected > 0) {
        esHintText.textContent = `${shown} hasil · ${selected} dicentang`;
      } else {
        esHintText.textContent = `${shown} hasil dari ${total} baris`;
      }
    } else {
      if (selected > 0) {
        esHintText.textContent = `${total} baris · ${selected} dicentang`;
      } else {
        esHintText.textContent = total > 0 ? `${total} baris siap diedit` : 'Semua baris ditampilkan';
      }
    }
  }

  if (typeof refreshWorkspaceOverview === 'function') refreshWorkspaceOverview();
}

function getThemeLabel(theme) {
  return theme === 'dark' ? 'Dark' :
    theme === 'glass' ? 'Glass' :
    theme === 'ai' ? 'Illustrator Slim' : 'Light';
}

function refreshWorkspaceOverview() {
  const total = state.entries.length;
  const selected = state.selected.size;
  const activeView = document.getElementById('viewLabel')?.classList.contains('active') ? 'label' : 'text';
  const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const tableFilter = (state.tableFilter || '').trim();
  const pageInfo = document.getElementById('pageInfo')?.textContent?.trim() || 'Halaman 1 / 1';
  const templateLabel = document.getElementById('templatePreset')?.selectedOptions?.[0]?.textContent?.trim()
    || 'Template kustom';

  const modeEl = document.getElementById('workspaceMode');
  const themeEl = document.getElementById('workspaceTheme');
  const guestsEl = document.getElementById('workspaceGuestCount');
  const focusEl = document.getElementById('workspaceFocus');
  const textGuestsEl = document.getElementById('textSectionGuests');
  const textSelectedEl = document.getElementById('textSectionSelected');
  const textFilterEl = document.getElementById('textSectionFilter');
  const labelGuestsEl = document.getElementById('labelSectionGuests');
  const labelPagesEl = document.getElementById('labelSectionPages');
  const labelTemplateEl = document.getElementById('labelSectionTemplate');

  if (modeEl) modeEl.textContent = activeView === 'label' ? 'Label Maker' : 'Text Manager';
  if (themeEl) themeEl.textContent = getThemeLabel(activeTheme);
  if (guestsEl) guestsEl.textContent = String(total);
  if (focusEl) {
    if (activeView === 'label') {
      focusEl.textContent = total > 0 ? `Preview ${pageInfo.replace('Halaman ', '')}` : 'Preview kosong';
    } else if (selected > 0) {
      focusEl.textContent = `${selected} baris dipilih`;
    } else if (tableFilter) {
      focusEl.textContent = `Filter: ${tableFilter}`;
    } else {
      focusEl.textContent = total > 0 ? `${total} data siap diedit` : 'Belum ada data';
    }
  }

  if (textGuestsEl) textGuestsEl.textContent = `${total} tamu`;
  if (textSelectedEl) textSelectedEl.textContent = `${selected} baris`;
  if (textFilterEl) textFilterEl.textContent = tableFilter ? `Filter: ${tableFilter}` : 'Semua baris';
  if (labelGuestsEl) labelGuestsEl.textContent = `${total} tamu`;
  if (labelPagesEl) labelPagesEl.textContent = total > 0 ? pageInfo.replace('Halaman ', '') : '1 / 1';
  if (labelTemplateEl) labelTemplateEl.textContent = templateLabel.replace(/\s+—.*$/, '');
}

// ============================================
// WORKFLOW STEPPER
// ============================================
function updateStepper() {
  const steps = document.querySelectorAll('#workflowStepper .step');
  const hasData = state.entries.length > 0;
  const labelViewActive = document.getElementById('viewLabel').classList.contains('active');

  steps.forEach(el => {
    const n = +el.dataset.step;
    el.classList.toggle('done', (n === 1 || n === 2) && hasData);
    el.classList.toggle('current',
      (!labelViewActive && (n === 1 || n === 2)) || (labelViewActive && (n === 3 || n === 4)));
  });

  document.getElementById('stepEditInfo').textContent = hasData
    ? state.entries.length + ' tamu siap' : 'Belum ada data';
  document.getElementById('stepImporInfo').textContent = hasData
    ? 'Selesai — bisa tambah lagi' : 'Tempel teks / unggah file';
  document.getElementById('stepCetakInfo').textContent = hasData
    ? 'Siap dicetak (Ctrl+P)' : 'Preview lalu cetak';
}

// ============================================
// AUTO-SAVE
// ============================================
function autoSaveIfEnabled(showFeedback) {
  const cb = document.getElementById('autoSave');
  if (!cb || !cb.checked) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem('labelUndangan_entries', JSON.stringify(state.entries));
      localStorage.setItem('labelUndangan_settings', JSON.stringify(state.settings));
      if (showFeedback) showToast('Auto-save diaktifkan', 'success');
    } catch (e) {
      console.warn('Auto-save gagal:', e);
    }
  }, 400);
}

function applySettingsToForm() {
  const s = state.settings;
  document.getElementById('pageWidth').value = s.pageWidth;
  document.getElementById('pageHeight').value = s.pageHeight;
  document.getElementById('labelCols').value = s.cols;
  document.getElementById('labelRows').value = s.rows;
  document.getElementById('marginTop').value = s.marginTop;
  document.getElementById('marginLeft').value = s.marginLeft;
  document.getElementById('gapX').value = s.gapX;
  document.getElementById('gapY').value = s.gapY;
  document.getElementById('paddingRange').value = s.padding;
  document.getElementById('paddingValue').textContent = s.padding + 'mm';
  document.getElementById('startOffset').value = s.startOffset;
  document.getElementById('fontSize').value = s.fontSize;
  document.getElementById('fontFamily').value = s.fontFamily;
  document.getElementById('labelTemplate').value = s.template;
  document.getElementById('showCutLines').checked = s.showCutLines;
  document.getElementById('showLabelNumber').checked = s.showLabelNumber;
  document.getElementById('rotateText').checked = s.rotateText;
  document.getElementById('duplicateCount').value = s.duplicateCount;
  document.getElementById('borderRadius').value = s.borderRadius;
  document.getElementById('lineHeightRange').value = s.lineHeight;
  document.getElementById('lineHeightValue').textContent = s.lineHeight;
  document.getElementById('letterSpacingRange').value = s.letterSpacing;
  document.getElementById('letterSpacingValue').textContent = s.letterSpacing + 'px';

  ['bold', 'italic', 'underline', 'strike', 'uppercase', 'smallcaps'].forEach(fmt => {
    const btn = document.getElementById('btn' + fmt.charAt(0).toUpperCase() + fmt.slice(1));
    if (btn) btn.classList.toggle('active', !!s.format[fmt]);
  });

  // Sinkronkan kontrol Format Khusus Baris Nama
  const ns = s.nameStyle || {};
  ['bold', 'italic', 'underline'].forEach(k => {
    const btn = document.getElementById('ns' + k.charAt(0).toUpperCase() + k.slice(1));
    if (btn) btn.classList.toggle('active', !!ns[k]);
  });
  const nsScaleEl = document.getElementById('nsScale');
  const nsScaleValEl = document.getElementById('nsScaleValue');
  if (nsScaleEl) nsScaleEl.value = ns.scale ?? 100;
  if (nsScaleValEl) nsScaleValEl.textContent = (ns.scale ?? 100) + '%';
  const nsColorEl = document.getElementById('nsColor');
  if (nsColorEl) nsColorEl.value = ns.color || '#000000';

  document.querySelectorAll('.format-toolbar button[data-align]').forEach(b => {
    b.classList.toggle('active', b.dataset.align === s.textAlign);
  });

  document.querySelectorAll('.color-option').forEach(c => {
    c.classList.toggle('active', c.dataset.color === s.color);
  });
  const customColor = document.getElementById('customColor');
  if (customColor) customColor.value = s.color;
}

// ============================================
// HISTORY (UNDO/REDO)
// FIX: the previous index-based implementation was fundamentally broken
// with the "save-before-mutate" call pattern used across the app:
//  - the CURRENT (post-mutation) state was never stored, so the first
//    undo skipped one step and redo restored the wrong (pre-mutation)
//    snapshot instead of re-applying the change;
//  - consecutive operations pushed duplicate snapshots, making undo
//    jump 2 steps at once.
// New implementation: classic undo-stack + redo-stack.
//  - saveHistory(): pushes the pre-mutation snapshot (deduped) and
//    clears the redo stack — all existing call sites stay valid.
//  - undo(): pushes the current state to the redo stack, restores the
//    most recent different snapshot.
//  - redo(): pushes current state back to the undo stack, restores the
//    snapshot captured by undo.
// ============================================
const HISTORY_LIMIT = 50;

function saveHistory() {
  const snap = JSON.stringify(state.entries);
  state.redoStack.length = 0; // any new action invalidates the redo branch
  if (state.history.length && state.history[state.history.length - 1] === snap) return; // dedup
  state.history.push(snap);
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
}

function refreshPreviewIfVisible() {
  const v = document.getElementById('viewLabel');
  if (v && v.classList.contains('active')) updatePreview();
}

function undo() {
  const current = JSON.stringify(state.entries);
  // Pop until we find a snapshot that actually differs from the current
  // state (skips no-op snapshots pushed by guarded/cancelled actions).
  let prev = null;
  while (state.history.length) {
    const cand = state.history.pop();
    if (cand !== current) { prev = cand; break; }
  }
  if (prev === null) {
    showToast('Tidak ada riwayat untuk di-undo', 'warning');
    return;
  }
  state.redoStack.push(current);
  if (state.redoStack.length > HISTORY_LIMIT) state.redoStack.shift();
  state.entries = JSON.parse(prev);
  state.selected.clear();
  renderTable();
  refreshPreviewIfVisible();
  showToast('Undo berhasil', 'success');
}

function redo() {
  if (state.redoStack.length === 0) {
    showToast('Tidak ada riwayat untuk di-redo', 'warning');
    return;
  }
  const current = JSON.stringify(state.entries);
  state.history.push(current);
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
  state.entries = JSON.parse(state.redoStack.pop());
  state.selected.clear();
  renderTable();
  refreshPreviewIfVisible();
  showToast('Redo berhasil', 'success');
}

// ============================================
// SAMPLE & HELP
// ============================================
function loadSample() {
  // Contoh mencakup semua kemampuan pembersih:
  // - "Kepada Yth"/"Di"/"Tempat"/"Di Tempat" (1 baris) dibuang
  // - daftar bernomor TANPA baris kosong tetap terpisah per nama
  // - nomor dash "3 - ...", bullet, emoji, telepon & garis pemisah dibuang
  // - nama bergelar dengan koma tetap utuh
  document.getElementById('rawInput').value = `Kepada Yth
bpk Ahmad Subagyo
Di Tempat

1. Ibu Siti Aminah, S.Pd.
2. sdr budi santoso
3 - Dewi Lestari, S.I.Kom. 🌸

------
Yth.
Kel. Hartono
0812-3456-7890
Di
Tempat

- Bpk. Drs., M.Ag. Bagus Firmansyah`;
  showToast('Contoh data dimuat ke kotak teks', 'success');
}

function showHelp() {
  alert(`Pintasan Keyboard:
Ctrl+Z: Undo
Ctrl+Y: Redo
Ctrl+P: Print

Fitur:
- Pembersihan nama berbasis SOP konverter Python + penyempurnaan: daftar bernomor tanpa baris kosong terpisah otomatis, "Di Tempat" 1 baris dikenali, emoji/telepon/garis pemisah/karakter tak terlihat dibuang, koma menggantung dibersihkan — nama bergelar dengan koma tetap utuh
- Import data dari Excel (semua sheet), Word, CSV, TXT
- Deteksi otomatis header tabel (Nama/Jabatan) pada file Excel/CSV
- Drag & drop file
- Format teks: Bold, Italic, Underline, Warna
- Template customizable
- Duplikat label otomatis
- Preview real-time
- Auto-save otomatis ke browser (aktifkan/nonaktifkan di panel Label Maker)
- 3 tema: Terang / Gelap / Glass frosted-blur (tombol di header & sidebar, siklus: terang→gelap→glass)
- Alat Bantu Teks: Cari & Ganti, Kapitalisasi, Awalan Nama (5 preset + kotak Custom bebas, bisa Tambah maupun Hapus), Urutkan A-Z, Rapikan Spasi, Hapus Duplikat, Cek Nama Terpanjang
- Edit Massal: terapkan 1 nilai ke banyak baris terpilih untuk kolom Nama, Jabatan, Di, Alamat, atau Keterangan
- Mode Mentah: tombol "Gabung" (baris tercentang) dan "Gabung 2 Baris" (otomatis pasangkan baris 1+2, 3+4, dst se-tabel) — hasil gabung tampil sebagai baris terpisah dalam 1 label
- Checkbox "Izinkan nama duplikat saat impor" di Text Manager, untuk kasus tamu berbeda dengan nama yang sama
- Pencarian cepat di tabel (kotak "Cari di tabel...")
- Format Khusus Baris Nama: bold/italic/underline/ukuran/warna hanya untuk {nama} (panel Tipografi)
- Teks Di/Alamat tersimpan otomatis + tombol "Terapkan ke Semua Data"
- Template Label: preset siap pakai + klik placeholder untuk sisipkan + reset
- Pengaturan Aplikasi (ikon gear di sidebar): tema, preset ukuran kertas, backup/pulihkan, reset
- Preset lembar label standar Indonesia (No. 103/121/127/104/107) di panel Ukuran Halaman
- Cek Muat otomatis: label dengan teks terpotong ditandai merah + tombol Auto-Fit Font
- Panduan 4 langkah di bagian atas (Impor - Edit - Desain - Cetak)
- Tekan Enter di tabel untuk pindah ke baris berikutnya (seperti spreadsheet)`);
}

// Keyboard shortcuts
// FIX: (1) don't hijack Ctrl+Z/Y while the user is typing inside an
// input/textarea/select — that stole the browser's native text-undo and
// wiped table data instead; (2) match keys case-insensitively so the
// shortcuts still work with Shift/CapsLock; (3) support Ctrl+Shift+Z as
// the common alternative for redo; (4) support Cmd on macOS.
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const k = e.key.toLowerCase();

  if (k === 'p') { e.preventDefault(); doPrint(); return; }

  const tag = (e.target && e.target.tagName || '').toLowerCase();
  const inField = tag === 'input' || tag === 'textarea' || tag === 'select' ||
                  (e.target && e.target.isContentEditable);
  if (inField) return; // let native undo/redo work inside form fields

  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});

// ============================================
// CUSTOM NUMBER STEPPER (UI only — no logic change)
// Replaces the tiny native spinners with big up/down buttons
// sized to match the input field. Clicking dispatches the same
// 'input' + 'change' events, so existing oninput handlers
// (updatePreview, etc.) keep working exactly as before.
// ============================================
function enhanceNumberInputs() {
  document.querySelectorAll('input[type="number"]').forEach(inp => {
    if (inp.closest('.num-stepper')) return; // already enhanced

    const wrap = document.createElement('div');
    wrap.className = 'num-stepper';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);

    const btns = document.createElement('div');
    btns.className = 'num-btns';

    function makeBtn(dir, iconCls, label) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'num-btn';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.tabIndex = -1;
      b.innerHTML = '<i class="fas ' + iconCls + '"></i>';

      const doStep = () => {
        try { dir > 0 ? inp.stepUp() : inp.stepDown(); } catch (e) {}
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      };

      // Click + press-and-hold repeat
      let holdTimer = null, repeatTimer = null;
      const stopHold = () => { clearTimeout(holdTimer); clearInterval(repeatTimer); holdTimer = repeatTimer = null; };
      b.addEventListener('pointerdown', e => {
        e.preventDefault();
        doStep();
        holdTimer = setTimeout(() => { repeatTimer = setInterval(doStep, 70); }, 450);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stopHold));
      return b;
    }

    btns.appendChild(makeBtn(1, 'fa-chevron-up', 'Tambah nilai'));
    btns.appendChild(makeBtn(-1, 'fa-chevron-down', 'Kurangi nilai'));
    wrap.appendChild(btns);
  });
}

// ============================================
// INIT — restore auto-saved data (if any) before first render.
// ============================================
(function init() {
  try {
    const savedEntries = localStorage.getItem('labelUndangan_entries');
    const savedSettings = localStorage.getItem('labelUndangan_settings');
    if (savedEntries) {
      const parsed = JSON.parse(savedEntries);
      // FIX: sanitize restored entries — auto-saves written by older
      // versions could contain numeric/null fields (from Excel/JSON
      // imports) which crashed .trim()/.replace() in the text tools and
      // table render. Coerce everything to strings and ensure valid ids.
      if (Array.isArray(parsed)) {
        state.entries = parsed
          .filter(r => r && typeof r === 'object')
          .map((r, i) => ({
            id: typeof r.id === 'number' && Number.isFinite(r.id) ? r.id : Date.now() + i + Math.random(),
            nama: String(r.nama ?? ''),
            jabatan: String(r.jabatan ?? ''),
            di: String(r.di ?? 'Di'),
            alamat: String(r.alamat ?? 'Tempat'),
            keterangan: String(r.keterangan ?? '')
          }));
      }
    }
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (parsed && typeof parsed === 'object') {
        Object.assign(state.settings, parsed);
        // FIX: guarantee the format sub-object always has every key —
        // a partially-saved settings blob previously left format flags
        // undefined, breaking toggleFormat's button state sync.
        state.settings.format = Object.assign(
          { bold: false, italic: false, underline: false, strike: false, uppercase: false, smallcaps: false },
          (parsed.format && typeof parsed.format === 'object') ? parsed.format : {}
        );
        // FIX: pastikan nameStyle selalu lengkap — settings lama yang
        // tersimpan sebelum fitur ini ada tidak memiliki objek nameStyle.
        state.settings.nameStyle = Object.assign(
          { bold: false, italic: false, underline: false, scale: 100, color: '' },
          (parsed.nameStyle && typeof parsed.nameStyle === 'object') ? parsed.nameStyle : {}
        );
      }
    }
  } catch (e) {
    console.warn('Gagal memuat data auto-save:', e);
  }

  restoreBoilerplate();
  applySettingsToForm();
  enhanceNumberInputs();
  renderTable();
  refreshWorkspaceOverview();
  saveHistory(); // baseline snapshot for undo
})();
