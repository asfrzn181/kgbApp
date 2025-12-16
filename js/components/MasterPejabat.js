import { ref, reactive, onMounted, watch } from 'vue';
import { 
    db, collection, getDocs, setDoc, deleteDoc, doc, 
    query, orderBy, limit, startAfter, writeBatch, serverTimestamp,
    where, getCountFromServer 
} from '../firebase.js';
import { showToast, showConfirm, debounce } from '../utils.js';

export default {
    template: `
    <div class="p-4">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
            <div class="mb-3 mb-md-0">
                <h3 class="fw-bold text-primary mb-1">Master Pejabat</h3>
                <p class="text-muted small mb-0">Daftar Pejabat Penandatangan SK (Bupati/Kepala Dinas)</p>
                
                <div class="mt-2">
                    <span class="badge bg-light text-dark border">
                        Total: <strong>{{ totalReal }}</strong> Data
                    </span>
                </div>
            </div>
            
            <div class="d-flex gap-2 flex-wrap">
                <div class="input-group shadow-sm" style="width: 250px;">
                    <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                    <input v-model="searchQuery" type="text" class="form-control border-start-0 ps-0" placeholder="Cari NIP Pejabat...">
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
                                <th class="ps-4">NIP / Nama</th>
                                <th>Jabatan</th>
                                <th>Pangkat</th>
                                <th class="text-end pe-4">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading">
                                <td colspan="4" class="text-center py-5 text-muted">Loading...</td>
                            </tr>
                            <tr v-else-if="listData.length === 0">
                                <td colspan="4" class="text-center py-5 text-muted">Belum ada data pejabat.</td>
                            </tr>
                            <tr v-else v-for="item in listData" :key="item.nip">
                                <td class="ps-4">
                                    <div class="fw-bold text-dark font-monospace">{{ item.nip }}</div>
                                    <div class="text-primary fw-bold">{{ item.nama }}</div>
                                </td>
                                <td>
                                    <div class="fw-bold text-dark">{{ item.jabatan }}</div>
                                </td>
                                <td>
                                    <span class="badge bg-info text-dark bg-opacity-10 border border-info">{{ item.pangkat }}</span>
                                </td>
                                <td class="text-end pe-4">
                                    <button @click="openModal(item)" class="btn btn-sm btn-light border me-1 text-primary"><i class="bi bi-pencil-square"></i></button>
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
                        <h5 class="modal-title fw-bold">{{ isEdit ? 'Edit Pejabat' : 'Tambah Pejabat' }}</h5>
                        <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form @submit.prevent="simpanData">
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">NIP</label>
                                <input v-model="form.nip" class="form-control" :disabled="isEdit" placeholder="NIP Pejabat" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Nama Lengkap</label>
                                <input v-model="form.nama" class="form-control" placeholder="Nama beserta gelar" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Jabatan</label>
                                <input v-model="form.jabatan" class="form-control" placeholder="Contoh: BUPATI BANGKA" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Pangkat / Golongan</label>
                                <input v-model="form.pangkat" class="form-control" placeholder="Contoh: Pembina Utama Madya (IV/d)" required>
                            </div>
                            
                            <div class="d-grid mt-4">
                                <button type="submit" class="btn btn-primary" :disabled="isSaving">Simpan Data</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const listData = ref([]);
        const totalReal = ref(0);
        const loading = ref(true);
        const showModal = ref(false);
        const isEdit = ref(false);
        const isSaving = ref(false);
        
        // Form Data
        const form = reactive({ nip: '', nama: '', jabatan: '', pangkat: '' });

        // Import & Search
        const isImporting = ref(false);
        const fileInput = ref(null);
        const searchQuery = ref('');
        
        // Pagination
        const itemsPerPage = 10;
        const currentPage = ref(1);
        const isLastPage = ref(false);
        const pageStack = ref([]);

        // --- 1. FETCH DATA ---
        const fetchData = async (direction = 'first') => {
            loading.value = true;
            try {
                let q;
                const collRef = collection(db, "master_pejabat");

                if (searchQuery.value.trim()) {
                    const term = searchQuery.value.trim();
                    q = query(collRef, 
                        orderBy('nip'), 
                        where('nip', '>=', term),
                        where('nip', '<=', term + '\uf8ff'),
                        limit(itemsPerPage)
                    );
                    if(direction === 'first') { currentPage.value = 1; pageStack.value = []; }
                } else {
                    // Sort by Updated At Desc
                    if (direction === 'first') {
                        q = query(collRef, orderBy("updated_at", "desc"), limit(itemsPerPage));
                        pageStack.value = []; currentPage.value = 1;
                    } else if (direction === 'next') {
                        const lastVisible = pageStack.value[pageStack.value.length - 1];
                        q = query(collRef, orderBy("updated_at", "desc"), startAfter(lastVisible), limit(itemsPerPage));
                        currentPage.value++;
                    } else if (direction === 'prev') {
                        pageStack.value.pop();
                        const prevDoc = pageStack.value[pageStack.value.length - 1];
                        if (!prevDoc) q = query(collRef, orderBy("updated_at", "desc"), limit(itemsPerPage));
                        else q = query(collRef, orderBy("updated_at", "desc"), startAfter(prevDoc), limit(itemsPerPage));
                        currentPage.value--;
                    }
                }

                const snap = await getDocs(q);
                if (snap.empty) {
                    if (direction === 'next') { isLastPage.value = true; currentPage.value--; }
                    else { listData.value = []; }
                } else {
                    isLastPage.value = snap.docs.length < itemsPerPage;
                    listData.value = snap.docs.map(doc => doc.data());
                    if (direction !== 'prev' && !searchQuery.value) {
                        const lastVisible = snap.docs[snap.docs.length - 1];
                        if(direction === 'next' || pageStack.value.length === 0) pageStack.value.push(lastVisible);
                    }
                }
            } catch (e) {
                console.error(e);
                showToast("Error Load Data", 'error');
            } finally {
                loading.value = false;
            }
        };

        const nextPage = () => fetchData('next');
        const prevPage = () => fetchData('prev');
        const runSearch = debounce(() => fetchData('first'), 800);
        watch(searchQuery, runSearch);

        // --- 2. HITUNG TOTAL ---
        const hitungTotal = async () => {
            try {
                const coll = collection(db, "master_pejabat");
                const snapshot = await getCountFromServer(coll);
                totalReal.value = snapshot.data().count;
            } catch(e) { console.error(e); }
        };

        // --- 3. IMPORT EXCEL (BATCH) ---
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

                    if (json.length === 0) throw new Error("Excel kosong!");

                    // HEADER: NIP, NAMA, JABATAN, PANGKAT
                    const CHUNK = 300;
                    for (let i = 0; i < json.length; i += CHUNK) {
                        const batch = writeBatch(db);
                        json.slice(i, i + CHUNK).forEach(row => {
                            const nip = row['NIP'] || row['nip'];
                            const nama = row['NAMA'] || row['nama'];
                            const jab = row['JABATAN'] || row['jabatan'];
                            const pakt = row['PANGKAT'] || row['pangkat'];

                            if (nip && nama) {
                                // Bersihkan NIP
                                const nipStr = String(nip).replace(/['"\s]/g, '');
                                
                                batch.set(doc(db, "master_pejabat", nipStr), {
                                    nip: nipStr,
                                    nama: String(nama).trim(),
                                    jabatan: String(jab || '').trim(),
                                    pangkat: String(pakt || '').trim(),
                                    updated_at: serverTimestamp()
                                }, { merge: true });
                            }
                        });
                        await batch.commit();
                    }
                    showToast(`Import ${json.length} pejabat sukses!`);
                    fetchData('first');
                    hitungTotal();
                } catch (err) {
                    showToast("Gagal: " + err.message, 'error');
                } finally {
                    isImporting.value = false;
                    event.target.value = '';
                }
            };
            reader.readAsArrayBuffer(file);
        };

        // --- 4. CRUD MANUAL ---
        const simpanData = async () => {
            if (!form.nip || !form.nama) return showToast("NIP & Nama wajib diisi!", 'warning');
            isSaving.value = true;
            try {
                // ID Dokumen = NIP
                await setDoc(doc(db, "master_pejabat", form.nip), {
                    ...form,
                    updated_at: serverTimestamp()
                }, { merge: true });
                
                showToast("Pejabat Tersimpan!");
                closeModal();
                fetchData('first');
                hitungTotal();
            } catch (e) {
                showToast(e.message, 'error');
            } finally {
                isSaving.value = false;
            }
        };

        const hapusData = async (item) => {
            if (await showConfirm('Hapus?', `Hapus pejabat ${item.nama}?`)) {
                try {
                    await deleteDoc(doc(db, "master_pejabat", item.nip));
                    showToast("Terhapus");
                    fetchData('first');
                    hitungTotal();
                } catch (e) {
                    showToast(e.message, 'error');
                }
            }
        };

        // Modal Helpers
        const openModal = (item) => {
            isEdit.value = !!item;
            if (item) Object.assign(form, item);
            else { form.nip=''; form.nama=''; form.jabatan=''; form.pangkat=''; }
            showModal.value = true;
        };
        const closeModal = () => showModal.value = false;

        onMounted(() => {
            fetchData('first');
            hitungTotal();
        });

        return { 
            listData, totalReal, loading, showModal, isEdit, isSaving, 
            form, searchQuery, isImporting,
            currentPage, isLastPage, nextPage, prevPage,
            simpanData, hapusData, openModal, closeModal, handleImportExcel 
        };
    }
};