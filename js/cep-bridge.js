/* ============================================================
   cep-bridge.js — JEMBATAN PANEL ↔ ILLUSTRATOR (CEP)
   Aktif HANYA bila berjalan di dalam panel CEP Illustrator
   (window.__adobe_cep__ tersedia). Di browser biasa file ini
   tidak melakukan apa-apa — aman dimuat di kedua lingkungan.

   Menambahkan tombol "Buat di Illustrator" pada toolbar preview:
   mengubah data + pengaturan menjadi payload JSON, mengirimnya ke
   host/labelgen.jsx via evalScript → label menjadi teks vektor.
   ============================================================ */
(function () {
  if (!window.__adobe_cep__) return; // bukan di dalam Illustrator

  // Saat berjalan di dalam Illustrator dan pengguna belum pernah memilih
  // tema sendiri, otomatis pakai tema "ai" (Illustrator Slim #383838)
  // agar panel menyatu dengan UI Illustrator.
  try {
    var savedTheme = localStorage.getItem('labelUndangan_theme');
    if (savedTheme !== 'light' && savedTheme !== 'dark' && savedTheme !== 'glass' && savedTheme !== 'ai') {
      applyTheme('ai', false);
    }
  } catch (e) {}

  function evalJsx(script, cb) {
    window.__adobe_cep__.evalScript(script, cb || function () {});
  }

  // [FORMAT FIX] renderLabelData: teks polos + POSISI karakter {nama}
  // (array [mulai,akhir] per kemunculan) — agar host bisa menerapkan
  // Format Khusus Baris Nama per-karakter di TextFrame Illustrator.
  // Perilaku identik dgn preview: uppercase/smallcaps nama, baris kosong dibuang.
  function renderLabelData(entry, num) {
    var TOK = '\u0001'; // penanda posisi nama, tak mungkin ada di data
    var BLANK = '\u0002'; // penanda baris kosong eksplisit
    var nama = String(entry.nama == null ? '' : entry.nama);
    if (state.settings.format.uppercase) nama = nama.toUpperCase();
    if (state.settings.format.smallcaps) {
      nama = nama.toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    var map = {
      nama: TOK,
      jabatan: String(entry.jabatan == null ? '' : entry.jabatan),
      di: String(entry.di == null ? '' : entry.di),
      alamat: String(entry.alamat == null ? '' : entry.alamat),
      keterangan: String(entry.keterangan == null ? '' : entry.keterangan),
      nomor: String(num),
      'baris-kosong': BLANK
    };
    var text = state.settings.template.replace(
      /\{(nama|jabatan|di|alamat|keterangan|nomor|baris-kosong)\}/g,
      function (m, key) { return map[key]; }
    );
    // Buang baris data yang kosong, tetapi pertahankan {baris-kosong}.
    var lines = text.split('\n'), kept = [];
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf(BLANK) !== -1 || lines[i].split(TOK).join(nama).replace(/\s+/g, '') !== '') kept.push(lines[i]);
    }
    text = kept.join('\n');
    // ekspansi token -> teks final + catat rentang karakter nama
    var out = '', ranges = [];
    for (var c = 0; c < text.length; c++) {
      if (text.charAt(c) === TOK) {
        ranges.push([out.length, out.length + nama.length]);
        out += nama;
      } else if (text.charAt(c) === BLANK) {
        // Spasi menjaga paragraf kosong tetap ada di teks Illustrator.
        out += ' ';
      } else out += text.charAt(c);
    }
    return { t: out, r: ranges };
  }

  // "'Times New Roman', serif" -> "Times New Roman" (nama family utk AI)
  function primaryFamily(cssFont) {
    var first = String(cssFont || '').split(',')[0];
    return first.replace(/['"]/g, '').replace(/^\s+|\s+$/g, '');
  }
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function buildPayload() {
    updatePreview(); // sinkronkan state.settings dengan form terlebih dahulu
    var s = state.settings;
    var f = s.format || {};
    var ns = s.nameStyle || {};
    var disp = buildDisplayEntries();
    var labels = [];
    for (var i = 0; i < disp.length; i++) {
      labels.push(disp[i] ? renderLabelData(disp[i], i + 1) : null);
    }
    // letterSpacing panel = px pada font (fontSize pt * 1.333 px);
    // tracking AI = 1/1000 em
    var tracking = 0;
    if (s.letterSpacing) {
      tracking = Math.round(s.letterSpacing / (s.fontSize * 1.333) * 1000);
    }
    return {
      pageWidth: s.pageWidth, pageHeight: s.pageHeight,
      cols: s.cols, rows: s.rows,
      marginTop: s.marginTop, marginLeft: s.marginLeft,
      gapX: s.gapX, gapY: s.gapY, padding: s.padding,
      fontSize: s.fontSize, lineHeight: s.lineHeight,
      textAlign: s.textAlign, showCutLines: s.showCutLines,
      // [FORMAT FIX] gaya global + gaya khusus nama ikut terkirim
      fontFamily: primaryFamily(s.fontFamily),
      bold: !!f.bold, italic: !!f.italic, underline: !!f.underline,
      colorRGB: hexToRgb(s.color),
      tracking: tracking,
      nameStyle: {
        bold: !!ns.bold, italic: !!ns.italic, underline: !!ns.underline,
        scalePct: (typeof ns.scale === 'number' && ns.scale > 0) ? ns.scale : 100,
        colorRGB: ns.color ? hexToRgb(ns.color) : null
      },
      labels: labels
    };
  }

  function createInIllustrator() {
    if (state.entries.length === 0) {
      showToast('Tidak ada data. Impor data tamu terlebih dahulu.', 'warning');
      return;
    }
    showToast('Membuat label di Illustrator…', 'info');
    var payload = buildPayload();
    // Double-stringify: hasilnya string-literal JS yang aman disisipkan
    // ke dalam kode evalScript (kutip & karakter khusus ter-escape).
    var arg = JSON.stringify(JSON.stringify(payload));
    evalJsx('LUS_createLabels(' + arg + ')', function (res) {
      if (res && res.indexOf('OK:') === 0) {
        showToast('Berhasil — ' + res.slice(3), 'success');
      } else if (res && res.indexOf('ERR:') === 0) {
        showToast('Gagal: ' + res.slice(4), 'error');
      } else {
        showToast('Tidak ada respons dari Illustrator. Coba ulangi.', 'error');
      }
    });
  }

  // Diekspos global agar bisa dipanggil dari mana pun bila diperlukan.
  window.createInIllustrator = createInIllustrator;

  // [FONT SISTEM] Ambil daftar family font terinstal dari Illustrator
  // (app.textFonts) dan tambahkan ke dropdown Font Family sebagai
  // optgroup "Font Terinstal". Nilai option = 'Family' (CSS-valid utk
  // preview; primaryFamily() di payload mengupas kutip utk host).
  function loadSystemFonts() {
    var expr =
      "(function(){var s={},out=[],i,f;" +
      "for(i=0;i<app.textFonts.length;i++){f=app.textFonts[i].family;" +
      "if(!s[f]){s[f]=1;out.push(f);}}" +
      "out.sort();return out.join('|');})()";
    evalJsx(expr, function (res) {
      if (!res || /^EvalScript/i.test(res)) return; // gagal diam-diam, daftar kurasi tetap ada
      var sel = document.getElementById('fontFamily');
      if (!sel) return;
      var families = String(res).split('|');
      if (!families.length || families[0] === '') return;
      var og = document.createElement('optgroup');
      og.label = 'Font Terinstal (' + families.length + ')';
      for (var i = 0; i < families.length; i++) {
        if (!families[i]) continue;
        var o = document.createElement('option');
        o.value = "'" + families[i] + "'";
        o.textContent = families[i];
        og.appendChild(o);
      }
      sel.appendChild(og);
      // pulihkan pilihan tersimpan bila itu salah satu font terinstal
      // (saat init, option-nya belum ada sehingga select jatuh ke default)
      try {
        if (state.settings.fontFamily && sel.value !== state.settings.fontFamily) {
          sel.value = state.settings.fontFamily;
          if (sel.value !== state.settings.fontFamily) sel.selectedIndex = 0; // benar2 tak ada
        }
      } catch (e) {}
    });
  }

  // Suntik tombol ke toolbar preview (di samping tombol Cetak).
  function inject() {
    var controls = document.querySelectorAll('.preview-toolbar .preview-controls');
    var target = controls[controls.length - 1];
    if (!target || document.getElementById('btnAiCreate')) return;
    var btn = document.createElement('button');
    btn.id = 'btnAiCreate';
    btn.className = 'btn btn-success btn-sm';
    btn.title = 'Buat semua label sebagai teks vektor di dokumen Illustrator baru';
    btn.innerHTML = '<i class="fas fa-bezier-curve"></i> Buat di Illustrator';
    btn.onclick = createInIllustrator;
    target.appendChild(btn);
  }
  function boot() {
    inject();
    loadSystemFonts(); /* [FONT SISTEM] isi dropdown dari font terinstal */
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
