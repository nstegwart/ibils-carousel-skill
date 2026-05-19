# Ibils Carousel Skill — Panduan Pakai LOKAL (Windows & Mac)

Skill ini bikin **carousel Instagram IBILS** (konten keuangan, Bahasa
Indonesia): tiap slide digenerate penuh sebagai gambar oleh codex.

Panduan ini buat pakai di **komputer sendiri** — bikin dan **regenerate**
carousel tanpa server, **tanpa Google Cloud Storage sama sekali**.

> Mau jalanin produksi massal nonstop di server? Lihat
> **[GUIDE-SETUP-SERVER.md](GUIDE-SETUP-SERVER.md)**.

---

## 1. Apa yang dihasilkan

- **1 carousel = 1 konten utuh** = cover + 5–7 slide isi + closing (7–9 slide),
  semua PNG 1080×1350, siap posting.
- Hasilnya satu folder: `plan.json` (naskah) + `slides/` (gambar).
- 4 kategori (`mode`): `news`, `education`, `marketing`, `insight`.

---

## 2. Setup lokal (sekali aja)

Butuh 4 hal: **codex CLI**, **akun codex**, **node v18+**, **ImageMagick**.
Langkahnya beda dikit antara Mac dan Windows — ikuti kolom yang sesuai.

### a. codex CLI

```bash
which codex          # Mac/Linux — harus ada
where codex          # Windows (PowerShell / CMD) — harus ada
codex login          # login kalau belum
```

### b. node v18+ dan ImageMagick

| | macOS | Windows |
|---|---|---|
| node | `brew install node` | unduh dari [nodejs.org](https://nodejs.org) |
| ImageMagick | `brew install imagemagick` | `winget install ImageMagick.ImageMagick` |
| cek node | `node --version` | `node --version` |
| cek ImageMagick | `magick -version` | `magick -version` |

### c. Daftarkan akun codex ke pool

Script ambil akun dari folder `accounts` di home codex. Salin login codex-mu:

**macOS / Linux**
```bash
mkdir -p ~/.codex/accounts
cp ~/.codex/auth.json ~/.codex/accounts/local.json
```

**Windows (PowerShell)**
```powershell
mkdir "$env:USERPROFILE\.codex\accounts" -Force
copy "$env:USERPROFILE\.codex\auth.json" "$env:USERPROFILE\.codex\accounts\local.json"
```

Selesai. Ga perlu Google Cloud, ga perlu service-account key, ga perlu apa pun
yang berhubungan sama server.

> **Path skill.** Di contoh-contoh bawah, skill diasumsikan ada di
> `~/.codex/skills/ibils-carousel` (Mac) /
> `%USERPROFILE%\.codex\skills\ibils-carousel` (Windows). Sesuaikan kalau
> kamu taruh di tempat lain.

---

## 3. Bikin SATU carousel di lokal

**macOS / Linux**
```bash
node ~/.codex/skills/ibils-carousel/scripts/run-carousel.js \
  --mode education --topic "bunga majemuk" \
  --out ./carousels/tes1 --no-upload
```

**Windows (PowerShell)**
```powershell
node "$env:USERPROFILE\.codex\skills\ibils-carousel\scripts\run-carousel.js" `
  --mode education --topic "bunga majemuk" `
  --out .\carousels\tes1 --no-upload
```

- `--mode`   : `news` | `education` | `marketing` | `insight`
- `--topic`  : angle-nya (boleh dikosongin — codex pilih sendiri)
- `--out`    : folder hasil
- `--no-upload` : **WAJIB buat lokal** — ga upload ke GCS, folder disimpan

Hasil ada di `./carousels/tes1/` → `plan.json` + `slides/*.png`. Buka foldernya:

| macOS | Windows |
|---|---|
| `open ./carousels/tes1/slides/` | `explorer .\carousels\tes1\slides` |

---

## 4. ⭐ KOREKSI MANUAL — perbaiki carousel di lokal

Alur normalnya begini: kamu **punya satu carousel** (hasil generate lokal, atau
diunduh dari server), kamu **lihat sendiri**, ada slide yang salah → kamu
**benerin di komputermu**. Ga ada sangkut pautnya sama GCS.

Dua jenis kesalahan yang biasa ketemu:

1. **Gambarnya rusak** — anatomi salah (tangan 3, lengan dobel), mascot
   ke-crop, gambar berantakan.
2. **Teksnya salah** — typo, kalimat keliru, angka ga konsisten.

Keduanya dibenerin pakai **`regen.js`** + opsi **`--slide`** biar cuma slide itu
yang digambar ulang (slide lain ga disentuh).

### Langkah 0 — siapkan foldernya

Kalau carousel hasil generate lokal (langkah 3), folder-nya udah ada — lewati ini.

Kalau carousel-nya ada di server/GCS dan kamu mau koreksi di lokal, **unduh
satu kali** (cuma copy turun, abis itu lokal):
```bash
gsutil -m cp -r gs://ibils-carousel-content-v2/<content-id> ./carousels/
```
Sesudah keunduh, semua kerjaan koreksi 100% lokal.

### Langkah 1 — cari slide yang salah

Setiap slide ada nomornya: slide 1 = `01-cover`, slide 2 = `02-...`, dst, dan
closing slide-nya. Lihat `slides/` buat tau nomor slide yang bermasalah.

### Langkah 2 — kalau TEKS-nya salah, edit `plan.json`

Teks tiap slide ada di **`plan.json`**, di field `brief` (di dalamnya ada
bagian `HEADLINE` dan `BODY`). Buka file-nya, cari slide yang salah, perbaiki
tulisannya. Contoh — headline mau diganti:
```jsonc
// sebelum
"brief": "LAYOUT: statement. HEADLINE: \"Rupiah melemah lagi\". BODY: \"...\""
// sesudah
"brief": "LAYOUT: statement. HEADLINE: \"RUPIAH MENGGILA, KITA JADI GILA\". BODY: \"...\""
```
Kalau cuma gambarnya yang jelek (teks udah benar), **lewati langkah ini**.

### Langkah 3 — regenerate SLIDE ITU aja

`--slide` nerima **nomor** (`3`), **jenis** (`cover` / `closing`), atau **nama**
(`03-statement`). Slide lain di carousel **tidak** digambar ulang.

**macOS / Linux**
```bash
node ~/.codex/skills/ibils-carousel/scripts/regen.js \
  ./carousels/<content-id> --slide 3 --no-upload
```

**Windows (PowerShell)**
```powershell
node "$env:USERPROFILE\.codex\skills\ibils-carousel\scripts\regen.js" `
  .\carousels\<content-id> --slide 3 --no-upload
```

`regen.js` gambar ulang slide 3 dari `plan.json` (pakai teks baru kalau kamu
edit), rapikan ukuran + tempel logo, simpan di folder yang sama. **Ga nyentuh
GCS** karena `--no-upload`.

Mau benerin beberapa slide sekaligus: `--slide 3,5,7`.
Mau gambar ulang **seluruh** carousel: jalankan tanpa `--slide`.

Cek hasilnya — buka `slides/`:

| macOS | Windows |
|---|---|
| `open ./carousels/<content-id>/slides/` | `explorer .\carousels\<content-id>\slides` |

---

## 5. Contoh lengkap — slide tangannya 3 + teks salah

Misal slide 3 sebuah carousel: gambar Himel **tangannya ada 3** (anatomi rusak),
dan headline-nya juga keliru — harusnya **"RUPIAH MENGGILA, KITA JADI GILA"**.

Itu dua masalah sekaligus (gambar + teks). Satu perintah regen beresin keduanya:

1. **Buka `plan.json`**, cari slide ke-3, betulkan teks di `brief`:
   ```jsonc
   "brief": "LAYOUT: statement. HEADLINE: \"RUPIAH MENGGILA, KITA JADI GILA\". BODY: \"...\""
   ```
2. **Regenerate slide 3 doang** (lokal, ga ke GCS):
   ```bash
   node ~/.codex/skills/ibils-carousel/scripts/regen.js \
     ./carousels/<content-id> --slide 3 --no-upload
   ```
3. codex gambar ulang slide 3 dari awal — roll baru biasanya anatominya benar
   (2 tangan), dan teks-nya ikut yang baru di `plan.json`.
4. Buka `slides/03-*.png`, pastikan tangan udah 2 dan teks udah betul. Masih
   jelek? Ulangi langkah 2 (tiap regen = roll baru).

Slide lain di carousel itu **tidak tersentuh** — cuma slide 3 yang berubah.

---

## 6. (Opsional) naikkan hasil ke GCS

Kerja lokal **default-nya ga upload**. Kalau memang mau hasil koreksi dinaikkan
ke GCS, hilangkan `--no-upload` dan sediakan key (butuh akses server/GCS):
```bash
GCS_KEY=/path/gcs-key.json GCS_BUCKET=ibils-carousel-content-v2 \
  node ~/.codex/skills/ibils-carousel/scripts/regen.js \
  ./carousels/<content-id> --slide 3
```
Buat kerja lokal murni, abaikan bagian ini.

---

## 7. Daftar script

| Script | Fungsi |
|--------|--------|
| `run-carousel.js` | bikin 1 carousel utuh (`--no-upload` buat lokal) |
| `regen.js` | **regenerate / koreksi** — `--slide` buat 1 slide, `--no-upload` buat lokal |
| `gen-carousel.js` | render slide dari `plan.json` |
| `finalize.js` | rapikan 1080×1350 + tempel logo/HP/badge (`--only` buat 1 slide) |
| `lint-plan.js` | cek kualitas copy |
| `news.js` | ambil berita keuangan (mode news) |
| `burst-daemon.js` | produksi massal — **server**, lihat GUIDE-SETUP-SERVER.md |

## 8. Masalah umum (lokal)

- **"no usable codex account"** → folder `accounts` kosong. Ulangi langkah 2c.
- **Error ImageMagick / `magick` not found** → install ImageMagick (langkah 2b).
- **"You've hit your usage limit"** → akun codex kena rate-limit; tunggu
  beberapa jam atau tambah akun lain di folder `accounts`.
- **Gambar slide masih jelek sesudah regen** → jalankan `regen.js --slide N`
  lagi; tiap regen roll baru.
- **`--slide` "nothing matches"** → cek nomor/nama slide; pesan error-nya
  nyebutin semua nama slide yang valid.
