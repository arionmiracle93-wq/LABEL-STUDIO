/* ============================================================
   tools.js — ALAT BANTU TEKS & BOILERPLATE DI/ALAMAT
   Cari & ganti, kapitalisasi, awalan nama, urutkan, rapikan
   spasi, hapus duplikat, cek nama terpanjang, filter tabel,
   dan persistensi teks Di/Alamat + terapkan massal.
   Semua alat: baris terpilih ATAU semua baris; selalu lewat
   saveHistory() sehingga bisa di-undo.
   ============================================================ */

// ============================================
// BOILERPLATE "DI" / "ALAMAT" — persistensi & terapkan massal
// ============================================
let boilerSaveTimer = null;
function saveBoilerplate() {
  clearTimeout(boilerSaveTimer);
  boilerSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem('labelUndangan_boiler', JSON.stringify({
        di: document.getElementById('diText').value,
        alamat: document.getElementById('alamatBoilerplate').value
      }));
    } catch (e) {}
  }, 300);
}

function restoreBoilerplate() {
  try {
    const saved = localStorage.getItem('labelUndangan_boiler');
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.di === 'string' && parsed.di.trim()) document.getElementById('diText').value = parsed.di;
      if (typeof parsed.alamat === 'string' && parsed.alamat.trim()) document.getElementById('alamatBoilerplate').value = parsed.alamat;
    }
  } catch (e) {}
}

function applyBoilerplateToAll() {
  if (state.entries.length === 0) { showToast('Belum ada data di tabel', 'warning'); return; }
  const diValue = (document.getElementById('diText').value || '').trim() || 'Di';
  const alamatValue = (document.getElementById('alamatBoilerplate').value || '').trim() || 'Tempat';
  const targets = state.selected.size > 0
    ? state.entries.filter(e => state.selected.has(e.id))
    : state.entries;
  if (!confirm(`Terapkan Di="${diValue}" dan Alamat="${alamatValue}" ke ${targets.length} baris${state.selected.size > 0 ? ' terpilih' : ''}?`)) return;
  saveHistory();
  targets.forEach(e => { e.di = diValue; e.alamat = alamatValue; });
  renderTable();
  showToast(`Diterapkan ke ${targets.length} baris`, 'success');
}

// ============================================
// TEXT TOOLS (additive helpers — do not alter existing logic)
// All tools operate on selected rows, or ALL rows when nothing
// is selected, and always go through saveHistory() so Undo works.
// ============================================
function getToolTargets() {
  if (state.selected.size > 0) {
    return state.entries.filter(e => state.selected.has(e.id));
  }
  return state.entries;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function doFindReplace() {
  const find = document.getElementById('frFind').value;
  if (!find) { showToast('Isi teks yang ingin dicari terlebih dahulu', 'warning'); return; }
  const repl = document.getElementById('frReplace').value;
  const field = document.getElementById('frField').value;
  const targets = getToolTargets();
  if (targets.length === 0) { showToast('Belum ada data', 'warning'); return; }

  saveHistory();
  const fields = field === 'semua' ? ['nama', 'jabatan', 'di', 'alamat', 'keterangan'] : [field];
  const re = new RegExp(escapeRegex(find), 'gi');
  let count = 0;

  targets.forEach(e => {
    fields.forEach(f => {
      const v = String(e[f] ?? '');
      const matches = v.match(re);
      if (matches) {
        // FIX: function replacer keeps `$&`, `$1` etc. in the replacement
        // text literal instead of being interpreted as regex patterns.
        e[f] = v.replace(re, () => repl);
        count += matches.length;
      }
    });
  });

  renderTable();
  if (count > 0) showToast(`${count} penggantian diterapkan pada ${targets.length} baris`, 'success');
  else showToast('Teks tidak ditemukan', 'warning');
}

function toTitleCase(s) {
  return (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function changeCase(mode) {
  const field = document.getElementById('caseField').value;
  const targets = getToolTargets();
  if (targets.length === 0) { showToast('Belum ada data', 'warning'); return; }

  saveHistory();
  targets.forEach(e => {
    const v = e[field] || '';
    if (mode === 'upper') e[field] = v.toUpperCase();
    else if (mode === 'lower') e[field] = v.toLowerCase();
    else e[field] = toTitleCase(v);
  });
  renderTable();
  const label = mode === 'upper' ? 'UPPERCASE' : mode === 'lower' ? 'lowercase' : 'Title Case';
  showToast(`${label} diterapkan ke ${targets.length} baris (kolom ${field})`, 'success');
}

const NAME_PREFIXES_RE = /^(bpk\.?|bapak|ibu|sdr\.?|sdri\.?|kel\.?|keluarga)\s+/i;

// FIX (aditif): addNamePrefix() kini juga dipakai untuk awalan CUSTOM
// bebas (lihat addCustomPrefix()), bukan cuma 5 tombol preset. Selain
// tetap melewati nama yang sudah punya salah satu awalan BAKU
// (NAME_PREFIXES_RE, perilaku asli — tidak berubah), sekarang juga
// dilewati bila nama SUDAH diawali persis prefix yang sedang ditambahkan
// — supaya klik "+ Bpk." atau "Tambah" custom dua kali tidak menumpuk
// jadi "Bpk. Bpk. Nama".
function addNamePrefix(prefix) {
  const prefixTrim = String(prefix || '').trim();
  if (!prefixTrim) { showToast('Awalan tidak boleh kosong', 'warning'); return; }
  const targets = getToolTargets();
  if (targets.length === 0) { showToast('Belum ada data', 'warning'); return; }

  saveHistory();
  const ownPrefixRe = new RegExp('^' + escapeRegex(prefixTrim) + '\\s+', 'i');
  let count = 0;
  targets.forEach(e => {
    const nama = (e.nama || '').trim();
    if (!nama) return;
    if (NAME_PREFIXES_RE.test(nama) || ownPrefixRe.test(nama)) return; // sudah ada awalan — lewati
    e.nama = prefixTrim + ' ' + nama;
    count++;
  });
  renderTable();
  showToast(count > 0 ? `Awalan "${prefixTrim}" ditambahkan ke ${count} nama` : 'Semua nama sudah memiliki awalan', count > 0 ? 'success' : 'warning');
}

// Awalan CUSTOM (bebas) — baca dari kotak input #customPrefixInput dan
// pakai mesin addNamePrefix() yang sama seperti 5 tombol preset.
function addCustomPrefix() {
  const val = (document.getElementById('customPrefixInput')?.value || '').trim();
  if (!val) { showToast('Isi kotak "Custom" dengan awalan yang diinginkan terlebih dahulu', 'warning'); return; }
  addNamePrefix(val);
}

// Kebalikan addCustomPrefix(): hapus teks di kotak Custom dari AWAL nama
// (baris terpilih, atau semua bila tidak ada yang dicentang) — pelengkap
// removeNamePrefix() yang hanya menangani 5 awalan baku.
function removeCustomPrefix() {
  const val = (document.getElementById('customPrefixInput')?.value || '').trim();
  if (!val) { showToast('Isi kotak "Custom" dengan awalan yang ingin dihapus terlebih dahulu', 'warning'); return; }
  const targets = getToolTargets();
  if (targets.length === 0) { showToast('Belum ada data', 'warning'); return; }

  saveHistory();
  const re = new RegExp('^' + escapeRegex(val) + '\\s+', 'i');
  let count = 0;
  targets.forEach(e => {
    const nama = (e.nama || '').trim();
    if (re.test(nama)) {
      e.nama = nama.replace(re, '').trim();
      count++;
    }
  });
  renderTable();
  showToast(count > 0 ? `Awalan "${val}" dihapus dari ${count} nama` : `Tidak ada nama berawalan "${val}"`, count > 0 ? 'success' : 'warning');
}

function removeNamePrefix() {
  const targets = getToolTargets();
  if (targets.length === 0) { showToast('Belum ada data', 'warning'); return; }

  saveHistory();
  let count = 0;
  targets.forEach(e => {
    const nama = (e.nama || '').trim();
    if (NAME_PREFIXES_RE.test(nama)) {
      e.nama = nama.replace(NAME_PREFIXES_RE, '').trim();
      count++;
    }
  });
  renderTable();
  showToast(count > 0 ? `Awalan dihapus dari ${count} nama` : 'Tidak ada awalan yang ditemukan', count > 0 ? 'success' : 'warning');
}

function sortEntries(dir) {
  if (state.entries.length === 0) { showToast('Belum ada data', 'warning'); return; }
  saveHistory();
  state.entries.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' }) * dir);
  renderTable();
  showToast(`Data diurutkan ${dir > 0 ? 'A–Z' : 'Z–A'} berdasarkan nama`, 'success');
}

function cleanSpacesAll() {
  const targets = getToolTargets();
  if (targets.length === 0) { showToast('Belum ada data', 'warning'); return; }

  saveHistory();
  let count = 0;
  const fields = ['nama', 'jabatan', 'di', 'alamat', 'keterangan'];
  targets.forEach(e => {
    let changed = false;
    fields.forEach(f => {
      const v = e[f] || '';
      const cleaned = v.replace(/\s{2,}/g, ' ').trim();
      if (cleaned !== v) { e[f] = cleaned; changed = true; }
    });
    if (changed) count++;
  });
  renderTable();
  showToast(count > 0 ? `Spasi dirapikan pada ${count} baris` : 'Semua data sudah rapi', 'success');
}

function removeDuplicateNames() {
  if (state.entries.length === 0) { showToast('Belum ada data', 'warning'); return; }
  const seen = new Set();
  const kept = [];
  let removed = 0;
  state.entries.forEach(e => {
    const key = (e.nama || '').trim().toLowerCase();
    if (key && seen.has(key)) { removed++; return; }
    seen.add(key);
    kept.push(e);
  });
  if (removed === 0) { showToast('Tidak ada nama duplikat', 'success'); return; }
  if (!confirm('Hapus ' + removed + ' baris dengan nama duplikat? (Baris pertama dipertahankan)')) return;
  saveHistory();
  state.entries = kept;
  state.selected.clear();
  renderTable();
  showToast(`${removed} duplikat dihapus`, 'success');
}

function checkLongNames() {
  if (state.entries.length === 0) { showToast('Belum ada data', 'warning'); return; }
  const sorted = [...state.entries].sort((a, b) => (b.nama || '').length - (a.nama || '').length);
  const longest = sorted.slice(0, 5);
  const msg = longest.map((e, i) => `${i + 1}. ${e.nama} (${(e.nama || '').length} karakter)`).join('\n');
  alert('5 Nama Terpanjang (berpotensi tidak muat di label):\n\n' + msg + '\n\nTips: kecilkan font size atau perbesar ukuran label jika nama terpotong di preview.');
}

// Table quick filter (display only — does not modify data)
function filterRows(q) {
  state.tableFilter = (q || '').trim().toLowerCase();
  applyRowFilter();
}

function applyRowFilter() {
  const q = state.tableFilter;
  const rows = document.querySelectorAll('#entriesTable tr');
  let visible = 0;
  rows.forEach(tr => {
    if (tr.querySelector('.empty-state')) return;
    if (!q) { tr.style.display = ''; visible++; return; }
    let text = '';
    // FIX: sertakan <textarea> — sel Nama multi-baris (hasil "Gabung")
    // pakai textarea (lihat renderNamaCell di table.js), bukan input.
    tr.querySelectorAll('input[type="text"], textarea').forEach(inp => { text += ' ' + (inp.value || '').toLowerCase(); });
    const match = text.includes(q);
    tr.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  // Update counter UI saat difilter
  if (typeof updateEditorCounters === 'function') {
    if (q) updateEditorCounters(visible);
    else updateEditorCounters();
  }
}
