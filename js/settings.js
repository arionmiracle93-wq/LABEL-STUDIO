/* ============================================================
   settings.js — MODAL PENGATURAN APLIKASI (tombol gear)
   Mode tema (terang/gelap/glass/Illustrator Slim/sistem), preset ukuran kertas,
   backup & pulihkan lengkap, dan reset.
   ============================================================ */

function openSettings() {
  document.getElementById('settingsModal').classList.add('open');
  updateThemeModeButtons();
  updatePaperPresetButtons();
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}

// [execution-time: butuh DOM — script dimuat di akhir <body>]
document.getElementById('settingsModal').addEventListener('click', function (e) {
  if (e.target === this) closeSettings();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSettings();
});

// --- Tema: Terang / Gelap / Ikuti Sistem ---
function setThemeMode(mode) {
  if (mode === 'system') {
    try { localStorage.setItem('labelUndangan_theme', 'system'); } catch (e) {}
    const sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(sysDark ? 'dark' : 'light', false);
    showToast('Tema mengikuti pengaturan sistem', 'success');
  } else {
    applyTheme(mode);
    const label = mode === 'dark' ? 'gelap'
      : mode === 'glass' ? 'Glass (frosted blur)'
      : mode === 'ai' ? 'Illustrator Slim' : 'terang';
    showToast('Tema ' + label + ' diterapkan', 'success');
  }
  updateThemeModeButtons();
}

function updateThemeModeButtons() {
  let saved = null;
  try { saved = localStorage.getItem('labelUndangan_theme'); } catch (e) {}
  const mode = saved === 'system' ? 'system'
    : VALID_THEMES.includes(saved) ? saved
    : (window.__adobe_cep__ ? 'ai' : 'system');
  ['Light', 'Dark', 'Glass', 'Ai', 'System'].forEach(m => {
    const btn = document.getElementById('themeMode' + m);
    if (btn) btn.classList.toggle('active', mode === m.toLowerCase());
  });
}

// --- Preset ukuran kertas ---
function applyPaperPreset(w, h, name) {
  document.getElementById('pageWidth').value = w;
  document.getElementById('pageHeight').value = h;
  updatePreview();
  updatePaperPresetButtons();
  showToast('Ukuran kertas ' + name + ' (' + w + ' × ' + h + ' mm) diterapkan', 'success');
}

function updatePaperPresetButtons() {
  const w = toNum(document.getElementById('pageWidth').value, 0);
  const h = toNum(document.getElementById('pageHeight').value, 0);
  document.querySelectorAll('#paperPresets .chip-btn').forEach(btn => {
    const m = (btn.getAttribute('onclick') || '').match(/applyPaperPreset\((\d+),(\d+)/);
    btn.classList.toggle('active', !!m && Number(m[1]) === w && Number(m[2]) === h);
  });
}

// --- Backup & pulihkan (data tamu + pengaturan + boilerplate) ---
function exportBackup() {
  const backup = {
    app: 'labelUndanganStudio',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: state.entries,
    settings: state.settings,
    boiler: {
      di: document.getElementById('diText').value,
      alamat: document.getElementById('alamatBoilerplate').value
    }
  };
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(JSON.stringify(backup, null, 2), 'backup-label-undangan-' + stamp + '.json', 'application/json');
  showToast('Backup berhasil diunduh', 'success');
}

function importBackup(input) {
  const file = input.files[0];
  if (!file) return;
  file.text().then(text => {
    try {
      const b = JSON.parse(text);
      if (!b || b.app !== 'labelUndanganStudio' || !Array.isArray(b.entries)) {
        throw new Error('Bukan file backup Label Undangan Studio yang valid.');
      }
      if (!confirm('Pulihkan backup? Data & pengaturan saat ini akan DIGANTI dengan isi backup (' + b.entries.length + ' tamu).')) return;
      saveHistory();
      state.entries = b.entries
        .filter(r => r && typeof r === 'object')
        .map((r, i) => ({
          id: typeof r.id === 'number' && Number.isFinite(r.id) ? r.id : Date.now() + i + Math.random(),
          nama: String(r.nama ?? ''),
          jabatan: String(r.jabatan ?? ''),
          di: String(r.di ?? 'Di'),
          alamat: String(r.alamat ?? 'Tempat'),
          keterangan: String(r.keterangan ?? '')
        }));
      if (b.settings && typeof b.settings === 'object') {
        Object.assign(state.settings, b.settings);
        state.settings.format = Object.assign({}, DEFAULT_SETTINGS.format, b.settings.format || {});
        state.settings.nameStyle = Object.assign({}, DEFAULT_SETTINGS.nameStyle, b.settings.nameStyle || {});
      }
      if (b.boiler && typeof b.boiler === 'object') {
        if (typeof b.boiler.di === 'string') document.getElementById('diText').value = b.boiler.di;
        if (typeof b.boiler.alamat === 'string') document.getElementById('alamatBoilerplate').value = b.boiler.alamat;
        saveBoilerplate();
      }
      state.selected.clear();
      applySettingsToForm();
      renderTable();
      refreshPreviewIfVisible();
      closeSettings();
      showToast('Backup dipulihkan: ' + state.entries.length + ' tamu', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memulihkan backup: ' + err.message, 'error');
    }
  });
  input.value = '';
}

// --- Reset ---
function resetSettingsDefault() {
  if (!confirm('Kembalikan seluruh pengaturan label (ukuran, tipografi, template) ke bawaan? Data tamu TIDAK terhapus.')) return;
  state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  applySettingsToForm();
  refreshPreviewIfVisible();
  autoSaveIfEnabled();
  updatePaperPresetButtons();
  showToast('Pengaturan dikembalikan ke bawaan', 'success');
}

function clearAllStorage() {
  if (!confirm('HAPUS SEMUA data tamu dan pengaturan yang tersimpan di browser ini? Tindakan ini tidak bisa dibatalkan setelah halaman dimuat ulang.')) return;
  if (!confirm('Yakin? Pertimbangkan unduh backup terlebih dahulu.')) return;
  try {
    ['labelUndangan_entries', 'labelUndangan_settings', 'labelUndangan_boiler'].forEach(k => localStorage.removeItem(k));
  } catch (e) {}
  saveHistory();
  state.entries = [];
  state.selected.clear();
  state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  applySettingsToForm();
  renderTable();
  refreshPreviewIfVisible();
  closeSettings();
  showToast('Semua data tersimpan telah dihapus', 'success');
}
