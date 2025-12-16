import { ref, onMounted } from 'vue';
import { db, auth, collection, getDocs, query, where, orderBy } from '../firebase.js';
import { showToast } from '../utils.js';
import { store } from '../store.js';

export default {
    template: `
    <div class="p-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h3 class="fw-bold text-primary mb-1">Laporan Rekapitulasi</h3>
                <p class="text-muted small mb-0">Export data usulan KGB ke Excel berdasarkan periode TMT.</p>
            </div>
        </div>

        <div class="card shadow-sm border-0">
            <div class="card-header bg-white py-3">
                <h6 class="fw-bold mb-0"><i class="bi bi-filter-square me-2"></i>Filter Laporan</h6>
            </div>
            <div class="card-body p-4">
                <form @submit.prevent="downloadExcel">
                    <div class="row g-3 align-items-end">
                        
                        <div class="col-md-3">
                            <label class="form-label fw-bold small">Dari Tanggal (TMT)</label>
                            <input v-model="startDate" type="date" class="form-control" required>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-bold small">Sampai Tanggal (TMT)</label>
                            <input v-model="endDate" type="date" class="form-control" required>
                        </div>

                        <div class="col-md-3" v-if="store.isAdmin">
                            <label class="form-label fw-bold small text-primary">Filter Peninput (Admin)</label>
                            <select v-model="selectedUser" class="form-select border-primary">
                                <option value="ALL">-- Tampilkan Semua Data --</option>
                                <option :value="auth.currentUser?.uid">Inputan Saya Sendiri</option>
                                <option disabled>----------------</option>
                                <option v-for="u in listUsers" :key="u.id" :value="u.id">
                                    {{ u.email }} ({{ u.role || 'User' }})
                                </option>
                            </select>
                        </div>

                        <div class="col-md-3" v-else>
                            <label class="form-label fw-bold small text-muted">Peninput</label>
                            <div class="input-group">
                                <span class="input-group-text bg-light"><i class="bi bi-person-lock"></i></span>
                                <input type="text" class="form-control bg-light" value="Data Saya Saja" readonly>
                            </div>
                        </div>

                        <div class="col-md-3">
                            <button type="submit" class="btn btn-success w-100 shadow-sm" :disabled="loading">
                                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                                <i v-else class="bi bi-file-earmark-excel-fill me-2"></i>
                                Export Excel
                            </button>
                        </div>
                    </div>
                </form>
                
                <div class="alert alert-info mt-4 d-flex align-items-center mb-0">
                    <i class="bi bi-info-circle-fill fs-4 me-3"></i>
                    <div class="small">
                        <strong>Keterangan:</strong><br>
                        <span v-if="store.isAdmin">Sebagai Admin, Anda dapat menarik data seluruh pegawai atau per user.</span>
                        <span v-else>Anda sedang dalam mode <b>User</b>. Anda hanya dapat menarik laporan data yang <b>Anda input sendiri</b>.</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const startDate = ref('');
        const endDate = ref('');
        const loading = ref(false);
        const selectedUser = ref('ALL');
        const listUsers = ref([]);

        // Helper Capitalize (Biar Rapi di Excel)
        const toTitleCase = (str) => {
            if (!str) return '';
            return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        };

        // Fetch Users (Hanya dijalankan jika Admin)
        const fetchUsers = async () => {
            if (store.isAdmin) {
                try {
                    const q = query(collection(db, "users"));
                    const snap = await getDocs(q);
                    listUsers.value = snap.docs
                        .map(d => ({ id: d.id, ...d.data() }))
                        .filter(u => u.id !== auth.currentUser?.uid);
                } catch (e) { console.error(e); }
            }
        };

        const downloadExcel = async () => {
            if(!startDate.value || !endDate.value) return showToast("Pilih rentang tanggal!", 'warning');
            
            const XLSX = window.XLSX;
            if(!XLSX) return showToast("Library Excel belum dimuat", 'error');

            loading.value = true;
            try {
                const collRef = collection(db, "usulan_kgb");
                
                // --- KONSTRUKSI QUERY ---
                let qConstraints = [
                    where("tmt_sekarang", ">=", startDate.value),
                    where("tmt_sekarang", "<=", endDate.value),
                    orderBy("tmt_sekarang", "asc")
                ];

                // LOGIKA PENTING: FILTER OWNER
                if (store.isAdmin) {
                    // Admin bisa pilih ALL atau User Tertentu
                    if (selectedUser.value !== 'ALL') {
                        qConstraints.push(where("created_by", "==", selectedUser.value));
                    }
                } else {
                    // User Biasa WAJIB filter punya sendiri
                    if (auth.currentUser) {
                        qConstraints.push(where("created_by", "==", auth.currentUser.uid));
                    } else {
                        throw new Error("Sesi habis, silakan login ulang.");
                    }
                }

                const q = query(collRef, ...qConstraints);
                const snap = await getDocs(q);
                
                if (snap.empty) {
                    showToast("Tidak ada data ditemukan pada periode ini.", 'info');
                    loading.value = false;
                    return;
                }

                // --- MAPPING DATA EXCEL ---
                const allData = snap.docs.map(d => {
                    const data = d.data();
                    return {
                        NIP: "'" + data.nip, // Paksa string di excel
                        NAMA: data.nama,
                        GOLONGAN: data.golongan,
                        JABATAN: data.jabatan_snapshot,
                        
                        // Gunakan Title Case agar rapi
                        "UNIT KERJA": toTitleCase(data.unit_kerja || '-'),
                        "UNIT KERJA INDUK": toTitleCase(data.perangkat_daerah || '-'),
                        
                        TMT_BARU: data.tmt_sekarang,
                        GAJI_BARU: data.gaji_baru,
                        MK_TAHUN: data.mk_baru_tahun,
                        
                        // Helper untuk filter sheet
                        TIPE: data.tipe_asn || 'PNS' 
                    };
                });

                // --- SPLIT SHEET ---
                const pnsGol3 = allData.filter(d => d.TIPE === 'PNS' && (String(d.GOLONGAN).startsWith('III') || String(d.GOLONGAN).startsWith('3')));
                const pnsGol4 = allData.filter(d => d.TIPE === 'PNS' && (String(d.GOLONGAN).startsWith('IV') || String(d.GOLONGAN).startsWith('4')));
                const pppk = allData.filter(d => d.TIPE === 'PPPK');

                // --- GENERATE FILE ---
                const wb = XLSX.utils.book_new();
                
                const appendSheet = (data, name) => {
                    // Buang kolom TIPE dari hasil cetak
                    const cleanData = data.map(({ TIPE, ...rest }) => rest);
                    
                    const ws = cleanData.length > 0 
                        ? XLSX.utils.json_to_sheet(cleanData) 
                        : XLSX.utils.json_to_sheet([{Info: "Nihil"}]);
                        
                    // Lebar Kolom
                    ws['!cols'] = [
                        {wch:20}, {wch:30}, {wch:10}, {wch:30}, 
                        {wch:25}, {wch:25}, 
                        {wch:15}, {wch:15}, {wch:10}
                    ];
                    XLSX.utils.book_append_sheet(wb, ws, name);
                };

                appendSheet(pnsGol3, "PNS GOL III");
                appendSheet(pnsGol4, "PNS GOL IV");
                appendSheet(pppk, "PPPK");

                const filename = `Rekap_KGB_${startDate.value}_sd_${endDate.value}.xlsx`;
                XLSX.writeFile(wb, filename);
                showToast(`Berhasil download: ${filename}`);

            } catch (e) {
                console.error(e);
                // Deteksi Error Index
                if(e.message.includes('requires an index')) {
                    showToast("Sistem sedang membuat Index Database. Coba lagi dalam 2 menit.", 'warning');
                    // Biasanya link index muncul di console browser (F12)
                } else {
                    showToast("Gagal export: " + e.message, 'error');
                }
            } finally {
                loading.value = false;
            }
        };

        onMounted(() => {
            fetchUsers();
        });

        return { 
            startDate, endDate, loading, 
            store, auth, selectedUser, listUsers,
            downloadExcel 
        };
    }
};