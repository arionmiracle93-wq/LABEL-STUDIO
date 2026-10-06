# 🔌 Panduan Plugin Adobe Illustrator (CEP)
### Label Undangan Studio sebagai panel di dalam Illustrator

Folder `label-studio/` ini **sekaligus merupakan extension CEP** — tidak ada
proyek terpisah. File khusus plugin:

```
label-studio/
├── CSXS/manifest.xml        ← deklarasi extension (host ILST, versi, ukuran panel, ikon)
├── host/labelgen.jsx        ← sisi Illustrator: membuat label teks vektor (ExtendScript)
├── js/cep-bridge.js         ← jembatan panel↔Illustrator (no-op di browser biasa)
├── icons/panel-icon.png     ← ikon tab panel (mode collapse di sisi kanan Illustrator)
└── aktifkan-debug-cep.reg   ← sekali klik: izinkan extension tanpa tanda tangan
```

### Tema "Illustrator Slim" 🖊️

Tema ke-4 yang meniru panel Illustrator tema "Dark": latar **#323232**
(disamakan dengan sampel warna UI Illustrator pengguna), kontrol kecil
radius 4px, kepadatan tinggi (semua padding/font diperkecil), aksen rose
mengikuti identitas aplikasi (kontras teks ≥ 4.5:1 di atas abu panel).
**Otomatis aktif** saat panel pertama kali dibuka di
dalam Illustrator (bila belum pernah memilih tema). Bisa diganti kapan pun
lewat tombol tema (siklus: terang→gelap→glass→slim) atau modal Pengaturan.

Dibuka di browser biasa? Semua tetap berjalan seperti biasa — bagian CEP
otomatis tidak aktif. Satu folder, dua cara pakai.

---

## Kompatibilitas (PENTING)

| Illustrator | CEP | Chromium | Status |
|---|---|---|---|
| **2021 (25.x) — versi Anda** | 11 | 88 | ✅ Jalan penuh tanpa perubahan kode |
| 2022+ (26.x+) | 11 | 88+ | ✅ Jalan |
| 2020 (24.x) ke bawah | ≤10 | ≤74 | ❌ Sintaks modern (`??`, `?.`) tidak didukung — butuh transpile |

---

## Instalasi (Windows, sekali saja)

1. **Aktifkan mode debug** — double-click `aktifkan-debug-cep.reg` → Yes.
   (Tanpa ini Illustrator menolak extension yang belum ditandatangani.)
2. **Copy seluruh folder `label-studio`** ke:
   ```
   C:\Users\<NamaAnda>\AppData\Roaming\Adobe\CEP\extensions\label-undangan-studio
   ```
   (Ketik `%APPDATA%\Adobe\CEP\extensions` di address bar Explorer.
   Bila folder `extensions` belum ada, buat manual.)
3. **Restart Illustrator** → menu **Window > Extensions > Label Undangan Studio**.

macOS: jalankan di Terminal `defaults write com.adobe.CSXS.11 PlayerDebugMode 1`,
lalu copy folder ke `~/Library/Application Support/Adobe/CEP/extensions/`.

---

## Cara Pakai di Illustrator

Alur sama seperti versi browser (Impor → Edit → Desain), tapi di langkah
Cetak ada tombol baru **"Buat di Illustrator"** (hijau, samping tombol Cetak):

- Semua label dibuat sebagai **area text vektor asli** dalam grid presisi
  (mm → point), **satu artboard per halaman**, pada dokumen baru
- **Artboard tersusun grid maksimal 6 kolom** — halaman ke-7 dst otomatis
  turun ke baris berikutnya, aman dari batas kanvas Illustrator (16383 pt)
- Hasil terdiri dari **2 layer terpisah**: layer **"Label"** berisi semua
  teks (TIDAK terkunci — bebas diedit) dan layer **"Guide Potong
  (terkunci)"** berisi kotak guide asli Illustrator (View > Guides) yang
  otomatis dikunci — tidak ikut tercetak & tidak bisa tergeser tak sengaja
  (buka kunci: klik ikon gembok di panel Layers bila perlu)
- Teks **di tengah vertikal** tiap box guide (tinggi blok teks — termasuk
  baris hasil word-wrap — dihitung, lalu frame digeser otomatis)
- Ukuran font, line-height, dan alignment ikut terbawa
- **[v2 format-fix] SEMUA format teks kini ikut terbawa**: font family,
  bold/italic (via varian font asli), underline, warna, letter-spacing,
  serta Format Khusus Baris Nama (bold/italic/underline/ukuran %/warna)
  yang diterapkan per-karakter tepat pada teks nama. Payload panel kini
  mengirim rentang karakter {nama} per label (`labels[i] = {t, r}`).
  Catatan font: bila varian Bold/Italic dari font tsb tidak terinstal di
  sistem, Illustrator memakai face yang tersedia dari family itu (tidak
  ada faux-bold via script — batasan API AI).
- **[v2.1] Pilih tema LANGSUNG** — ikon di switch tema (☀🌙💎🖊) kini bisa
  diklik langsung menuju temanya (dulu selalu bersiklus: mau dark harus
  lewat light dulu). Klik area pill di luar ikon tetap bersiklus.
  Berlaku juga di versi web app.
- Setelah itu bebas: ganti font premium, warna, efek — lalu cetak/simpan
  dari Illustrator dengan kualitas vektor penuh

Ini menggantikan `window.print()` yang di dalam panel CEP memang tidak andal
— dan hasilnya jauh lebih baik untuk workflow percetakan.

## Batasan Versi Awal (bisa dikembangkan bertahap)

| Fitur panel | Status di Illustrator |
|---|---|
| Grid, ukuran halaman/label, margin, gap, padding, offset, duplikat | ✅ Penuh |
| Font size, line height, alignment, garis potong | ✅ Penuh |
| **Font family, warna teks, bold/italic/underline global** | ✅ **Penuh (v2 format-fix)** — bold/italic dipetakan ke varian font asli (mis. Arial-Bold); bila varian tidak terinstal, jatuh ke face family yang ada |
| **Format Khusus Baris Nama** (bold/italic/underline/ukuran %/warna) | ✅ **Penuh (v2 format-fix)** — diterapkan per-karakter tepat pada rentang {nama} |
| **Letter spacing** | ✅ Dipetakan ke tracking AI (konversi px→1/1000 em, aproksimasi) |
| **Dropdown Font Family = font terinstal PC** | ✅ **(v2.1)** — di dalam Illustrator, panel membaca `app.textFonts` dan menambahkan optgroup "Font Terinstal (N)" berisi semua family sistem, terurut A-Z. Pilihan tersimpan dipulihkan. Di browser biasa: daftar kurasi 9 font (akses font sistem diblokir keamanan browser — batasan platform, bukan bug) |
| Uppercase/Small-caps nama | ✅ (diterapkan ke teksnya langsung, spt preview) |
| Strikethrough, rotasi teks 90° | ⚠️ Belum — strikethrough tidak tersedia di API teks AI; rotasi butuh penanganan frame khusus |
| Nomor urut label kecil di pojok | ⚠️ Belum |

## Troubleshooting

| Gejala | Solusi |
|---|---|
| Panel tidak muncul di menu Extensions | File .reg belum dijalankan / folder salah lokasi / Illustrator belum di-restart |
| Panel muncul tapi kosong/putih | Cek folder `libs/` ada; klik kanan dalam panel → tidak ada menu? Pastikan copy folder utuh termasuk `CSXS/` |
| Tombol "Buat di Illustrator" tidak muncul | Normal di browser biasa (hanya muncul di dalam Illustrator). Di Illustrator: pastikan `js/cep-bridge.js` dan `host/labelgen.jsx` ikut tercopy |
| Muncul "Gagal: …" saat membuat label | Copy pesannya, lampirkan `host/labelgen.jsx` + `js/cep-bridge.js` ke AI (lihat PANDUAN-PROMPT.md) |

Distribusi ke orang lain tanpa langkah .reg → butuh paket `.zxp`
bertandatangan (ZXPSignCmd, self-signed cukup) — minta bantuan AI bila perlu.
