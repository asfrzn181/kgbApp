# Ringkasan Project: MAS PRI (Manajemen Kepegawaian)

**Deskripsi Singkat:**
Aplikasi **"MAS PRI"** adalah sebuah sistem informasi manajemen kepegawaian berbasis web berbentuk SPA (Single Page Application). Fokus utama aplikasi ini adalah untuk otomatisasi dan tata kelola administrasi kepegawaian, khususnya proses **Kenaikan Gaji Berkala (KGB)**, manajemen penomoran Surat Keputusan (SK), pendataan master pegawai, dan pelaporan. 

Aplikasi ini berjalan sebagai sistem _serverless_ yang menggunakan arsitektur frontend Vue.js dan backend Firebase.

---

## Teknologi yang Digunakan

*   **Frontend Framework:** Vue.js 3 (berjalan tanpa bundler modern seperti Vite secara langsung, melainkan via `importmap` dan ES Modules native) dan Vue Router.
*   **UI Library & Styling:** Bootstrap 5, SweetAlert2 (untuk popup/alert), Chart.js (grafik/visualisasi data), Select2 (untuk dropdown interaktif), dan icon Bootstrap (v2.1 custom style).
*   **Backend & Database:** Firebase Authentication (Keamanan & Login) dan Cloud Firestore (Database NoSQL).
*   **Pengolahan Dokumen:** 
    *   **Word (.docx):** `docxtemplater`, `PizZip`, `JSZip`, dan `docx-preview` untuk memproses template SK dan menghasilkan dokumen surat secara otomatis.
    *   **Excel (.xlsx):** `SheetJS (xlsx)` untuk export/import data.
    *   `FileSaver.js` untuk mengunduh dokumen.
*   **PWA (Progressive Web App):** Dilengkapi dengan `sw.js` (Service Worker) untuk caching dan kemampuan akses offline parsial.

---

## Daftar Fitur Aplikasi

Sistem dibagi menjadi beberapa modul utama yang diatur melalui _routing_ aplikasi:

### 1. Autentikasi & Keamanan (`/`)
*   Sistem Login administrator / pengguna menggunakan Firebase Auth.
*   Sistem proteksi _router_ (pengguna yang belum login diarahkan ke halaman Auth).

### 2. Dashboard (`/`)
*   Halaman beranda yang menampilkan ringkasan analitik, statistik jumlah pegawai, progres KGB, dan visualisasi data kepegawaian dengan grafik (Chart.js).

### 3. Modul Transaksi & Operasional
*   **Transaksi KGB (`/transaksi`):** Fitur utama (Core) aplikasi untuk memproses Kenaikan Gaji Berkala. Fitur ini menangani logika perhitungan gaji baru, pembuatan SK, dan integrasi _generate_ dokumen format Word menggunakan template.
*   **Penomoran SK (`/penomoran`):** Manajemen buku kendali nomor surat untuk SK atau dokumen resmi lainnya secara terpusat.
*   **Penomoran Inpassing (`/penomoran-inpassing`):** Manajemen nomor surat khusus untuk SK Inpassing (penyetaraan jabatan/pangkat).
*   **Cek Duplikat (`/duplikat`):** Alat validasi untuk mendeteksi adanya data ganda pada entri pegawai atau transaksi agar integritas database terjaga.

### 4. Modul Pelaporan (`/laporan`)
*   Halaman rekapitulasi untuk melihat history, filter data berdasarkan parameter tertentu (tahun, bulan, unit kerja).
*   Fitur ekspor / unduh laporan data pegawai dan KGB ke format Excel (Spreadsheet).

### 5. Manajemen Data Master (CRUD)
Modul ini digunakan untuk mengelola data referensi (Database Induk) yang dipakai oleh fitur transaksi:
*   **Master Pegawai (`/master/pegawai`):** Pengelolaan lengkap biodata pegawai (NIP, Nama, Pangkat, Jabatan, Unit Kerja, riwayat, dll).
*   **Master Gaji (`/master/gaji`):** Tabel rujukan nominal Gaji Pokok PNS/PPPK berdasarkan regulasi yang berlaku (seperti Peraturan Pemerintah / Perpres) dipetakan ke Masa Kerja Golongan (MKG).
*   **Master Pejabat (`/master/pejabat`):** Data profil dan NIP pejabat penandatangan dokumen/SK KGB.
*   **Master Golongan (`/master/golongan`):** Referensi daftar pangkat dan golongan kepegawaian (misal: III/d - Penata Tingkat I).
*   **Master Jabatan (`/master/jabatan`):** Referensi daftar nama jabatan fungsional, pelaksana, maupun struktural.
*   **Master Template (`/master/template`):** Fitur untuk mengunggah dan mengelola file _template_ Word (.docx). Sistem akan membaca *tag* dalam template dokumen ini untuk merender SK yang berisi data pegawai spesifik saat proses KGB.

---

_File ini digenerate secara otomatis berdasarkan struktur kode sumber di direktori project `kgbApp`._
