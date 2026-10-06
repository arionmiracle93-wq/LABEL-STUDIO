/* ============================================================
   parser.js — MESIN PEMBERSIH TEKS & DETEKSI TABEL TERSTRUKTUR
   Port 1:1 dari script Python "konverter_desktop_v2.py" (SOP
   pengguna) + penyempurnaan aditif yang terdokumentasi.
   Modul ini berisi FUNGSI MURNI kecuali commitStructuredEntries
   (menyentuh state + DOM via renderTable/showToast — runtime).
   ============================================================ */

// ============================================
// TEXT CLEANING ENGINE — port 1:1 dari script Python
// "konverter_desktop_v2.py" (SOP pengguna).
// Perilaku kunci yang direplikasi persis:
//  - NOISE hanya {di, tempat, kepada, yth} (token tunggal, trailing
//    ".:," di-strip seperti Python rstrip('.:,')).
//  - Grup nama HANYA dipisah oleh baris noise/kosong — nomor urut &
//    bullet TIDAK memulai grup baru (dibersihkan oleh normalize_name).
//  - Semua baris dalam satu grup digabung dengan SPASI menjadi SATU
//    nama utuh. TIDAK ada pemecahan nama/alamat — sehingga nama
//    bergelar ("Dewi Lestari, S.I.Kom.") tidak pernah pecah di koma.
//  - normalize_name TIDAK melakukan kapitalisasi per kata; hanya
//    huruf pertama gelar sapaan (Bpk/Ibu/Sdr/...) jika semuanya kecil.
//  - Kolom ALAMAT selalu diisi teks boilerplate (default "Tempat"),
//    sama seperti output NAMA/JABATAN/DI/ALAMAT script Python.
// ============================================
const NOISE = new Set(['di', 'tempat', 'kepada', 'yth', 'kpd']);
// Frasa noise multi-kata (baris utuh) — menutup celah Python di mana
// "Di Tempat" dalam SATU baris tidak dikenali (NOISE hanya per token).
const NOISE_PHRASES = new Set([
  'di tempat', 'ditempat', 'di-tempat', 'di -tempat', 'di- tempat',
  'kepada yth', 'kpd yth', 'yang terhormat', 'dengan hormat', 'turut mengundang'
]);
const LEADING_PREFIX_RE = /^(kepada\s+yth\.?|kepada\s+y\.?t\.?h\.?|kepada|kpd\.?\s+yth\.?|kpd\.?|yth\.?)\s*[:.,]?\s*/i;
const NUMBERING_RE = /^\(?\d{1,3}\)?[.)]\s*/;
// Varian nomor urut berformat dash: "1 - Budi", "2 – Siti"
const NUMBER_DASH_RE = /^\d{1,3}\s*[-–—]\s+/;
const BULLET_RE = /^[-*\u2022\u25CF\u25AA]+\s*/;
const TITLE_RE = /^(bpk|ibu|sdr|sdri|bapak|saudara|saudari)\b\.?/i;
// Baris pemisah dekoratif: "-----", "=====", "....." dsb.
const SEPARATOR_LINE_RE = /^[\s\-_=~*•·.:,;]+$/;
// Baris yang murni nomor telepon Indonesia — tidak mungkin nama.
const PHONE_LINE_RE = /^(\+?62|0)[\d\s\-().]{7,}$/;
// Emoji/pictograph (sering terbawa dari daftar WhatsApp).
const EMOJI_RE = /[\p{Extended_Pictographic}\uFE0F]/gu;

// Pra-pembersih karakter tak terlihat khas tempelan WhatsApp/Word:
// zero-width space/joiner/non-joiner, word-joiner, BOM, soft hyphen,
// dan non-breaking space → spasi biasa. Tanpa ini, karakter tersebut
// lolos ke nama dan merusak dedup + deteksi noise.
function sanitizeRawText(text) {
  return String(text ?? '')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/\u00A0/g, ' ');
}

// Port dari normalize_name() — tanpa kapitalisasi per kata.
// Ditambah (aditif): strip nomor-dash, emoji, dan tanda baca
// menggantung di AKHIR nama ("," ";" ":") — titik dipertahankan
// karena gelar (S.I.Kom.) sah diakhiri titik.
function normalizeName(raw) {
  let s = sanitizeRawText(raw).replace(/\r/g, '').trim();
  s = s.replace(EMOJI_RE, '');
  s = s.replace(BULLET_RE, '');
  s = s.replace(NUMBERING_RE, '');
  s = s.replace(NUMBER_DASH_RE, '');
  s = s.replace(LEADING_PREFIX_RE, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/^[:;,\-]+/, '').trim();
  s = s.replace(/[\s,;:]+$/, '').trim();

  const m = s.match(TITLE_RE);
  if (m && m[0] === m[0].toLowerCase()) {
    s = m[0].charAt(0).toUpperCase() + m[0].slice(1) + s.slice(m[0].length);
  }

  return s.trim();
}

// Port dari is_noise_line() — Python: line.strip().lower().rstrip('.:,')
// Diperluas (aditif): frasa noise multi-kata, baris pemisah dekoratif,
// dan baris nomor telepon juga dianggap noise (pemisah grup).
function isNoiseLine(line) {
  const t = sanitizeRawText(line).trim().toLowerCase();
  const c = t.replace(/[.:,]+$/, '');
  if (NOISE.has(c) || c === '') return true;
  if (NOISE_PHRASES.has(c.replace(/\s{2,}/g, ' '))) return true;
  if (SEPARATOR_LINE_RE.test(t)) return true;
  if (PHONE_LINE_RE.test(t)) return true;
  return false;
}

// Deteksi awal record baru: nomor urut ("1." / "(2)" / "3 -") atau
// bullet. Menutup celah terbesar Python: daftar bernomor TANPA baris
// kosong di antaranya menyatu menjadi satu nama raksasa.
function isRecordStart(line) {
  const t = String(line).trim();
  return NUMBERING_RE.test(t) || NUMBER_DASH_RE.test(t) || BULLET_RE.test(t);
}

// Port dari extract_names_from_block():
// baris noise memisahkan grup; baris non-noise digabung dengan spasi.
// Aditif: baris berawalan nomor/bullet menutup grup sebelumnya dulu.
// Return: array nama ternormalisasi dengan panjang > 1.
function extractNamesFromBlock(text) {
  const lines = sanitizeRawText(text).split('\n');
  const names = [];
  let buffer = [];
  for (const line of lines) {
    if (isNoiseLine(line)) {
      if (buffer.length) { names.push(buffer.join(' ')); buffer = []; }
    } else {
      if (isRecordStart(line) && buffer.length) {
        names.push(buffer.join(' '));
        buffer = [];
      }
      buffer.push(line.trim());
    }
  }
  if (buffer.length) names.push(buffer.join(' '));
  return names.map(normalizeName).filter(n => n.length > 1);
}

// Wrapper untuk processData — logika inti identik dengan
// extract_names_from_block, ditambah penghitungan statistik aplikasi
// (grup terbuang & apakah normalisasi mengubah teks asli).
function extractGuestRecords(text) {
  const lines = sanitizeRawText(text).split('\n');
  const rawGroups = [];
  let buffer = [];
  for (const line of lines) {
    if (isNoiseLine(line)) {
      if (buffer.length) { rawGroups.push(buffer.join(' ')); buffer = []; }
    } else {
      if (isRecordStart(line) && buffer.length) {
        rawGroups.push(buffer.join(' '));
        buffer = [];
      }
      buffer.push(line.trim());
    }
  }
  if (buffer.length) rawGroups.push(buffer.join(' '));

  const records = [];
  let discardedGroups = 0;
  rawGroups.forEach(raw => {
    const nama = normalizeName(raw);
    if (nama.length > 1) {
      records.push({ nama, wasFixed: nama !== raw.trim() });
    } else {
      discardedGroups++;
    }
  });

  return { records, discardedGroups };
}

// ============================================
// MODE MENTAH — 1 baris = 1 data, TANPA pembersihan/penggabungan.
// Dipakai saat tempelan tidak punya pemisah (baris kosong/nomor) yang
// bisa dideteksi extractGuestRecords() — mis. daftar WhatsApp di mana
// jabatan & nama tamu ada di baris terpisah tanpa pola tetap, sehingga
// mode Bersihkan Otomatis menggabung semuanya jadi satu nama raksasa.
// Hanya sanitasi karakter tak terlihat + trim; baris kosong dilewati.
// Penggabungan baris yang memang perlu jadi satu tamu dilakukan manual
// sesudahnya lewat mergeSelected() di table.js (centang baris di tabel).
// ============================================
function extractRawLines(text) {
  const lines = sanitizeRawText(text).split('\n');
  const records = [];
  lines.forEach(line => {
    const t = line.replace(/\r/g, '').trim();
    if (t === '') return;
    records.push({ nama: t, wasFixed: false });
  });
  return { records, discardedGroups: 0 };
}

// ============================================
// STRUCTURED TABLE DETECTION
// ============================================
const NAMA_KW = new Set(['nama', 'nama tamu', 'nama undangan', 'nama lengkap', 'nama penerima', 'nama & gelar', 'name', 'guest name', 'nama peserta', 'penerima', 'guest', 'nama lengkap tamu']);
const JABATAN_KW = new Set(['jabatan', 'instansi', 'gelar', 'title', 'posisi', 'pekerjaan', 'perusahaan', 'jabatan/instansi', 'jabatan / instansi', 'unit kerja', 'dinas']);
const ALAMAT_KW = new Set(['alamat', 'address', 'kota', 'domisili', 'alamat lengkap', 'alamat rumah']);

// Port dari clean_jabatan() — Python: `if raw is None: return ''`
// lalu str(raw), jadi nilai numerik (mis. 0) tetap jadi "0".
function cleanJabatan(raw) {
  if (raw === null || raw === undefined) return '';
  let s = sanitizeRawText(raw).replace(/\r/g, '').trim();
  s = s.replace(EMOJI_RE, '');
  s = s.replace(BULLET_RE, '');
  s = s.replace(NUMBERING_RE, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

function findHeaderAndMap(grid) {
  const maxScan = Math.min(10, grid.length);
  for (let r = 0; r < maxScan; r++) {
    const colMap = {};
    const row = grid[r] || [];
    for (let ci = 0; ci < row.length; ci++) {
      const val = row[ci];
      if (val === null || val === undefined) continue;
      const text = String(val).replace(/\s+/g, ' ').trim().toLowerCase();
      if (!text) continue;
      if (NAMA_KW.has(text)) colMap.nama = ci;
      else if (JABATAN_KW.has(text)) colMap.jabatan = ci;
      else if (ALAMAT_KW.has(text)) colMap.alamat = ci;
    }
    if ('nama' in colMap) return { headerRow: r, colMap };
  }
  return null;
}

// Port dari extract_structured_entries() — persis seperti Python:
// hanya memasangkan NAMA + JABATAN per baris. Kolom alamat yang
// terdeteksi di header sengaja TIDAK dibaca isinya (Python juga
// memetakannya tapi tidak memakainya) — ALAMAT selalu boilerplate.
function extractStructuredEntries(grid, headerRow, colMap) {
  const result = [];
  const namaCol = colMap.nama;
  const jabatanCol = colMap.jabatan;

  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    if (namaCol >= row.length) continue;
    const rawNama = row[namaCol];
    if (rawNama === null || rawNama === undefined || String(rawNama).trim() === '') continue;

    const nama = normalizeName(String(rawNama));
    if (nama.length <= 1) continue;

    let jabatan = '';
    if (jabatanCol !== undefined && jabatanCol < row.length) {
      jabatan = cleanJabatan(row[jabatanCol]);
    }

    result.push({ nama, jabatan });
  }
  return result;
}

function commitStructuredEntries(structuredEntries, sourceLabel) {
  saveHistory();
  const diValue = (document.getElementById('diText').value || '').trim() || 'Di';
  const alamatDefault = (document.getElementById('alamatBoilerplate').value || '').trim() || 'Tempat';

  let added = 0, dup = 0, trash = 0;

  structuredEntries.forEach(rec => {
    if (!rec.nama || rec.nama.length < 2) { trash++; return; }
    if (state.entries.some(e => e.nama.toLowerCase() === rec.nama.toLowerCase())) {
      dup++;
      return;
    }
    state.entries.push({
      id: Date.now() + Math.random(),
      nama: rec.nama,
      jabatan: rec.jabatan || '',
      di: diValue,
      alamat: alamatDefault, // SOP Python: ALAMAT selalu boilerplate
      keterangan: ''
    });
    added++;
  });

  addToStats({ accepted: added, duplicate: dup, trash: trash });

  renderTable();
  showToast(`Header tabel terdeteksi di "${sourceLabel}" — ${added} data ditambahkan langsung (${dup} duplikat dilewati)`, 'success');
}
