# PULAU777 Judol Scanner

Ekstensi Google Chrome ini mengimplementasikan algoritma pencocokan string Knuth-Morris-Pratt (KMP) dan Boyer-Moore (BM) untuk melakukan pencarian teks secara efisien di dalam peramban (browser).

## Penjelasan Singkat Algoritma

*   **Knuth-Morris-Pratt (KMP)**
    Algoritma pencocokan string yang melakukan pencarian dari kiri ke kanan. KMP memanfaatkan informasi dari karakter yang sebelumnya sudah dicocokkan untuk menghindari evaluasi ulang pada teks. Algoritma ini menggunakan tabel pemrosesan awal yang disebut *Longest Proper Prefix which is also Suffix* (LPS) untuk menentukan lompatan (pergeseran) pola yang paling optimal ketika terjadi ketidakcocokan.

*   **Boyer-Moore (BM)**
    Algoritma pencocokan string yang melakukan pencocokan karakter dari kanan ke kiri pada pola yang dicari. Algoritma ini sangat cepat karena menggunakan dua heuristik, yaitu *Bad Character Heuristic* dan *Good Suffix Heuristic*. Saat terjadi ketidakcocokan karakter, heuristik ini memungkinkan algoritma untuk melompati sebagian teks yang sudah pasti tidak cocok, sehingga mempercepat proses pencarian secara keseluruhan.

## Requirement Program dan Instalasi

*   **Sistem Operasi**: Windows, macOS, atau Linux.
*   **Peramban (Browser)**: Google Chrome atau browser lain yang berbasis Chromium (seperti Microsoft Edge, Brave, Vivaldi).
*   **Instalasi Tambahan**: Tidak ada. Program ini berjalan secara *native* pada browser tanpa memerlukan instalasi modul tambahan seperti Node.js atau pustaka (*library*) eksternal.

## Langkah-langkah Build dan Cara Load Extension di Chrome

Karena ekstensi ini tidak menggunakan modul yang perlu di-*compile*, Anda tidak perlu melakukan proses *build*. Anda bisa langsung memuat ekstensi ke dalam Chrome dengan cara berikut:
1. Pastikan telah melakukan command berikut di terminal (pastikan dalam folder `tubes3_PULAU777`):
    ```bash
    npm install
    npm install tesseract.js
    npm run build
    ```
2. Pastikan seluruh file source code ekstensi (`manifest.json`, file HTML, CSS, JS) berada di dalam folder `dist/`.

3. Buka peramban Google Chrome.
4. Ketik `chrome://extensions/` pada *address bar* (bilah alamat) dan tekan **Enter**.
5. Aktifkan opsi **Developer mode** (Mode Pengembang) dengan mengklik tombol *toggle* di sudut kanan atas halaman.
6. Tiga tombol baru akan muncul di kiri atas. Klik tombol **Load unpacked** (Muat yang tidak dikemas).
7. Akan muncul jendela dialog pemilihan folder.

8. Pilih Folder `dist/`
9.  Ekstensi berhasil dimuat dan ikon ekstensi akan muncul di bilah alat (toolbar) Chrome Anda.

## Author
### **Anggota 1:**
*   **Nama:** Reynard Anderson Wijaya
*   **NIM:** 13524111

### **Anggota 2:**
*   **Nama:** Ega Luthfi Rais
*   **NIM:** 13524115
  
### **Anggota 3:**
*   **Nama:** Faris Wirakusuma
*   **NIM:** 13524130

## Lampiran: Checklist Fitur

| No | Poin | Ya | Tidak |
|---|---|:---:|:---:|
| 1 | Extension berhasil di-build dan di-load tanpa kesalahan pada chromium browser dan dikembangkan dengan TypeScript | ✓ | |
| 2 | KMP dan Boyer-Moore diimplementasikan from scratch | ✓ | |
| 3 | Regex menghandle format `&lt;kata&gt;&lt;angka&gt;` dan berbagai edge case | ✓ | |
| 4 | Pencarian KMP & BM membaca keyword.txt secara iteratif dan tidak menggunakan built-in search function atau library eksternal | ✓ | |
| 5 | Exact matching dan fuzzy matching berjalan benar | ✓ | |
| 6 | Elemen DOM terdeteksi diberi highlight dan terhapus saat rescanning | ✓ | |
| 7 | Tooltip muncul saat hover dengan informasi keyword, algoritma, kemunculan, dan waktu eksekusi | ✓ | |
| 8 | Popup menampilkan statistik realtime (total keyword, perbandingan, waktu eksekusi, jumlah match) | ✓ | |
| 9 | [Bonus] Membuat Video |  | |
| 10 | [Bonus] Implementasi Algoritma Aho-Corasick dan Rabin Karp | ✓ | |
| 11 | [Bonus] Implementasi Censorship / Blur Teks | ✓ | |
| 12 | [Bonus] Implementasi Optical Character Recognition pada Gambar | ✓ | |