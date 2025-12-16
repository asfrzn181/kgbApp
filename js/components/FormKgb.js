import { ref, watch } from 'https://unpkg.com/vue@3.3.4/dist/vue.esm-browser.prod.js';
// PERBAIKAN: Tambahkan 'limit' di dalam kurung kurawal import di bawah ini
import { db, addDoc, collection, getDocs, query, where, serverTimestamp, limit } from '../firebase.js'; 
import { debounce } from '../utils.js';

export default {
    emits: ['close', 'saved'],
    template: `
    <div class="modal fade show d-block" style="background: rgba(0,0,0,0.5);" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-success text-white">
                    <h5 class="modal-title">Buat Usulan KGB</h5>
                    <button type="button" class="btn-close btn-close-white" @click="$emit('close')"></button>
                </div>
                <div class="modal-body">
                    
                    <div class="alert alert-light border">
                        <label class="fw-bold mb-1">Cari NIP (Auto-search)</label>
                        <input v-model="searchNip" type="text" class="form-control" placeholder="Ketik NIP..." :disabled="isSearching">
                        <div v-if="isSearching" class="text-muted small mt-1">Mencari di database...</div>
                        <div v-if="searchMsg" class="small mt-1" :class="foundData ? 'text-success' : 'text-danger'">{{ searchMsg }}</div>
                    </div>

                    <form @submit.prevent="simpanKgb">
                        <div class="row g-2 mb-3 bg-light p-2 mx-0 rounded">
                            <div class="col-md-6">
                                <label class="small text-muted">Nama</label>
                                <input :value="form.nama_snapshot" type="text" class="form-control fw-bold" readonly>
                            </div>
                            <div class="col-md-6">
                                <label class="small text-muted">Jabatan</label>
                                <input v-model="form.jabatan_snapshot" type="text" class="form-control">
                            </div>
                        </div>

                        <div class="row g-3">
                            <div class="col-md-4">
                                <label>Masa Kerja (Thn)</label>
                                <input v-model="form.mk_tahun" type="number" class="form-control" required>
                            </div>
                            <div class="col-md-4">
                                <label>Gaji Baru</label>
                                <input v-model="form.gaji_baru" type="number" class="form-control" required>
                            </div>
                            <div class="col-md-4">
                                <label>TMT Berlaku</label>
                                <input v-model="form.tmt_berlaku" type="date" class="form-control" required>
                            </div>
                        </div>

                        <div class="d-grid mt-4">
                            <button type="submit" class="btn btn-success" :disabled="isSaving || !foundData">
                                {{ isSaving ? 'Menyimpan...' : 'Simpan Transaksi' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
    `,
    setup(props, { emit }) {
        const searchNip = ref('');
        const isSearching = ref(false);
        const isSaving = ref(false);
        const foundData = ref(false);
        const searchMsg = ref('');
        
        const form = ref({
            nip: '',
            nama_snapshot: '',
            jabatan_snapshot: '',
            mk_tahun: '',
            gaji_baru: '',
            tmt_berlaku: ''
        });

        // ai> debounce_input implementation
        const performSearch = debounce(async (nip) => {
            if (!nip) return;
            isSearching.value = true;
            searchMsg.value = '';
            foundData.value = false;

            try {
                // SEKARANG limit(1) SUDAH BISA DIBACA KARENA SUDAH DI-IMPORT
                const q = query(collection(db, "master_pegawai"), where("nip", "==", nip), limit(1));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const d = snap.docs[0].data();
                    form.value.nip = d.nip;
                    form.value.nama_snapshot = d.nama;
                    form.value.jabatan_snapshot = d.jabatan_terakhir || ''; 
                    
                    foundData.value = true;
                    searchMsg.value = "Data ditemukan!";
                } else {
                    searchMsg.value = "NIP tidak ditemukan di Master.";
                    form.value.nama_snapshot = '';
                }
            } catch (e) {
                console.error(e);
                searchMsg.value = "Error koneksi: " + e.message;
            } finally {
                isSearching.value = false;
            }
        }, 800);

        watch(searchNip, (val) => {
            if(val.length > 3) performSearch(val);
        });

        const simpanKgb = async () => {
            isSaving.value = true;
            try {
                await addDoc(collection(db, "usulan_kgb"), {
                    ...form.value,
                    created_by: auth.currentUser.uid, // FIELD PENTING UNTUK SECURITY
                    created_by_email: auth.currentUser.email,
                    created_at: serverTimestamp()  
                });
                alert("Sukses!");
                emit('saved');
                emit('close');
            } catch (e) {
                alert("Gagal: " + e.message);
            } finally {
                isSaving.value = false;
            }
        };

        return { searchNip, form, isSearching, isSaving, foundData, searchMsg, simpanKgb };
    }
};