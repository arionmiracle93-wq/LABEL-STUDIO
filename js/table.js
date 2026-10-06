/* ============================================================
   table.js — TEXT MANAGER (kelola tabel data tamu)
   Proses tempel teks, render tabel, CRUD baris, seleksi, urutan,
   edit massal, navigasi view, dan navigasi Enter ala spreadsheet.
   ============================================================ */

// ============================================
// VIEW SWITCHING
// ============================================
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.switch-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('view' + (view === 'text' ? 'Text' : 'Label')).classList.add('active');
  document.getElementById('btn' + (view === 'text' ? 'Text' : 'Label')).classList.add('active');

  if (view === 'label') updatePreview();
  updateStepper();
  if (typeof refreshWorkspaceOverview === 'function') refreshWorkspaceOverview();
}

// ============================================
// TEXT MANAGER
// ============================================
// Mode impor teks tempel: 'clean' (default, extractGuestRecords — SOP
// Python) atau 'raw' (extractRawLines — 1 baris = 1 data apa adanya).
// Diatur lewat chip "Bersihkan Otomatis" / "Mentah" di atas textarea.
let importMode = 'clean';

function setImportMode(mode) {
  importMode = mode;
  const btnClean = document.getElementById('importModeClean');
  const btnRaw = document.getElementById('importModeRaw');
  if (btnClean) btnClean.classList.toggle('active', mode === 'clean');
  if (btnRaw) btnRaw.classList.toggle('active', mode === 'raw');

  const hint = document.getElementById('importModeHint');
  if (hint) {
    hint.innerHTML = mode === 'raw'
      ? '<i class="fas fa-info-circle"></i> Setiap baris langsung jadi 1 data, tanpa digabung/dibersihkan — cocok untuk daftar WhatsApp di mana jabatan & nama ada di baris terpisah. Sesudah diproses, centang baris terkait di tabel lalu klik tombol "Gabung" untuk menyatukannya jadi 1 tamu.'
      : '<i class="fas fa-info-circle"></i> Pisahkan tiap tamu dengan baris kosong (atau baris "Di"/"Tempat"). Sistem menghapus "Kepada Yth", nomor urut, bullet, dan merapikan spasi — nama bergelar dengan koma tetap utuh';
  }
}

function processData() {
  saveHistory();
  const raw = document.getElementById('rawInput').value;
  if (!raw.trim()) {
    showToast('Masukkan data terlebih dahulu', 'warning');
    return;
  }

  // Ekstraksi 1:1 logika Python; duplikat hanya dicek terhadap data
  // yang sudah ada di tabel (fitur akumulasi aplikasi — Python sendiri
  // tidak melakukan dedup karena selalu mengganti seluruh daftar).
  // Mode 'raw' melewati pembersihan sama sekali (lihat extractRawLines
  // di parser.js) — dipakai saat mode 'clean' salah menggabung baris.
  const { records, discardedGroups } = importMode === 'raw'
    ? extractRawLines(raw)
    : extractGuestRecords(raw);
  let added = 0, fixed = 0, dup = 0, trash = discardedGroups;

  const diValue = (document.getElementById('diText').value || '').trim() || 'Di';
  const alamatDefault = (document.getElementById('alamatBoilerplate').value || '').trim() || 'Tempat';
  // FIX (aditif): opsi "Izinkan nama duplikat" — default OFF sehingga
  // perilaku dedup lama (skip nama yang sudah ada di tabel) tetap sama
  // persis bila checkbox tidak dicentang.
  const allowDup = !!document.getElementById('allowDuplicateImport')?.checked;

  records.forEach(rec => {
    if (!allowDup && state.entries.some(e => e.nama.toLowerCase() === rec.nama.toLowerCase())) {
      dup++;
    } else {
      state.entries.push({
        id: Date.now() + Math.random(),
        nama: rec.nama,
        jabatan: '',
        di: diValue,
        alamat: alamatDefault, // SOP Python: ALAMAT selalu boilerplate
        keterangan: ''
      });
      added++;
      if (rec.wasFixed) fixed++;
    }
  });

  addToStats({ accepted: added, fixed: fixed, duplicate: dup, trash: trash });

  document.getElementById('rawInput').value = '';
  renderTable();

  if (added === 0 && dup === 0) {
    showToast('Tidak ada data tamu yang berhasil dikenali dari teks tersebut', 'warning');
  } else {
    showToast(`Berhasil memproses ${added} data`, 'success');
  }
}

// FIX (aditif): sel Nama pakai <textarea> HANYA bila isinya sudah multi-
// baris (mis. hasil tombol "Gabung") — supaya operator bisa MELIHAT dan
// mengedit kedua baris tsb (input teks satu-baris tidak bisa menampilkan
// \n). Nama satu baris (mayoritas data) tetap pakai <input> seperti
// semula, jadi tidak ada perubahan tampilan untuk kasus biasa. CSS
// `td textarea` (styles.css) sudah tersedia dan otomatis menyamakan gaya.
function renderNamaCell(e) {
  const isMultiline = e.nama.indexOf('\n') !== -1;
  if (isMultiline) {
    return `<textarea onchange="updateEntry('${e.id}', 'nama', this.value)" placeholder="Nama" rows="2" style="padding: 6px 10px; font-size: 13px; min-width: 180px; font-family: inherit;">${escapeHtml(e.nama)}</textarea>`;
  }
  return `<input type="text" value="${escapeHtml(e.nama)}" onchange="updateEntry('${e.id}', 'nama', this.value)" placeholder="Nama" style="padding: 6px 10px; font-size: 13px; min-width: 180px;">`;
}

function renderTable() {
  const tbody = document.getElementById('entriesTable');
  const totalBadge = document.getElementById('totalBadge');
  if (totalBadge) totalBadge.innerHTML = `<i class="fas fa-users"></i> ${state.entries.length} tamu`;

  if (state.entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-state-icon">🍃</div><h3>Belum ada data tamu</h3><p>Gunakan panel sebelah kiri untuk import data, atau klik <b>"Tambah Data"</b> di atas untuk input manual.</p></td></tr>';
    updateToolbarButtons();
    if (typeof updateEditorCounters === 'function') updateEditorCounters();
    updateStepper();
    autoSaveIfEnabled();
    return;
  }

  tbody.innerHTML = state.entries.map((e, i) => `
    <tr class="${state.selected.has(e.id) ? 'selected' : ''}" style="height: 44px;">
      <td style="padding: 6px;"><input type="checkbox" ${state.selected.has(e.id) ? 'checked' : ''} onchange="toggleSelect('${e.id}')" style="width: 16px; height: 16px;"></td>
      <td style="padding: 6px; font-weight: 600; color: var(--text-muted); font-size: 12px;">${i + 1}</td>
      <td style="padding: 6px 8px;">${renderNamaCell(e)}</td>
      <td style="padding: 6px 8px;"><input type="text" value="${escapeHtml(e.jabatan)}" onchange="updateEntry('${e.id}', 'jabatan', this.value)" placeholder="Jabatan" style="padding: 6px 10px; font-size: 13px; min-width: 120px;"></td>
      <td style="padding: 6px;"><input type="text" value="${escapeHtml(e.di)}" style="width: 46px; text-align: center; padding: 6px 4px; font-size: 13px;" onchange="updateEntry('${e.id}', 'di', this.value)"></td>
      <td style="padding: 6px 8px;"><input type="text" value="${escapeHtml(e.alamat)}" onchange="updateEntry('${e.id}', 'alamat', this.value)" placeholder="Alamat" style="padding: 6px 10px; font-size: 13px; min-width: 120px;"></td>
      <td style="padding: 6px 8px;"><input type="text" value="${escapeHtml(e.keterangan)}" onchange="updateEntry('${e.id}', 'keterangan', this.value)" placeholder="Keterangan" style="padding: 6px 10px; font-size: 13px; min-width: 80px;"></td>
      <td style="padding: 6px;">
        <div style="display: flex; gap: 3px;">
          <button class="toolbar-btn" style="width: 28px; height: 28px; padding: 0;" onclick="moveEntry('${e.id}', -1)" title="Naik" aria-label="Naikkan baris ${i + 1}" type="button"><i class="fas fa-arrow-up" style="font-size: 11px;" aria-hidden="true"></i></button>
          <button class="toolbar-btn" style="width: 28px; height: 28px; padding: 0;" onclick="moveEntry('${e.id}', 1)" title="Turun" aria-label="Turunkan baris ${i + 1}" type="button"><i class="fas fa-arrow-down" style="font-size: 11px;" aria-hidden="true"></i></button>
          <button class="toolbar-btn" style="width: 28px; height: 28px; padding: 0;" onclick="duplicateEntry('${e.id}')" title="Duplikat" aria-label="Duplikatkan baris ${i + 1}" type="button"><i class="fas fa-copy" style="font-size: 11px;" aria-hidden="true"></i></button>
          <button class="toolbar-btn" style="width: 28px; height: 28px; padding: 0; color: var(--danger);" onclick="deleteEntry('${e.id}')" title="Hapus" aria-label="Hapus baris ${i + 1}" type="button"><i class="fas fa-trash-alt" style="font-size: 11px;" aria-hidden="true"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  updateToolbarButtons();
  if (typeof updateEditorCounters === 'function') updateEditorCounters();
  if (state.tableFilter) applyRowFilter();
  updateStepper();
  autoSaveIfEnabled();
}

function updateEntry(id, field, value) {
  id = normId(id);
  const entry = state.entries.find(e => e.id === id);
  // FIX: history must be saved BEFORE the mutation (it was saved after,
  // so the first Ctrl+Z on an edited cell did nothing). Also skip no-op
  // edits so history isn't polluted.
  if (entry && entry[field] !== value) {
    saveHistory();
    entry[field] = value;
    autoSaveIfEnabled();
  }
}

// FIX: previously received a *string* id (from the inline onchange attribute)
// while state.selected / entry.id are numbers. Set.has()/add()/delete() use
// strict equality, so the type mismatch made every selection-based feature
// (bulk delete, bulk duplicate, bulk move, bulk edit) silently fail. We now
// normalize the id back to a number before touching the Set.
function toggleSelect(id) {
  id = normId(id);
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  renderTable();
}

function toggleSelectAll(cb) {
  if (cb.checked) state.entries.forEach(e => state.selected.add(e.id));
  else state.selected.clear();
  renderTable();
}

function selectAllRows() {
  state.entries.forEach(e => state.selected.add(e.id));
  renderTable();
}

function deselectAll() {
  state.selected.clear();
  renderTable();
}

function updateToolbarButtons() {
  const hasSelection = state.selected.size > 0;
  document.getElementById('btnDup').disabled = !hasSelection;
  document.getElementById('btnDel').disabled = !hasSelection;
  const btnMerge = document.getElementById('btnMerge');
  if (btnMerge) btnMerge.disabled = state.selected.size < 2;
  const btnAutoMergePairs = document.getElementById('btnAutoMergePairs');
  if (btnAutoMergePairs) btnAutoMergePairs.disabled = state.entries.length < 2;
}

// Gabung 2+ baris terpilih menjadi SATU data tamu — pelengkap mode
// impor 'raw': dipakai saat jabatan & nama tamu tertempel di baris
// terpisah (mis. "Yth. KU Medrec" + "Bpk. Effendy Toifur" harus jadi
// satu label, bukan dua). Urutan gabung mengikuti URUTAN TAMPIL di
// tabel (bukan urutan klik centang). Kolom jabatan/di/alamat/
// keterangan diambil dari baris PERTAMA yang terpilih; baris lain
// yang tergabung dihapus.
// Digabung pakai BARIS BARU (\n), bukan spasi — supaya di Preview/Cetak/
// Illustrator hasilnya tetap tampil sebagai baris terpisah (mis. baris
// jabatan "Yth. KU Medrec" dan baris nama "Bpk. Effendy Toifur" tetap
// 2 baris dalam 1 label), bukan menyatu jadi 1 baris panjang.
// renderTemplate() (designer.js) & renderLabelData() (cep-bridge.js)
// sudah mendukung \n di dalam field nama. Ini TIDAK memengaruhi
// penggabungan grup di parser.js (mode 'clean'), yang tetap pakai
// spasi seperti sebelumnya — hanya tombol "Gabung" manual ini yang berubah.
function mergeSelected() {
  if (state.selected.size < 2) {
    showToast('Pilih minimal 2 baris untuk digabung', 'warning');
    return;
  }
  saveHistory();

  const idxToMerge = state.entries
    .map((e, i) => i)
    .filter(i => state.selected.has(state.entries[i].id));

  const first = state.entries[idxToMerge[0]];
  first.nama = idxToMerge
    .map(i => state.entries[i].nama.trim())
    .join('\n');

  const idsToRemove = new Set(idxToMerge.slice(1).map(i => state.entries[i].id));
  const mergedCount = idxToMerge.length;
  state.entries = state.entries.filter(e => !idsToRemove.has(e.id));

  // Seleksi dikosongkan total (bukan menyisakan baris hasil gabungan
  // tercentang) supaya gabung berturut-turut untuk pasangan lain aman —
  // kalau baris hasil gabungan tetap tercentang, ia bisa ikut ter-gabung
  // lagi secara tidak sengaja saat operator mencentang pasangan berikutnya.
  state.selected.clear();

  renderTable();
  showToast(`${mergedCount} baris digabung jadi 1 data`, 'success');
}

// Gabung Otomatis per 2 Baris Berurutan — pelengkap mergeSelected() untuk
// daftar mode 'raw' yang polanya KONSISTEN (baris jabatan/baris nama
// berselang-seling, mis. contoh WhatsApp: 10 baris = 5 label). Memasangkan
// baris 1+2, 3+4, dst. TANPA perlu centang manual satu-satu. Baris ganjil
// terakhir yang tidak berpasangan dibiarkan apa adanya (tidak dihapus).
// Beroperasi pada SELURUH data tabel, bukan hanya baris yang tersaring
// filter — dan mengabaikan centang/seleksi yang sedang aktif.
function autoMergeAdjacentPairs() {
  if (state.entries.length < 2) {
    showToast('Minimal 2 baris diperlukan untuk gabung otomatis', 'warning');
    return;
  }
  if (!confirm('Gabungkan otomatis setiap 2 baris berurutan (baris 1+2, 3+4, dst.) menjadi 1 data per label?\n\nBerlaku untuk SELURUH data di tabel (bukan hanya yang tersaring/tercentang). Baris terakhir yang jumlahnya ganjil akan dibiarkan sendiri.')) return;
  saveHistory();

  const merged = [];
  let pairCount = 0;
  for (let i = 0; i < state.entries.length; i += 2) {
    const a = state.entries[i];
    const b = state.entries[i + 1];
    if (b) {
      merged.push({ ...a, nama: [a.nama.trim(), b.nama.trim()].join('\n') });
      pairCount++;
    } else {
      merged.push(a); // baris ganjil terakhir tanpa pasangan
    }
  }
  state.entries = merged;
  state.selected.clear();

  renderTable();
  showToast(`${pairCount} pasang baris digabung otomatis jadi ${pairCount} data`, 'success');
}

function addNewEntry() {
  saveHistory();
  const diValue = (document.getElementById('diText').value || '').trim() || 'Di';
  const alamatDefault = (document.getElementById('alamatBoilerplate').value || '').trim() || 'Tempat';
  state.entries.push({
    id: Date.now() + Math.random(),
    nama: 'Nama Baru',
    jabatan: '',
    di: diValue,
    alamat: alamatDefault,
    keterangan: ''
  });
  renderTable();
  showToast('Data baru ditambahkan', 'success');
}

function deleteEntry(id) {
  id = normId(id);
  saveHistory();
  state.entries = state.entries.filter(e => e.id !== id);
  state.selected.delete(id);
  renderTable();
}

function deleteSelected() {
  if (state.selected.size === 0) return;
  const count = state.selected.size;
  if (!confirm('Hapus ' + count + ' baris terpilih?')) return;
  saveHistory();
  state.entries = state.entries.filter(e => !state.selected.has(e.id));
  state.selected.clear();
  renderTable();
  showToast(`${count} baris dihapus`, 'success');
}

function duplicateEntry(id) {
  id = normId(id);
  saveHistory();
  const idx = state.entries.findIndex(e => e.id === id);
  if (idx > -1) {
    const copy = { ...state.entries[idx], id: Date.now() + Math.random() };
    state.entries.splice(idx + 1, 0, copy);
    renderTable();
  }
}

function duplicateSelected() {
  if (state.selected.size === 0) return;
  saveHistory();
  const count = state.selected.size;
  const newEntries = [];
  state.entries.forEach(e => {
    newEntries.push(e);
    if (state.selected.has(e.id)) {
      newEntries.push({ ...e, id: Date.now() + Math.random() });
    }
  });
  state.entries = newEntries;
  renderTable();
  showToast(`${count} baris diduplikat`, 'success');
}

function moveEntry(id, dir) {
  id = normId(id);
  const idx = state.entries.findIndex(e => e.id === id);
  const newIdx = idx + dir;
  if (idx > -1 && newIdx > -1 && newIdx < state.entries.length) {
    saveHistory();
    [state.entries[idx], state.entries[newIdx]] = [state.entries[newIdx], state.entries[idx]];
    renderTable();
  }
}

function moveSelected(dir) {
  if (state.selected.size === 0) {
    showToast('Pilih minimal satu baris terlebih dahulu', 'warning');
    return;
  }
  saveHistory();
  const entries = state.entries;
  const indices = entries
    .map((e, i) => ({ id: e.id, i }))
    .filter(x => state.selected.has(x.id))
    .map(x => x.i);

  if (dir < 0) {
    for (const idx of indices) {
      if (idx === 0) continue;
      if (state.selected.has(entries[idx - 1].id)) continue;
      [entries[idx - 1], entries[idx]] = [entries[idx], entries[idx - 1]];
    }
  } else {
    for (const idx of [...indices].reverse()) {
      if (idx === entries.length - 1) continue;
      if (state.selected.has(entries[idx + 1].id)) continue;
      [entries[idx + 1], entries[idx]] = [entries[idx], entries[idx + 1]];
    }
  }
  renderTable();
}

function clearAll() {
  if (state.entries.length === 0) return;
  if (!confirm('Hapus semua data?')) return;
  saveHistory();
  state.entries = [];
  state.selected.clear();
  renderTable();
  showToast('Semua data dihapus', 'success');
}

function applyBulk() {
  if (state.selected.size === 0) {
    showToast('Pilih minimal satu baris terlebih dahulu', 'warning');
    return;
  }
  const field = document.getElementById('bulkField').value;
  const value = document.getElementById('bulkValue').value;
  const count = state.selected.size;
  saveHistory();
  state.entries.forEach(e => {
    if (state.selected.has(e.id)) e[field] = value;
  });
  renderTable();
  showToast('Berhasil diterapkan ke ' + count + ' baris', 'success');
}

// ============================================
// NAVIGASI ENTER DI TABEL — Enter pindah ke baris berikutnya,
// kolom yang sama (seperti spreadsheet)
// [execution-time: butuh DOM — script dimuat di akhir <body>]
// ============================================
document.getElementById('entriesTable').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'text') return;
  e.preventDefault();
  const td = input.closest('td');
  const tr = input.closest('tr');
  if (!td || !tr) return;
  const colIdx = Array.prototype.indexOf.call(tr.children, td);
  let next = tr.nextElementSibling;
  while (next && next.style.display === 'none') next = next.nextElementSibling; // lewati baris terfilter
  if (next && next.children[colIdx]) {
    const nextInput = next.children[colIdx].querySelector('input[type="text"]');
    if (nextInput) { nextInput.focus(); nextInput.select(); }
  } else {
    input.blur();
    showToast('Baris terakhir — gunakan "Tambah" untuk data baru', 'info');
  }
});
