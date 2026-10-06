/* ============================================================
   state.js — STATE MANAGEMENT & HELPER DASAR
   Sumber kebenaran tunggal aplikasi (data tamu, pengaturan label,
   riwayat undo/redo) + helper parsing angka & id.
   KONTRAK: semua nama di file ini adalah GLOBAL (dipakai semua modul).
   ============================================================ */

const state = {
  entries: [],
  selected: new Set(),
  history: [],      // undo stack: snapshots of pre-mutation states
  redoStack: [],    // redo stack: snapshots captured on undo
  currentPage: 0,
  tableFilter: '',
  settings: {
    pageWidth: 210,
    pageHeight: 297,
    cols: 2,
    rows: 5,
    marginTop: 12,
    marginLeft: 8,
    gapX: 4,
    gapY: 3,
    padding: 4,
    startOffset: 0,
    fontSize: 11,
    fontFamily: 'Arial, sans-serif',
    textAlign: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
    color: '#000000',
    format: { bold: false, italic: false, underline: false, strike: false, uppercase: false, smallcaps: false },
    // Format khusus baris nama — berlaku hanya pada {nama} di template.
    // color '' = ikuti warna teks label; scale dalam persen (100 = sama).
    nameStyle: { bold: false, italic: false, underline: false, scale: 100, color: '' },
    template: 'Kepada Yth.\n{nama}\n{jabatan}\n{di}\n{alamat}',
    showCutLines: true,
    showLabelNumber: false,
    rotateText: false,
    duplicateCount: 1,
    borderRadius: 0
  },
  zoom: 0.7
};

const PX_PER_MM = 3.7795275591;
let autoSaveTimer = null;

// Snapshot pengaturan bawaan (deep clone) — dipakai tombol Reset.
const DEFAULT_SETTINGS = JSON.parse(JSON.stringify(state.settings));

// Normalizes an id coming from an inline HTML attribute (always a string)
// back into the numeric id type used internally in state.entries / state.selected.
// This keeps Set membership checks (which use strict equality) consistent.
function normId(id) {
  const n = Number(id);
  return Number.isNaN(n) ? id : n;
}

// FIX: safe numeric parsing. The old pattern `parseFloat(x) || fallback`
// treated 0 as "invalid" (0 is falsy) so users could never set margins,
// gaps, or offsets to 0. These helpers only fall back on NaN/empty.
function toNum(v, fallback) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
