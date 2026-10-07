/* ============================================================
   theme.js — TEMA (Light / Dark / Glass / Illustrator Slim)
   Siklus tombol: light → dark → glass → ai → light.
   Browser mengikuti tema sistem bila belum dipilih; CEP mulai di tema ai.
   CATATAN: bootstrap anti-flash ada inline di <head> index.html.
   ============================================================ */

const VALID_THEMES = ['light', 'dark', 'glass', 'ai'];

function getPreferredTheme() {
  try {
    const saved = localStorage.getItem('labelUndangan_theme');
    if (VALID_THEMES.includes(saved)) return saved;
    if (saved === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch (e) {}
  if (window.__adobe_cep__) return 'ai';
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function applyTheme(theme, persist = true) {
  const t = VALID_THEMES.includes(theme) ? theme : 'light';
  document.documentElement.setAttribute('data-theme', t);
  const opts = { Light: 'light', Dark: 'dark', Glass: 'glass', Ai: 'ai' };
  Object.keys(opts).forEach(k => {
    const el = document.getElementById('themeOpt' + k);
    if (el) el.classList.toggle('active', t === opts[k]);
  });
  const railIcon = document.getElementById('railThemeIcon');
  if (railIcon) {
    // Ikon menunjukkan tema BERIKUTNYA: light→dark→glass→ai→light
    railIcon.className =
      t === 'light' ? 'fas fa-moon' :
      t === 'dark' ? 'fas fa-gem' :
      t === 'glass' ? 'fas fa-pen-nib' : 'fas fa-sun';
  }
  // persist=false dipakai mode "Ikuti Sistem" agar pilihan tidak dikunci.
  if (persist) {
    try { localStorage.setItem('labelUndangan_theme', t); } catch (e) {}
  }
  if (typeof refreshWorkspaceOverview === 'function') refreshWorkspaceOverview();
}

// Mode "Ikuti Sistem": bila tidak ada tema tersimpan, ikuti perubahan
// preferensi OS secara real-time.
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    let saved = null;
    try { saved = localStorage.getItem('labelUndangan_theme'); } catch (err) {}
    // FIX: ikuti sistem HANYA bila tidak ada tema tersimpan sama sekali —
    // sebelumnya tema glass/ai ikut tertimpa saat preferensi OS berubah.
    if (saved === 'system') {
      applyTheme(e.matches ? 'dark' : 'light', false);
    } else if (!VALID_THEMES.includes(saved)) {
      applyTheme(window.__adobe_cep__ ? 'ai' : (e.matches ? 'dark' : 'light'), false);
    }
  });
}

function toggleTheme() {
  document.documentElement.classList.add('theme-animating');
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  // Siklus 4 tema: light → dark → glass → ai (Illustrator Slim) → light
  const idx = VALID_THEMES.indexOf(current);
  const next = VALID_THEMES[(idx + 1) % VALID_THEMES.length];
  applyTheme(next);
  setTimeout(() => document.documentElement.classList.remove('theme-animating'), 350);
}

// [FIX TEMA] lompat LANGSUNG ke tema yang diklik (ikon di switch header).
// stopPropagation mencegah klik ikut memicu toggleTheme di tombol induk.
function pickTheme(ev, t) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  document.documentElement.classList.add('theme-animating');
  applyTheme(t);
  setTimeout(() => document.documentElement.classList.remove('theme-animating'), 350);
}

// Apply theme ASAP to avoid flash. A first-time CEP session starts in
// Illustrator Slim; a browser session continues to follow the OS.
applyTheme(getPreferredTheme(), false);
