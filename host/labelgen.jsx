/* ============================================================
   labelgen.jsx — SISI ILLUSTRATOR (ExtendScript, ES3)
   Dipanggil dari panel CEP via evalScript (lihat js/cep-bridge.js).
   Membuat label sebagai AREA TEXT VEKTOR asli dalam grid, satu
   artboard per halaman — hasilnya bisa diedit bebas di Illustrator.
   CATATAN ES3: tidak ada JSON.parse/const/arrow — jangan modernisasi.
   ============================================================ */

// [FORMAT FIX] cari varian font (Bold/Italic) dari family — Illustrator
// TIDAK punya faux-bold via script; bold/italic = memilih font face lain.
// Dipanggil maks 2x per run (base + nama), loop textFonts sekali jalan.
function LUS_findFont(family, bold, italic) {
    if (!family) return null;
    var wants;
    if (bold && italic) wants = ["Bold Italic", "BoldItalic", "Bold Oblique"];
    else if (bold) wants = ["Bold", "Semibold", "Heavy"];
    else if (italic) wants = ["Italic", "Oblique"];
    else wants = ["Regular", "Roman", "Plain", "Book", "Normal", "Medium"];
    var fallback = null, i, f, w;
    for (i = 0; i < app.textFonts.length; i++) {
        f = app.textFonts[i];
        if (f.family !== family) continue;
        for (w = 0; w < wants.length; w++) if (f.style === wants[w]) return f;
        if (!fallback) fallback = f; // family cocok, style apa adanya
    }
    return fallback;
}

function LUS_rgb(o) {
    if (!o) return null;
    var c = new RGBColor();
    c.red = o.r; c.green = o.g; c.blue = o.b;
    return c;
}

function LUS_createLabels(jsonStr) {
  try {
    var d = eval('(' + jsonStr + ')'); // payload dari panel (sudah tervalidasi di sana)
    var MM = 2.834645669; // 1 mm = 2.83465 pt

    var pW = d.pageWidth * MM, pH = d.pageHeight * MM;
    var mT = d.marginTop * MM, mL = d.marginLeft * MM;
    var gX = d.gapX * MM, gY = d.gapY * MM, pad = d.padding * MM;
    var cols = d.cols, rows = d.rows, perPage = cols * rows;

    var usableW = pW - mL * 2 - gX * (cols - 1);
    var usableH = pH - mT * 2 - gY * (rows - 1);
    var cellW = usableW / cols, cellH = usableH / rows;

    var pages = Math.ceil(d.labels.length / perPage);
    if (pages < 1) pages = 1;
    if (pages > 100) return 'ERR:Melebihi 100 artboard (batas Illustrator). Kurangi data atau cetak bertahap.';

    var doc = app.documents.add(DocumentColorSpace.RGB, pW, pH);

    // Artboard tambahan per halaman — GRID maksimal 6 kolom:
    // setelah kolom ke-6 terisi, artboard berikutnya turun ke baris
    // baru agar tidak menabrak batas kanvas Illustrator (16383 pt).
    var SPACING = 20;
    var AB_COLS = 6;
    var base = doc.artboards[0].artboardRect; // acuan posisi artboard pertama
    var baseL = base[0], baseT = base[1];
    var p;
    for (p = 1; p < pages; p++) {
      var abCol = p % AB_COLS;
      var abRow = Math.floor(p / AB_COLS);
      var x = baseL + abCol * (pW + SPACING);
      var y = baseT - abRow * (pH + SPACING);
      doc.artboards.add([x, y, x + pW, y - pH]);
    }

    // DUA layer terpisah:
    //  - "Label"       : semua teks — TIDAK terkunci, bebas diedit.
    //  - "Guide Potong": kotak guide asli Illustrator — DIKUNCI di akhir.
    // FIX PENTING: textFrames.areaText() SELALU menaruh teks di layer
    // yang sedang AKTIF (mengabaikan layer si path). Maka layer guide
    // TIDAK dibuat di sini — semua teks dibuat dulu selagi "Label"
    // adalah satu-satunya layer; guide menyusul SETELAH loop teks
    // (lihat bawah), sehingga keduanya dijamin terpisah.
    var labelLayer = doc.layers[0];
    labelLayer.name = 'Label';
    labelLayer.locked = false; // pertegas: layer teks selalu bisa diedit
    doc.activeLayer = labelLayer;

    var just = Justification.LEFT;
    if (d.textAlign === 'center') just = Justification.CENTER;
    else if (d.textAlign === 'right') just = Justification.RIGHT;
    else if (d.textAlign === 'justify') just = Justification.FULLJUSTIFYLASTLINELEFT;

    // [FORMAT FIX] siapkan gaya SEKALI di awal (bukan per label):
    // font varian global, font varian nama, warna, ukuran nama.
    var ns = d.nameStyle || {};
    var baseFont = null, nameFont = null;
    try { baseFont = LUS_findFont(d.fontFamily, !!d.bold, !!d.italic); } catch (eF1) {}
    try { nameFont = LUS_findFont(d.fontFamily, !!d.bold || !!ns.bold, !!d.italic || !!ns.italic); } catch (eF2) {}
    var fillCol = LUS_rgb(d.colorRGB);
    var nameCol = LUS_rgb(ns.colorRGB); // null = ikut warna label
    var nameSizePt = d.fontSize * (((typeof ns.scalePct === 'number' && ns.scalePct > 0) ? ns.scalePct : 100) / 100);
    var trackVal = (typeof d.tracking === 'number') ? d.tracking : 0;

    var made = 0;
    for (p = 0; p < pages; p++) {
      // Selalu baca rect artboard sendiri — aman terhadap perbedaan
      // konvensi koordinat artboard pertama vs artboard tambahan.
      var ab = doc.artboards[p].artboardRect; // [kiri, atas, kanan, bawah]
      var abL = ab[0], abT = ab[1];

      for (var i = 0; i < perPage; i++) {
        var idx = p * perPage + i;
        if (idx >= d.labels.length) break;

        var r = Math.floor(i / cols), c = i % cols;
        var left = abL + mL + c * (cellW + gX);
        var top = abT - mT - r * (cellH + gY);

        // [FORMAT FIX] label kini objek { t: teks, r: [[mulai,akhir],...] }
        // (r = rentang karakter {nama}); string lama tetap didukung.
        var lbl = d.labels[idx];
        if (lbl === null) continue; // slot offset
        var content = (typeof lbl === 'string') ? lbl : String(lbl.t || '');
        var nameRanges = (lbl && lbl.r) ? lbl.r : [];
        if (content === '') continue;

        // [LINE BREAK FIX] ExtendScript/Illustrator butuh \r (carriage
        // return) untuk pemisah baris di TextFrame.contents — \n (yang
        // dipakai payload/JS di sisi panel) sering TIDAK dianggap baris
        // baru saat langsung di-assign ke .contents, sehingga baris yang
        // seharusnya terpisah (mis. hasil "Gabung" 2 baris di tabel)
        // malah nyambung. Ganti 1:1 di sini (jumlah karakter tidak
        // berubah, jadi nameRanges dari cep-bridge.js tetap valid).
        content = content.replace(/\n/g, '\r');

        var tPath = labelLayer.pathItems.rectangle(
          top - pad, left + pad, cellW - pad * 2, cellH - pad * 2);
        var tf = doc.textFrames.areaText(tPath);
        tf.contents = content;
        // Pengaman ganda: paksa pindah ke layer Label apa pun yang terjadi.
        try { tf.move(labelLayer, ElementPlacement.PLACEATBEGINNING); } catch (eM) {}

        var leadingPt = d.fontSize * d.lineHeight;
        var tr = tf.textRange;
        tr.characterAttributes.size = d.fontSize;
        tr.characterAttributes.autoLeading = false;
        tr.characterAttributes.leading = leadingPt;
        tr.paragraphAttributes.justification = just;

        // [FORMAT FIX] gaya GLOBAL: font varian (bold/italic), warna,
        // underline, tracking — tiap properti dibungkus try agar satu
        // kegagalan (mis. font tak ada) tidak menggagalkan label.
        try { if (baseFont) tr.characterAttributes.textFont = baseFont; } catch (eS1) {}
        try { if (fillCol) tr.characterAttributes.fillColor = fillCol; } catch (eS2) {}
        try { if (d.underline) tr.characterAttributes.underline = true; } catch (eS3) {}
        try { if (trackVal) tr.characterAttributes.tracking = trackVal; } catch (eS4) {}

        // [FORMAT FIX] gaya KHUSUS NAMA per-karakter sesuai rentang.
        // Label pendek (<300 char) -> loop per karakter aman & akurat.
        if (nameRanges.length) {
          for (var nr = 0; nr < nameRanges.length; nr++) {
            var rs = nameRanges[nr][0], re = nameRanges[nr][1];
            if (re > tf.characters.length) re = tf.characters.length;
            for (var cc = rs; cc < re; cc++) {
              var ca = tf.characters[cc].characterAttributes;
              try { if (nameFont) ca.textFont = nameFont; } catch (eN1) {}
              try { if (nameCol) ca.fillColor = nameCol; } catch (eN2) {}
              try { if (ns.underline) ca.underline = true; } catch (eN3) {}
              try { if (nameSizePt !== d.fontSize) ca.size = nameSizePt; } catch (eN4) {}
            }
          }
        }

        // FIX POSISI VERTIKAL: area text Illustrator selalu menempelkan
        // teks ke sisi ATAS frame. Tinggi blok teks VISUAL dihitung sbg:
        //   (jumlahBaris - 1) × leading + capHeight
        // BUKAN jumlahBaris × leading — baris pertama hanya setinggi
        // huruf kapitalnya (≈72% ukuran font), bukan satu leading penuh.
        // Perhitungan lama menaksir tinggi terlalu besar sehingga teks
        // berhenti sedikit di ATAS tengah. Frame lalu digeser ke bawah
        // sebesar setengah sisa ruang → teks tepat di tengah vertikal.
        try {
          var lineCount = tf.lines.length; // termasuk baris hasil wrap
          if (lineCount < 1) lineCount = 1;
          var CAP = d.fontSize * 0.72; // aproksimasi cap-height font umum
          var availH = cellH - pad * 2;
          var textH = (lineCount - 1) * leadingPt + CAP;
          var vOffset = (availH - textH) / 2;
          if (vOffset > 0) tf.top = tf.top - vOffset;
        } catch (eV) { /* jika gagal ukur, biarkan posisi default */ }
        made++;
      }
    }

    // ---- LOOP GUIDE (setelah SEMUA teks selesai dibuat) ----
    // Layer guide baru dibuat di sini agar tidak pernah menjadi layer
    // aktif saat areaText() berjalan. Semua kotak guide dibuat eksplisit
    // di guideLayer.pathItems, lalu layer dikunci.
    var guideLayer = null;
    if (d.showCutLines) {
      guideLayer = doc.layers.add();
      guideLayer.name = 'Guide Potong (terkunci)';
      for (p = 0; p < pages; p++) {
        var gab = doc.artboards[p].artboardRect;
        var gabL = gab[0], gabT = gab[1];
        for (var gi = 0; gi < perPage; gi++) {
          var gidx = p * perPage + gi;
          if (gidx >= d.labels.length) break;
          var gr = Math.floor(gi / cols), gc = gi % cols;
          var gLeft = gabL + mL + gc * (cellW + gX);
          var gTop = gabT - mT - gr * (cellH + gY);
          var rect = guideLayer.pathItems.rectangle(gTop, gLeft, cellW, cellH);
          rect.filled = false;
          rect.stroked = false;
          rect.guides = true;
        }
      }
      guideLayer.locked = true; // kunci HANYA layer guide
    }

    // Layer "Label" (teks) dijamin terbuka & aktif agar bebas diedit.
    labelLayer.locked = false;
    doc.activeLayer = labelLayer;

    app.redraw();
    var abRows = Math.ceil(pages / AB_COLS);
    return 'OK:' + made + ' label dibuat pada ' + pages + ' artboard (grid ' +
           Math.min(pages, AB_COLS) + ' kolom × ' + abRows + ' baris)' +
           (guideLayer ? ', guide potong terkunci' : '');
  } catch (e) {
    return 'ERR:' + e.message;
  }
}
