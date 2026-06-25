// js/utils.js
import { getDocs, getDoc } from './firebase.js';

// Ambil instance Swal dari window (karena kita load lewat CDN di index.html)
const Swal = window.Swal;

// --- FEATURE CACHING ---
export async function fetchWithCache(cacheKey, queryOrRef, ttlHours = 12) {
    const now = new Date().getTime();
    const ttlMs = ttlHours * 60 * 60 * 1000;

    // 1. Cek Cacha Lokal
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
        try {
            const cachedData = JSON.parse(cachedStr);
            if (now - cachedData.timestamp < ttlMs) {
                // Cache masih valid (Umur < 12 Jam)
                console.log(`[CACHE HIT] Menggunakan cache lokal untuk: ${cacheKey}`);
                return cachedData.data;
            } else {
                console.log(`[CACHE EXPIRED] Mengambil data baru: ${cacheKey}`);
                localStorage.removeItem(cacheKey);
            }
        } catch (e) {
            localStorage.removeItem(cacheKey);
        }
    }

    // 2. Fetch API Firestore jika cache kosong/expired
    console.log(`[CACHE MISS] Menarik dari Firestore: ${cacheKey}`);
    let dataToStore = null;

    if (queryOrRef.type === 'document' || !queryOrRef.hasOwnProperty('type')) {
        // Asumsi GetDoc (Single Document Ref)
        const snap = await getDoc(queryOrRef);
        if (snap.exists()) dataToStore = { id: snap.id, ...snap.data() };
    } else {
        // Asumsi GetDocs (Query/Collection Ref)
        const snap = await getDocs(queryOrRef);
        dataToStore = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // 3. Simpan ke Local Storage (Hanya jika ada dta)
    if (dataToStore !== null) {
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: now,
                data: dataToStore
            }));
        } catch (storageErr) {
            console.warn("[CACHE] Gagal menyimpan ke localStorage (Quota Full?)", storageErr);
        }
    }

    return dataToStore;
}

// 1. Helper Debounce (Untuk Search agar tidak spam)
export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 2. Format Rupiah (Rp. 1.000.000)
export function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);
}


export function formatTanggal(dateString) {
    //01 September 2025
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

// 4. SweetAlert Toast (Notifikasi Pojok Kanan Atas)
export function showToast(message, icon = 'success') {
    // Cek jika Swal belum terload
    if (!Swal) {
        console.warn("SweetAlert belum di-load, fallback ke alert.");
        alert(message);
        return;
    }

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    Toast.fire({
        icon: icon,
        title: message
    });
}

// 5. SweetAlert Confirm (Dialog Konfirmasi Ya/Tidak)
// Fungsi inilah yang dicari oleh MasterPegawai.js
export async function showConfirm(title, text, confirmBtnText = 'Ya, Lanjutkan') {
    if (!Swal) {
        return confirm(`${title}\n${text}`); // Fallback
    }

    const result = await Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33', // Merah (Bahaya)
        cancelButtonColor: '#3085d6', // Biru (Batal)
        confirmButtonText: confirmBtnText,
        cancelButtonText: 'Batal',
        reverseButtons: true // Tombol Batal di kiri
    });

    return result.isConfirmed; // Return true jika user klik "Ya"
}


// Tambahan di js/utils.js
export function formatTmtPendek(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function hitungHariLagi(targetDateStr) {
    const target = new Date(targetDateStr);
    const today = new Date();
    const diffTime = target - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// --- KONFIGURASI FORMATTER ---
const LIST_SINGKATAN = [
    'UPTD', 'SMP', 'SD', 'RSUD', 'RS', 'TK', 'PAUD', 'BLUD', 'SETDA', 'BKPSDMD', 'DPRD',
    'PNS', 'PPPK', 'ASN', 'SDN', 'SMPN', 'SMAN', 'SMKN', "PPKN", "IPA", "IPS", "TIK", "SDM", "SDMD", "TPA", "PPI", "DR"
];

const LIST_KECIL = [
    'dan', 'di', 'ke', 'dari', 'yang', 'pada', 'untuk', 'atau', 'dengan', 'atas', 'oleh'
];

// --- FUNGSI UTAMA ---
export const formatTitleCase = (text) => {
    if (!text) return '';

    // Deteksi spasi di akhir agar user bisa terus mengetik kata berikutnya
    // (maksimal 1 spasi trailing — spasi berlebihan dinormalisasi)
    const hasTrailingSpace = text.endsWith(' ');

    // Normalisasi: hapus spasi di awal, ganti multiple-space menjadi single-space
    const normalized = text.replace(/\s+/g, ' ').trimStart();

    const words = normalized.split(' ');

    const formatted = words.map((word, index) => {
        if (!word) return ''; // Skip spasi ganda

        const upper = word.toUpperCase();
        const lower = word.toLowerCase();

        // 1. Cek Singkatan (UPTD, SD, dll) - Prioritas Utama
        if (LIST_SINGKATAN.includes(upper)) {
            return upper;
        }

        // 2. Cek Kata Sambung (dan, di, dll) - Kecuali kata pertama
        if (index > 0 && LIST_KECIL.includes(lower)) {
            return lower;
        }

        // 3. Default: Capitalize Each Word (Huruf pertama besar, sisa kecil)
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');

    return hasTrailingSpace ? formatted + ' ' : formatted;
};

// --- FUNGSI TERBILANG (Angka ke Kata) ---
export function terbilang(angka) {
    if (angka === null || angka === undefined || angka === '') return '';
    const strAngka = String(angka).replace(',', '.').trim();

    const parts = strAngka.split('.');
    const intPart = Math.abs(parseInt(parts[0], 10));
    const decPart = parts.length > 1 ? parts[1] : '';

    const huruf = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

    function sebut(n) {
        if (n < 12) return huruf[n];
        if (n < 20) return sebut(n - 10) + " belas";
        if (n < 100) return sebut(Math.floor(n / 10)) + " puluh " + sebut(n % 10);
        if (n < 200) return "seratus " + sebut(n - 100);
        if (n < 1000) return sebut(Math.floor(n / 100)) + " ratus " + sebut(n % 100);
        if (n < 2000) return "seribu " + sebut(n - 1000);
        if (n < 1000000) return sebut(Math.floor(n / 1000)) + " ribu " + sebut(n % 1000);
        if (n < 1000000000) return sebut(Math.floor(n / 1000000)) + " juta " + sebut(n % 1000000);
        return "";
    }

    if (isNaN(intPart)) return strAngka;

    let hasil = '';
    if (intPart === 0) {
        hasil = 'nol';
    } else {
        hasil = sebut(intPart).trim();
    }

    hasil = hasil.replace(/\s+/g, ' ');

    if (decPart) {
        let decText = " koma";
        for (let i = 0; i < decPart.length; i++) {
            const digit = parseInt(decPart[i], 10);
            if (digit === 0) decText += " nol";
            else decText += " " + huruf[digit];
        }
        hasil += decText;
    }

    if (strAngka.startsWith('-')) hasil = "minus " + hasil;

    return hasil.trim();
}