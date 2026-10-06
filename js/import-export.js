/* ============================================================
   import-export.js — EKSPOR / IMPOR FILE & DRAG-AND-DROP
   Ekspor JSON/CSV(;)/XLSX, impor editor (JSON/CSV/XLSX), dan
   pipeline unggah file (drag&drop) TXT/CSV/XLSX/XLS/DOCX yang
   memakai parser.js untuk deteksi tabel & pembersihan teks.
   ============================================================ */

function exportData(format) {
  if (state.entries.length === 0) {
    showToast('Tidak ada data untuk diekspor', 'warning');
    return;
  }

  if (format === 'json') {
    const data = JSON.stringify(state.entries, null, 2);
    downloadFile(data, 'label-data.json', 'application/json');
  } else if (format === 'csv') {
    const rows = [['Nama', 'Jabatan', 'Di', 'Alamat', 'Keterangan']];
    state.entries.forEach(e => rows.push([e.nama, e.jabatan, e.di, e.alamat, e.keterangan]));
    const csv = rows.map(r => r.map(c => '"' + (c || '').replace(/"/g, '""') + '"').join(';')).join('\n');
    downloadFile('\ufeff' + csv, 'label-data.csv', 'text/csv');
  } else if (format === 'xlsx') {
    const data = [['Nama', 'Jabatan', 'Di', 'Alamat', 'Keterangan']];
    state.entries.forEach(e => data.push([e.nama, e.jabatan, e.di, e.alamat, e.keterangan]));
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Tamu');
    XLSX.writeFile(wb, 'label-data.xlsx');
  }
  showToast('Data berhasil diekspor', 'success');
}

// FIX: proper CSV line parser (RFC-4180 style). The old importer used a
// naive split(';') that broke any quoted field containing the delimiter,
// and never un-escaped doubled quotes ("") — so exporting then re-importing
// the same CSV silently corrupted the data.
function parseDelimitedLine(line, delim) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(c => c.trim());
}

// FIX: pick the delimiter that actually appears most in the header line
// (the old `raw.includes(';') ? ';' : ','` misfired when a comma-CSV merely
// contained a stray semicolon inside a value).
function detectDelimiter(firstLine) {
  const candidates = [';', ',', '\t'];
  let best = ';', bestCount = 0;
  candidates.forEach(d => {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) { best = d; bestCount = count; }
  });
  return best;
}

// FIX: parses the WHOLE csv text in one pass (bukan per baris seperti
// sebelumnya) supaya sel bertanda kutip yang berisi baris baru — mis.
// nama hasil tombol "Gabung" 2 baris di tabel, yang diekspor sebagai 1
// sel CSV berisi \n di dalam tanda kutip — tetap dikenali sebagai SATU
// sel saat diimpor kembali, bukan pecah jadi baris tabel tambahan.
// Menangani \r\n / \n / \r sebagai pemisah baris dan "" sebagai escape
// kutip di dalam sel (RFC 4180). Baris yang seluruh selnya kosong dibuang.
function parseCsvText(text, delim) {
  const rows = [];
  let row = [], cur = '', inQuotes = false, i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cur += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delim) { row.push(cur); cur = ''; i++; continue; }
    if (ch === '\n' || ch === '\r') {
      row.push(cur); cur = '';
      rows.push(row); row = [];
      if (ch === '\r' && text[i + 1] === '\n') i++;
      i++; continue;
    }
    cur += ch; i++;
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); } // baris terakhir tanpa newline penutup

  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c !== ''));
}

// Baris fisik pertama saja (sampai \n/\r pertama) — cukup untuk deteksi
// delimiter tanpa perlu parsing kutip penuh (header jarang berisi sel
// bertanda kutip dengan baris baru di dalamnya).
function firstPhysicalLine(text) {
  const m = /^[^\r\n]*/.exec(text);
  return m ? m[0] : text;
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;

  saveHistory();
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'json') {
    file.text().then(text => {
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('Format JSON tidak sesuai (harus berupa array).');
        // FIX: String() coercion — numeric/null cells previously crashed
        // renderTable via escapeHtml; also skip non-object rows safely.
        state.entries = parsed
          .filter(row => row && typeof row === 'object')
          .map((row, i) => ({
            id: Date.now() + i + Math.random(),
            nama: String(row.nama ?? ''),
            jabatan: String(row.jabatan ?? ''),
            di: String(row.di ?? '') || 'Di',
            alamat: String(row.alamat ?? '') || 'Tempat',
            keterangan: String(row.keterangan ?? '')
          }));
        state.selected.clear();
        renderTable();
        showToast('Data JSON berhasil diimpor (' + state.entries.length + ' baris)', 'success');
      } catch (err) {
        console.error(err);
        showToast('Gagal membaca file JSON: ' + err.message, 'error');
      }
    });
  } else if (ext === 'csv') {
    file.text().then(text => {
      // FIX: parse seluruh teks file sekaligus lewat parseCsvText() (bukan
      // split baris dulu) — auto-detect delimiter, sadar-kutip, dan sel
      // yang mengandung baris baru (nama hasil "Gabung") tidak pecah jadi
      // baris tambahan. Hanya skip baris 0 sebagai header bila memang berisi "nama".
      const cleanText = text.replace(/^\ufeff/, '');
      const delim = detectDelimiter(firstPhysicalLine(cleanText));
      const rows = parseCsvText(cleanText, delim);
      if (rows.length === 0) {
        showToast('File CSV kosong', 'warning');
        return;
      }
      const startIdx = rows[0].some(c => c.toLowerCase() === 'nama') ? 1 : 0;
      const entries = [];
      for (let i = startIdx; i < rows.length; i++) {
        const cols = rows[i];
        if (!cols.some(c => c && c.trim())) continue; // skip blank rows
        entries.push({
          id: Date.now() + i + Math.random(),
          nama: cols[0] || '',
          jabatan: cols[1] || '',
          di: cols[2] || 'Di',
          alamat: cols[3] || 'Tempat',
          keterangan: cols[4] || ''
        });
      }
      state.entries = entries;
      state.selected.clear();
      renderTable();
      showToast('Data CSV berhasil diimpor (' + entries.length + ' baris)', 'success');
    });
  } else if (ext === 'xlsx') {
    file.arrayBuffer().then(data => {
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);
      // FIX: case-insensitive header lookup (NAMA/Nama/nama all work) and
      // String() coercion so numeric cells can't crash the table render.
      const pick = (row, name) => {
        const k = Object.keys(row).find(key => key.trim().toLowerCase() === name);
        return k !== undefined ? String(row[k] ?? '').trim() : '';
      };
      state.entries = json.map((row, i) => ({
        id: Date.now() + i + Math.random(),
        nama: pick(row, 'nama'),
        jabatan: pick(row, 'jabatan'),
        di: pick(row, 'di') || 'Di',
        alamat: pick(row, 'alamat') || 'Tempat',
        keterangan: pick(row, 'keterangan')
      }));
      state.selected.clear();
      renderTable();
      showToast('Data Excel berhasil diimpor (' + state.entries.length + ' baris)', 'success');
    });
  } else {
    showToast('Format file tidak didukung: ' + file.name, 'warning');
  }

  input.value = '';
}

// ============================================
// DRAG & DROP
// [execution-time: butuh DOM — script dimuat di akhir <body>]
// ============================================
const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('click', () => document.getElementById('fileInput').click());
dropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    document.getElementById('fileInput').click();
  }
});
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
document.getElementById('fileInput').addEventListener('change', e => {
  handleFiles(e.target.files);
  e.target.value = '';
});

async function handleFiles(files) {
  if (!files || files.length === 0) return;
  showToast('Membaca ' + files.length + ' file...', 'success');

  let combinedText = '';

  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      let text = '';

      if (ext === 'txt') {
        text = await file.text();
      } else if (ext === 'csv') {
        const raw = await file.text();
        // FIX: parser sadar-kutip untuk SELURUH teks (parseCsvText, sama
        // dengan importer editor) — sel dengan baris baru di dalam tanda
        // kutip (nama hasil "Gabung") tidak pecah jadi baris grid tambahan.
        const cleanRaw = raw.replace(/^\ufeff/, '');
        const delimiter = cleanRaw ? detectDelimiter(firstPhysicalLine(cleanRaw)) : ';';
        const grid = parseCsvText(cleanRaw, delimiter);

        const headerInfo = findHeaderAndMap(grid);
        if (headerInfo) {
          const structured = extractStructuredEntries(grid, headerInfo.headerRow, headerInfo.colMap);
          if (structured.length > 0) {
            commitStructuredEntries(structured, file.name);
            continue;
          }
        }
        // Fallback ala Python: tiap SEL diperlakukan sebagai blok teks
        // bebas tersendiri (dipisah baris kosong agar grouping
        // extract_names_from_block per-sel tetap akurat).
        text = grid
          .flatMap(row => (row || []).filter(c => c !== null && c !== undefined && String(c).trim() !== ''))
          .map(String)
          .join('\n\n');
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });

        // Port dari extract_from_xlsx(): iterasi SEMUA worksheet.
        // Per sheet: deteksi header → pasangkan Nama+Jabatan; kalau
        // tidak ada tabel jelas, tiap sel non-kosong menjadi blok teks
        // bebas tersendiri (persis fallback per-sel di Python).
        const freeCellTexts = [];
        let structuredTotal = 0;

        wb.SheetNames.forEach(sheetName => {
          const sheet = wb.Sheets[sheetName];
          const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
          if (!grid.length) return;

          const headerInfo = findHeaderAndMap(grid);
          if (headerInfo) {
            const structured = extractStructuredEntries(grid, headerInfo.headerRow, headerInfo.colMap);
            if (structured.length > 0) {
              commitStructuredEntries(structured, file.name + (wb.SheetNames.length > 1 ? ' — sheet "' + sheetName + '"' : ''));
              structuredTotal += structured.length;
              return;
            }
          }

          grid.forEach(row => (row || []).forEach(cell => {
            if (cell !== null && cell !== undefined && String(cell).trim() !== '') {
              freeCellTexts.push(String(cell));
            }
          }));
        });

        if (freeCellTexts.length === 0) {
          if (structuredTotal === 0) {
            showToast('Tidak ada teks yang ditemukan di ' + file.name, 'warning');
          }
          continue; // sheet terstruktur sudah di-commit langsung
        }
        text = freeCellTexts.join('\n\n');
      } else if (ext === 'docx') {
        const buf = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        text = result.value || '';
      } else {
        showToast('Format file tidak didukung: ' + file.name, 'warning');
        continue;
      }

      if (text && text.trim()) {
        combinedText += (combinedText ? '\n\n' : '') + text.trim();
      } else {
        showToast('Tidak ada teks yang ditemukan di ' + file.name, 'warning');
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal membaca file: ' + file.name, 'error');
    }
  }

  if (combinedText) {
    const textarea = document.getElementById('rawInput');
    textarea.value = textarea.value.trim()
      ? textarea.value.trim() + '\n\n' + combinedText
      : combinedText;
    showToast('Data dari file dimasukkan ke kotak teks — klik "Proses & Rapikan Data"', 'success');
  }
}
