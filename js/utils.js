// js/utils.js

// Ambil instance Swal dari window (karena kita load lewat CDN di index.html)
const Swal = window.Swal;

// 1. Helper Debounce (Untuk Search agar tidak spam)
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 2. Format Rupiah (Rp. 1.000.000)
export function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);
}


export function formatTanggal(dateString){
    //01 September 2025
    if(!dateString) return '-';
    const date = new Date(dateString);
    if(isNaN(date.getTime())) return dateString;
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
    if(!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

export function hitungHariLagi(targetDateStr) {
    const target = new Date(targetDateStr);
    const today = new Date();
    const diffTime = target - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
}

// --- KONFIGURASI FORMATTER ---
const LIST_SINGKATAN = [
    'UPTD', 'SMP', 'SD', 'RSUD', 'RS', 'TK', 'PAUD', 'BLUD', 
    'PUSKESMAS', 'SETDA', 'BKPSDMD', 'DPRD', 'KECAMATAN', 'KELURAHAN'
];

const LIST_KECIL = [
    'dan', 'di', 'ke', 'dari', 'yang', 'pada', 'untuk', 'atau', 'dengan'
];

// --- FUNGSI UTAMA ---
export const formatTitleCase = (text) => {
    if (!text) return '';
    
    // Deteksi spasi di akhir agar tidak mengganggu saat mengetik
    const hasTrailingSpace = text.endsWith(' ');
    
    const words = text.split(' ');
    
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