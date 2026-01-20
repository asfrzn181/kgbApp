import { reactive } from 'vue'; 
import { db, doc, getDoc } from './firebase.js';

export const store = reactive({
    user: null,          // Data Murni dari Firebase Auth
    profile: null,       // Data Gabungan (Auth + Firestore Role)
    isLoading: true,     // Indikator Loading Global

    // Getter: Cek apakah user adalah admin
    get isAdmin() {
        return this.profile && this.profile.role === 'admin';
    },

    // Setter: Atur status loading
    setLoading(status) { 
        this.isLoading = status; 
    },

    // Fungsi Utama: Ambil Role dari Database
    async fetchUserProfile(userAuth) {
        // 1. Simpan Data Auth Dasar
        this.user = userAuth;
        this.profile = null;

        if (!userAuth) return;

        try {
            // 2. Cek ke Collection 'users' di Firestore
            const docRef = doc(db, "users", userAuth.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                // KASUS 1: Data User Ditemukan (Admin/Staff terdaftar)
                // Kita gabungkan data Auth + Data DB agar lengkap
                this.profile = { 
                    id: userAuth.uid,           // Penting untuk Filter Laporan
                    email: userAuth.email,      // Penting untuk Tampilan
                    ...docSnap.data()           // Role, Nama, NIP, dll
                };
            } else {
                // KASUS 2: User Login tapi belum ada di DB 'users'
                // Kita anggap sebagai User Biasa (Default)
                this.profile = { 
                    id: userAuth.uid,
                    email: userAuth.email,
                    role: 'user' 
                }; 
            }
        } catch (e) {
            console.error("Gagal ambil profil:", e);
            // Fallback aman agar aplikasi tidak crash
            this.profile = { 
                id: userAuth.uid, 
                role: 'user' 
            }; 
        }
    }
});