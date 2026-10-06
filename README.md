# Label Undangan Studio — Struktur Modular

Aplikasi web offline untuk membersihkan daftar nama tamu & mencetak label undangan.
Browser hanya runtime — buka `index.html` langsung (double-click / `file://`), tidak butuh server.

## Struktur Folder

```
label-studio/
├── index.html            ← Kerangka HTML + urutan pemuatan script (TANPA logika)
├── css/
│   └── styles.css        ← Semua styling; 3 tema via [data-theme]: light / dark / glass
├── js/                   ← Modul JavaScript (plain script global, BUKAN ES module)
│   ├── state.js          ← State global, DEFAULT_SETTINGS, helper normId/toNum/toInt
│   ├── utils.js          ← escapeHtml, showToast, downloadFile, accordion, statistik
│   ├── theme.js          ← Tema light/dark/glass + mode ikuti-sistem
│   ├── parser.js         ← Mesin pembersih nama (port Python SOP) + deteksi tabel Nama/Jabatan
│   ├── table.js          ← Text Manager: proses tempel, render/CRUD tabel, seleksi, Enter-nav
│   ├── import-export.js  ← Ekspor JSON/CSV/XLSX, impor, drag&drop, pipeline baca file
│   ├── designer.js       ← Label Maker: preview, template, preset label, cek-muat, auto-fit
│   ├── printing.js       ← buildPrintHTML (juga dipakai cek-muat), @page, doPrint
│   ├── tools.js          ← Alat bantu teks, boilerplate Di/Alamat, filter tabel
│   ├── settings.js       ← Modal pengaturan: tema, preset kertas, backup/restore, reset
│   ├── app.js            ← Stepper, auto-save, undo/redo, keyboard, number-stepper, INIT
│   └── cep-bridge.js     ← Jembatan panel↔Illustrator (aktif hanya di dalam CEP)
├── CSXS/manifest.xml     ← Deklarasi extension CEP Illustrator (lihat README-CEP.md)
├── host/labelgen.jsx     ← ExtendScript: buat label teks vektor di Illustrator
├── aktifkan-debug-cep.reg← Izinkan extension unsigned (double-click sekali)
└── libs/                 ← (buat manual) library offline — lihat bagian Offline di bawah
```

> 🔌 **Folder ini sekaligus extension Adobe Illustrator (CEP 11, AI 2021+).**
> Panduan instalasi & batasan: **`README-CEP.md`**. Di browser biasa,
> file-file CEP tidak aktif dan tidak mengganggu apa pun.

## Aturan Penting (WAJIB dipatuhi saat mengubah kode)

1. **Semua fungsi bersifat GLOBAL** (plain `<script>`, bukan ES module).
   Ada ±69 titik `onclick="namaFungsi()"` di index.html yang memanggilnya
   langsung. JANGAN mengubah ke `export`/`import` atau membungkus dalam
   namespace tanpa mengekspos ulang ke `window` — tombol akan mati.
   Plain script juga wajib agar app tetap jalan via `file://` (ES module
   diblokir CORS pada file://).

2. **Urutan `<script>` di index.html tidak boleh diubah** — `app.js`
   harus paling akhir karena berisi `init()`. Script dimuat di akhir
   `<body>` sehingga kode execution-time (event listener DOM) aman.

3. **Kunci localStorage**: `labelUndangan_entries`, `labelUndangan_settings`,
   `labelUndangan_boiler`, `labelUndangan_theme` — jangan diganti nama,
   data pengguna lama akan hilang.

4. **`buildPrintHTML()` (printing.js) dipakai dua tempat**: cetak dan
   pengukuran overflow (`measureOverflow` di designer.js, via kelas `.pcell`).
   Ubah dengan hati-hati — keduanya harus tetap konsisten.

5. **parser.js adalah SOP pengguna** (port dari script Python
   `konverter_desktop_v2.py`). Jangan tambahkan pemecahan nama/alamat di
   koma — nama bergelar ("Dewi Lestari, S.I.Kom.") harus tetap utuh.

## Mode Offline

`index.html` memuat library lokal-dulu dengan fallback CDN:

| File lokal yang dicari              | Fallback CDN            | Fungsi           |
|-------------------------------------|-------------------------|------------------|
| `libs/xlsx.full.min.js`             | cdnjs xlsx 0.18.5       | Baca/tulis Excel |
| `libs/mammoth.browser.min.js`       | cdnjs mammoth 1.6.0     | Baca Word .docx  |
| `libs/fontawesome/css/all.min.css`  | cdnjs Font Awesome 6.4  | Ikon             |
| `libs/fonts/inter.css`              | Google Fonts            | Font UI (Inter)  |

Tanpa folder `libs/`, app tetap berfungsi penuh selama ada internet.
Tailwind CDN versi lama sudah DIHAPUS — tidak pernah dipakai (0 class);
`libs/tailwind.js` dari paket lama tidak dimuat dan boleh dihapus.

### Memasang libs/ dari repo GitHub pengguna (SUDAH TERVERIFIKASI COCOK)

Path di index.html sudah disesuaikan 1:1 dengan struktur repo
`github.com/jfuad39-creator/LIBS` (per verifikasi terakhir):

```
libs/
├── fontawesome/
│   ├── css/all.min.css     ✓ dipakai
│   └── webfonts/           ✓ dipakai (dirujuk oleh all.min.css)
├── fonts/
│   ├── files/              ✓ dipakai (dirujuk oleh inter.css)
│   └── inter.css           ✓ dipakai
├── mammoth.browser.min.js  ✓ dipakai
├── tailwind.js             ✗ TIDAK dipakai (boleh dihapus)
└── xlsx.full.min.js        ✓ dipakai
```

Langkah pemasangan (sekali saja):

1. Buka https://github.com/jfuad39-creator/LIBS
2. Klik tombol hijau **Code** → **Download ZIP**
3. Ekstrak ZIP → akan ada folder `LIBS-main/` berisi folder `libs/`
4. Copy **folder `libs/` itu saja** ke dalam folder `label-studio/` ini,
   sejajar dengan `index.html` (JANGAN copy file lain dari ZIP)
5. Uji: matikan internet → buka `index.html` → ikon tampil normal,
   impor Excel berfungsi, dan huruf memakai font Inter

Font: online memakai *Plus Jakarta Sans* (Google Fonts); offline otomatis
memakai *Inter* dari `libs/fonts/` — keduanya sudah didaftarkan di
font-stack `css/styles.css`, tidak perlu diubah apa-apa.

## Cara Troubleshoot Hemat Token dengan AI

> 📖 **Pengguna non-teknis:** baca **`PANDUAN-PROMPT.md`** — berisi template
> prompt siap copy-paste, cara ambil error dari Console (F12), contoh prompt
> terisi, dan solusi cepat untuk masalah umum.

Jangan upload seluruh folder. Cukup lampirkan **file modul yang relevan** + README ini:

| Gejala masalah                                  | File yang dilampirkan      |
|--------------------------------------------------|----------------------------|
| Hasil pembersihan nama salah                     | `js/parser.js`             |
| Tabel data / tombol baris / seleksi bermasalah   | `js/table.js`              |
| Gagal impor/ekspor file atau drag&drop           | `js/import-export.js`      |
| Preview label / template / preset / cek-muat     | `js/designer.js`           |
| Hasil cetak tidak sesuai preview                 | `js/printing.js` (+designer)|
| Alat bantu teks / Di-Alamat / filter             | `js/tools.js`              |
| Modal pengaturan / backup / tema dari modal      | `js/settings.js`           |
| Undo-redo / auto-save / startup / stepper        | `js/app.js`                |
| Tampilan / warna / tema                          | `css/styles.css`           |
| Tombol tidak terhubung / elemen hilang           | `index.html`               |
