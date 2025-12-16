import { ref, reactive, onMounted, watch } from 'vue';
import { 
    db, collection, getDocs, setDoc, deleteDoc, doc, 
    query, orderBy, limit, startAfter, writeBatch, serverTimestamp,
    where, getCountFromServer // <--- IMPORT BARU
} from '../firebase.js';
import { showToast, showConfirm, formatRupiah, debounce } from '../utils.js';

export default {
    template: `
    <div class="p-4">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
            <div class="mb-3 mb-md-0">
                <h3 class="fw-bold text-primary mb-1">Master Gaji Pokok</h3>
                
                <div class="d-flex align-items-center mt-2">
                    <span class="badge bg-white text-dark border shadow-sm px-3 py-2 rounded-pill">
                        <i class="bi bi-database-check text-success me-2"></i>
                        Total Server: <strong class="ms-1">{{ totalReal }}</strong> Data
                    </span>
                    <button @click="hitungTotalReal" class="btn btn-sm btn-link text-decoration-none ms-2" title="Refresh Counter">
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
            </div>
            
            <div class="d-flex gap-2 flex-wrap">
                <div class="input-group shadow-sm" style="width: 250px;">
                    <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                    <input v-model="searchQuery" type="text" class="form-control border-start-0 ps-0" placeholder="Cari Golongan...">
                </div>

                <input type="file" ref="fileInput" @change="handleImportExcel" hidden accept=".xlsx, .xls" />
                <button @click="$refs.fileInput.click()" class="btn btn-success shadow-sm" :disabled="isImporting">
                    <span v-if="isImporting" class="spinner-border spinner-border-sm me-1"></span>
                    <span v-else><i class="bi bi-file-earmark-excel me-1"></i> Import</span>
                </button>

                <button @click="openModal()" class="btn btn-primary shadow-sm">
                    <i class="bi bi-plus-lg me-1"></i> Tambah
                </button>
            </div>
        </div>

        <div class="card shadow-sm border-0">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-4">Golongan</th>
                                <th>Masa Kerja (MKG)</th>
                                <th>Gaji Pokok</th>
                                <th class="text-end pe-4">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading">
                                <td colspan="4" class="text-center py-5 text-muted">Loading...</td>
                            </tr>
                            <tr v-else-if="listData.length === 0">
                                <td colspan="4" class="text-center py-5 text-muted">Data tidak ditemukan.</td>
                            </tr>
                            <tr v-else v-for="item in listData" :key="item.id">
                                <td class="ps-4 fw-bold text-primary">{{ item.golongan }}</td>
                                <td><span class="badge bg-light text-dark border">{{ item.mkg }} Tahun</span></td>
                                <td class="fw-bold text-success">{{ formatRupiah(item.gaji) }}</td>
                                <td class="text-end pe-4">
                                    <button @click="openModal(item)" class="btn btn-sm btn-light border me-1"><i class="bi bi-pencil-square"></i></button>
                                    <button @click="hapusData(item)" class="btn btn-sm btn-light border text-danger"><i class="bi bi-trash"></i></button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card-footer bg-white d-flex justify-content-between align-items-center py-3">
                <div class="small text-muted">Halaman {{ currentPage }}</div>
                <div>
                    <button class="btn btn-sm btn-outline-secondary me-1" @click="prevPage" :disabled="currentPage === 1 || loading">Prev</button>
                    <button class="btn btn-sm btn-outline-primary" @click="nextPage" :disabled="isLastPage || loading">Next</button>
                </div>
            </div>
        </div>

        <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5);" tabindex="-1" @click.self="closeModal">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title fw-bold">{{ isEdit ? 'Edit Gaji' : 'Tambah Gaji' }}</h5>
                        <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form @submit.prevent="simpanData">
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Golongan</label>
                                <input v-model="form.golongan" class="form-control" :disabled="isEdit" placeholder="III/a" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Masa Kerja (Tahun)</label>
                                <input v-model.number="form.mkg" type="number" class="form-control" :disabled="isEdit" min="0" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Gaji Pokok</label>
                                <input v-model.number="form.gaji" type="number" class="form-control" required>
                            </div>
                            <div class="d-grid mt-4">
                                <button type="submit" class="btn btn-primary" :disabled="isSaving">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        // State
        const listData = ref([]);
        const totalReal = ref(0); // State Jumlah Data
        const loading = ref(true);
        const showModal = ref(false);
        const isEdit = ref(false);
        const isSaving = ref(false);
        const form = reactive({ golongan: '', mkg: 0, gaji: 0 });
        
        // Import & Search & Pagination State (Sama)
        const isImporting = ref(false);
        const fileInput = ref(null);
        const searchQuery = ref('');
        const itemsPerPage = 15;
        const currentPage = ref(1);
        const isLastPage = ref(false);
        const pageStack = ref([]);

        // --- HITUNG JUMLAH DATA REAL (SERVER SIDE) ---
        const hitungTotalReal = async () => {
            try {
                const coll = collection(db, "master_gaji");
                const snapshot = await getCountFromServer(coll);
                totalReal.value = snapshot.data().count;
                console.log("Total Data di Server:", totalReal.value);
            } catch (e) {
                console.error("Gagal hitung total:", e);
            }
        };

        // --- FETCH DATA (DENGAN REFRESH TOTAL) ---
        const fetchData = async (direction = 'first') => {
            loading.value = true;
            try {
                let q;
                const collRef = collection(db, "master_gaji");

                if (searchQuery.value.trim()) {
                    const term = searchQuery.value.trim();
                    q = query(collRef, 
                        orderBy('golongan'), 
                        where('golongan', '>=', term),
                        where('golongan', '<=', term + '\uf8ff'),
                        limit(itemsPerPage)
                    );
                    if(direction === 'first') { currentPage.value = 1; pageStack.value = []; }
                } else {
                    if (direction === 'first') {
                        q = query(collRef, orderBy("golongan", "asc"), orderBy("mkg", "asc"), limit(itemsPerPage));
                        pageStack.value = []; currentPage.value = 1;
                    } else if (direction === 'next') {
                        const lastVisible = pageStack.value[pageStack.value.length - 1];
                        q = query(collRef, orderBy("golongan", "asc"), orderBy("mkg", "asc"), startAfter(lastVisible), limit(itemsPerPage));
                        currentPage.value++;
                    } else if (direction === 'prev') {
                        pageStack.value.pop();
                        const prevDoc = pageStack.value[pageStack.value.length - 1];
                        if (!prevDoc) q = query(collRef, orderBy("golongan", "asc"), orderBy("mkg", "asc"), limit(itemsPerPage));
                        else q = query(collRef, orderBy("golongan", "asc"), orderBy("mkg", "asc"), startAfter(prevDoc), limit(itemsPerPage));
                        currentPage.value--;
                    }
                }

                const snap = await getDocs(q);
                if (snap.empty) {
                    if (direction === 'next') { isLastPage.value = true; currentPage.value--; }
                    else { listData.value = []; }
                } else {
                    isLastPage.value = snap.docs.length < itemsPerPage;
                    listData.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    if (direction !== 'prev' && !searchQuery.value) {
                        const lastVisible = snap.docs[snap.docs.length - 1];
                        if(direction === 'next' || pageStack.value.length === 0) pageStack.value.push(lastVisible);
                    }
                }
            } catch (e) {
                console.error(e);
                showToast("Tunggu Indexing Selesai...", 'info');
            } finally {
                loading.value = false;
            }
        };

        const nextPage = () => fetchData('next');
        const prevPage = () => fetchData('prev');
        const runSearch = debounce(() => fetchData('first'), 800);
        watch(searchQuery, runSearch);

        // --- UPDATE PADA SAAT IMPORT SUKSES ---
        const handleImportExcel = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            isImporting.value = true;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const XLSX = window.XLSX;
                    const data = new Uint8Array(e.target.result);
                    const wb = XLSX.read(data, { type: 'array' });
                    const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                    
                    // ... (Kode Batching Sama, Dipersingkat) ...
                    // Pastikan logic generateId & batch.set ada disini
                    // Copy paste logic import dari jawaban sebelumnya
                    
                    const CHUNK = 300;
                    for(let i=0; i<json.length; i+=CHUNK){
                        const batch = writeBatch(db);
                        json.slice(i, i+CHUNK).forEach(row => {
                            const gol = row['GOLONGAN'] || row['golongan'];
                            const mk = row['MKG'] || row['mkg'];
                            const gaji = row['GAJI'] || row['gaji'];
                            if(gol && gaji) {
                                const docId = String(gol).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() + '_' + (mk||0);
                                batch.set(doc(db, "master_gaji", docId), {
                                    golongan: String(gol), mkg: Number(mk||0), gaji: Number(gaji),
                                    updated_at: serverTimestamp()
                                }, {merge:true});
                            }
                        });
                        await batch.commit();
                    }

                    showToast(`Import Selesai!`);
                    fetchData('first');
                    hitungTotalReal(); // UPDATE ANGKA TOTAL

                } catch (err) { showToast(err.message, 'error'); } 
                finally { isImporting.value = false; event.target.value = ''; }
            };
            reader.readAsArrayBuffer(file);
        };

        // --- CRUD Manual ---
        const generateId = (gol, mk) => String(gol).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() + '_' + mk;

        const simpanData = async () => {
            isSaving.value = true;
            try {
                const docId = generateId(form.golongan, form.mkg);
                await setDoc(doc(db, "master_gaji", docId), {
                    golongan: form.golongan, mkg: Number(form.mkg), gaji: Number(form.gaji),
                    updated_at: serverTimestamp()
                }, { merge: true });
                showToast("Disimpan!"); closeModal(); 
                fetchData('first');
                hitungTotalReal(); // Update total
            } catch (e) { showToast(e.message, 'error'); } 
            finally { isSaving.value = false; }
        };

        const hapusData = async (item) => {
            if (await showConfirm('Hapus?', `Hapus data?`)) {
                await deleteDoc(doc(db, "master_gaji", item.id));
                showToast("Terhapus"); 
                fetchData('first');
                hitungTotalReal(); // Update total
            }
        };

        // Helpers
        const openModal = (item) => {
            isEdit.value = !!item;
            if (item) Object.assign(form, item);
            else { form.golongan = ''; form.mkg = 0; form.gaji = 0; }
            showModal.value = true;
        };
        const closeModal = () => showModal.value = false;

        onMounted(() => {
            fetchData('first');
            hitungTotalReal(); // Hitung total saat halaman dibuka
        });

        return { 
            listData, totalReal, hitungTotalReal, // Export helper baru
            loading, showModal, isEdit, isSaving, 
            form, searchQuery, isImporting,
            currentPage, isLastPage, nextPage, prevPage,
            simpanData, hapusData, openModal, closeModal, 
            handleImportExcel, formatRupiah 
        };
    }
};