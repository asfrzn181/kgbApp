import { ref, computed } from 'vue';
import { 
    db, collection, getDocs, query, where, 
    deleteDoc, updateDoc, doc 
} from '../firebase.js';
import { showToast, showConfirm, formatTanggal } from '../utils.js';
import { TplCekDuplikat } from '../views/CekDuplikatView.js';

export default {
    template: TplCekDuplikat,
    setup() {
        const loading = ref(false);
        const hasScanned = ref(false);
        const duplicateList = ref([]);
        const filterTahun = ref(new Date().getFullYear());

        const yearOptions = computed(() => {
            const curr = new Date().getFullYear();
            return [curr, curr - 1, curr - 2];
        });

        // --- FUNGSI SCAN DUPLIKAT ---
        // --- UPDATE FULL LOGIC SCAN DUPLICATES ---
        const scanDuplicates = async () => {
            loading.value = true;
            hasScanned.value = false;
            duplicateList.value = [];
            
            const mapNomor = {}; 

            try {
                // 1. AMBIL LOG NOMOR
                const qLog = query(collection(db, "nomor_surat"), where("tahun", "==", parseInt(filterTahun.value)));
                const snapLog = await getDocs(qLog);

                snapLog.forEach(d => {
                    const data = d.data();
                    const no = (data.nomor_lengkap || '').trim();
                    if (no && no !== '-') {
                        if (!mapNomor[no]) mapNomor[no] = [];
                        mapNomor[no].push({
                            source: 'LOG',
                            id: d.id,
                            refId: data.usulan_id || d.id,
                            nama: data.nama_pegawai || 'Tanpa Nama',
                            jabatan: data.jenis_jabatan || 'Umum', 
                            tanggal: data.created_at ? formatTanggal(data.created_at.toDate()) : '-'
                        });
                    }
                });

                // 2. AMBIL DATA USULAN KGB
                const start = new Date(`${filterTahun.value}-01-01`);
                const end = new Date(`${filterTahun.value}-12-31`);
                const qUsulan = query(collection(db, "usulan_kgb"), where("created_at", ">=", start), where("created_at", "<=", end));
                const snapUsulan = await getDocs(qUsulan);

                snapUsulan.forEach(d => {
                    const data = d.data();
                    const arrNomor = [];
                    if (data.nomor_naskah) arrNomor.push(data.nomor_naskah);
                    if (data.nomor_inpassing) arrNomor.push(data.nomor_inpassing);

                    arrNomor.forEach(no => {
                        if (no && no.includes(String(filterTahun.value))) {
                            if (!mapNomor[no]) mapNomor[no] = [];
                            mapNomor[no].push({
                                source: 'USULAN',
                                id: d.id,
                                refId: d.id,
                                nama: data.nama || 'Tanpa Nama',
                                jabatan: data.jenis_jabatan || 'Umum', 
                                tanggal: data.created_at ? formatTanggal(data.created_at.toDate()) : '-'
                            });
                        }
                    });
                });

                // 3. LOGIKA BARU: KONSOLIDASI ENTITAS (MENGATASI INKONSISTENSI DATA SK/LOG)
                for (const [no, usageList] of Object.entries(mapNomor)) {
                    
                    // Langkah A: Kelompokkan data berdasarkan ORANG (RefID) dulu
                    // Tujuannya: Jika Irfan punya data 'Fungsional' di Log dan 'Pelaksana' di SK,
                    // kita harus tentukan dia itu SEBENARNYA apa.
                    const entityMap = {};

                    usageList.forEach(u => {
                        if (!entityMap[u.refId]) {
                            entityMap[u.refId] = {
                                id: u.refId,
                                jabatans: new Set()
                            };
                        }
                        // Masukkan semua jabatan yang ditemukan untuk orang ini
                        entityMap[u.refId].jabatans.add((u.jabatan || '').toUpperCase().trim());
                    });

                    // Langkah B: Tentukan 'GROUP BUKU' untuk setiap Orang
                    const bookGroups = {
                        'BUKU_FUNGSIONAL': 0,
                        'BUKU_STRUKTURAL': 0 // Struktural + Pelaksana gabung sini
                    };

                    Object.values(entityMap).forEach(entity => {
                        let finalBook = 'BUKU_STRUKTURAL'; // Default (Pelaksana masuk sini)

                        // LOGIKA PRIORITAS:
                        // Jika di salah satu dokumen dia tertulis FUNGSIONAL, maka dia FUNGSIONAL.
                        if (entity.jabatans.has('FUNGSIONAL')) {
                            finalBook = 'BUKU_FUNGSIONAL';
                        } 
                        // Jika tidak ada Fungsional, tapi ada Struktural, tetap di Struktural
                        else if (entity.jabatans.has('STRUKTURAL')) {
                            finalBook = 'BUKU_STRUKTURAL';
                        }
                        // Sisanya (Pelaksana) tetap di default BUKU_STRUKTURAL

                        bookGroups[finalBook]++;
                    });

                    // Langkah C: Cek Konflik per BUKU
                    // Konflik terjadi jika DALAM SATU BUKU ada lebih dari 1 Orang
                    let isConflict = false;
                    
                    if (bookGroups['BUKU_FUNGSIONAL'] > 1) isConflict = true;
                    if (bookGroups['BUKU_STRUKTURAL'] > 1) isConflict = true;

                    if (isConflict) {
                        duplicateList.value.push({
                            nomor: no,
                            count: Math.max(bookGroups['BUKU_FUNGSIONAL'], bookGroups['BUKU_STRUKTURAL']),
                            usage: usageList
                        });
                    }
                }

                hasScanned.value = true;
                if(duplicateList.value.length === 0) {
                    showToast("Aman! Tidak ada nomor ganda (Validasi Cerdas Aktif).", 'success');
                }

            } catch (e) {
                console.error(e);
                showToast("Gagal scan: " + e.message, 'error');
            } finally {
                loading.value = false;
            }
        };

        // --- FUNGSI RESET / DELETE NOMOR ---
        const resetNomor = async (docInfo) => {
            const pesan = docInfo.source === 'LOG' 
                ? `Hapus Log Nomor milik ${docInfo.nama}?` 
                : `Kosongkan Nomor di SK ${docInfo.nama}?`;

            if (await showConfirm('Reset Nomor?', pesan)) {
                loading.value = true;
                try {
                    if (docInfo.source === 'LOG') {
                        await deleteDoc(doc(db, "nomor_surat", docInfo.id));
                        showToast("Log nomor dihapus.", 'success');
                    } 
                    else {
                        await updateDoc(doc(db, "usulan_kgb", docInfo.id), {
                            nomor_naskah: null,
                            nomor_inpassing: null, 
                            tgl_naskah: null,
                            tgl_inpassing: null
                        });
                        showToast("Nomor di SK dikosongkan.", 'success');
                    }
                    await scanDuplicates();
                } catch (e) {
                    showToast("Gagal reset: " + e.message, 'error');
                    loading.value = false;
                }
            }
        };

        return {
            loading, hasScanned, duplicateList, filterTahun, yearOptions,
            scanDuplicates, resetNomor
        };
    }
};