import { ref, reactive, onMounted, computed, watch } from 'vue';
import { 
    db, collection, getDocs, setDoc, deleteDoc, doc, 
    writeBatch, serverTimestamp, query, orderBy, limit, startAfter, where,
    getCountFromServer
} from '../firebase.js';
import { showToast, showConfirm, debounce } from '../utils.js';

export default {
    template: `
    <div class="p-4">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
            <div class="mb-3 mb-md-0">
                <h3 class="fw-bold text-primary mb-1">Master Jabatan</h3>
                <p class="text-muted small mb-0">Kode (Auto) | Nama | Jenis</p>
                <div class="mt-2">
                    <span class="badge bg-light text-dark border">Total: <strong>{{ totalReal }}</strong> Data</span>
                </div>
            </div>
            
            <div class="d-flex gap-2 flex-wrap">
                <div class="input-group shadow-sm" style="width: 200px;">
                    <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                    <input v-model="searchQuery" type="text" class="form-control border-start-0 ps-0" placeholder="Cari Nama...">
                </div>

                <input type="file" ref="fileInput" @change="handleImportExcel" hidden accept=".xlsx, .xls" />
                <button @click="$refs.fileInput.click()" class="btn btn-success shadow-sm text-nowrap" :disabled="isProcessing">
                    <i class="bi bi-file-earmark-excel me-1"></i> Import Excel
                </button>

                <button @click="openModal()" class="btn btn-primary shadow-sm text-nowrap">
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
                                <th class="ps-4" style="width: 40%;">Nama Jabatan</th>
                                <th style="width: 30%;">Kode (Auto-Generated)</th>
                                <th style="width: 20%;">Jenis Jabatan</th>
                                <th class="text-end pe-4" style="width: 10%;">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading"><td colspan="4" class="text-center py-5">Loading...</td></tr>
                            <tr v-else-if="listData.length === 0"><td colspan="4" class="text-center py-5 text-muted">Data kosong.</td></tr>
                            
                            <tr v-else v-for="item in listData" :key="item.id">
                                <td class="ps-4 fw-bold text-dark">{{ item.nama_jabatan }}</td>
                                <td><span class="font-monospace small text-muted bg-light px-2 py-1 rounded">{{ item.kode_jabatan }}</span></td>
                                <td><span class="badge" :class="getBadgeColor(item.jenis_jabatan)">{{ item.jenis_jabatan }}</span></td>
                                <td class="text-end pe-4">
                                    <button @click="openModal(item)" class="btn btn-sm btn-light border me-1"><i class="bi bi-pencil"></i></button>
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
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title fw-bold">{{ isEdit ? 'Edit Jabatan' : 'Tambah Jabatan' }}</h5>
                        <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form @submit.prevent="simpanData">
                            
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Nama Jabatan</label>
                                <input v-model="form.nama_jabatan" class="form-control" placeholder="Contoh: Guru Ahli Muda" required>
                            </div>

                            <div class="mb-3">
                                <label class="form-label small fw-bold">Jenis Jabatan</label>
                                <select v-model="form.jenis_jabatan" class="form-select" required>
                                    <option value="Pelaksana">Pelaksana (Staf)</option>
                                    <option value="Fungsional">Fungsional</option>
                                    <option value="Struktural">Struktural</option>
                                </select>
                            </div>

                            <div class="mb-4 p-2 bg-light rounded border text-center">
                                <small class="text-muted d-block mb-1">Kode Otomatis (ID)</small>
                                <code class="fw-bold text-primary">{{ generateId(form.nama_jabatan) || '...' }}</code>
                            </div>

                            <div class="d-grid">
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
        const totalReal = ref(0);
        const loading = ref(true);
        const showModal = ref(false);
        const isEdit = ref(false);
        const isSaving = ref(false);
        const isImporting = ref(false);
        const fileInput = ref(null);
        
        // Pagination & Search
        const searchQuery = ref('');
        const itemsPerPage = 10;
        const currentPage = ref(1);
        const isLastPage = ref(false);
        const pageStack = ref([]);

        // FORM (HANYA 2 INPUT, KODE AUTO)
        const form = reactive({ 
            nama_jabatan: '', 
            jenis_jabatan: 'Pelaksana' 
        });

        // --- 1. FETCH DATA (Hanya Ambil 3 Kolom) ---
        const fetchData = async (direction = 'first') => {
            loading.value = true;
            try {
                let q; const collRef = collection(db, "master_jabatan");

                if (searchQuery.value.trim()) {
                    q = query(collRef, orderBy("kode_jabatan"), limit(100));
                    const snap = await getDocs(q);
                    const term = searchQuery.value.toLowerCase();
                    listData.value = snap.docs.map(d => d.data())
                        .filter(d => d.nama_jabatan.toLowerCase().includes(term));
                    isLastPage.value = true;
                } else {
                    if (direction === 'first') { q = query(collRef, orderBy("kode_jabatan"), limit(itemsPerPage)); pageStack.value = []; currentPage.value = 1; }
                    else if (direction === 'next') { const last = pageStack.value[pageStack.value.length - 1]; q = query(collRef, orderBy("kode_jabatan"), startAfter(last), limit(itemsPerPage)); currentPage.value++; }
                    else if (direction === 'prev') { pageStack.value.pop(); const prev = pageStack.value[pageStack.value.length - 1]; if (!prev) q = query(collRef, orderBy("kode_jabatan"), limit(itemsPerPage)); else q = query(collRef, orderBy("kode_jabatan"), startAfter(prev), limit(itemsPerPage)); currentPage.value--; }
                    
                    const snap = await getDocs(q);
                    listData.value = snap.docs.map(doc => {
                        const d = doc.data();
                        // HANYA AMBIL 3 DATA
                        return { 
                            id: doc.id,
                            kode_jabatan: d.kode_jabatan, 
                            nama_jabatan: d.nama_jabatan, 
                            jenis_jabatan: d.jenis_jabatan || 'Pelaksana'
                        };
                    });
                    isLastPage.value = snap.docs.length < itemsPerPage;
                    if(direction !== 'prev' && snap.docs.length > 0) pageStack.value.push(snap.docs[snap.docs.length - 1]);
                }
                
                if(!searchQuery.value) { const snapCount = await getCountFromServer(collRef); totalReal.value = snapCount.data().count; }
            } catch (e) { console.error(e); showToast("Error Load Data", 'error'); } 
            finally { loading.value = false; }
        };

        const nextPage = () => fetchData('next');
        const prevPage = () => fetchData('prev');
        const runSearch = debounce(() => fetchData('first'), 800);
        watch(searchQuery, runSearch);

        // --- 2. LOGIKA ID OTOMATIS ---
        const generateId = (nama) => {
            if (!nama) return '';
            // Hapus karakter aneh, ganti spasi dengan _, Uppercase
            return String(nama).trim().replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
        };

        // --- 3. CRUD MANUAL (STRICT 3 ATTRIBUTES) ---
        const simpanData = async () => {
            isSaving.value = true;
            try {
                // Generate Kode Otomatis
                const id = generateId(form.nama_jabatan);
                
                await setDoc(doc(db, "master_jabatan", id), {
                    kode_jabatan: id,
                    nama_jabatan: form.nama_jabatan,
                    jenis_jabatan: form.jenis_jabatan,
                    updated_at: serverTimestamp()
                }, { merge: true });

                showToast("Tersimpan!"); closeModal(); fetchData('first');
            } catch (e) { showToast(e.message, 'error'); } 
            finally { isSaving.value = false; }
        };

        const hapusData = async (item) => {
            if (await showConfirm('Hapus?', `Hapus ${item.nama_jabatan}?`)) {
                try { await deleteDoc(doc(db, "master_jabatan", item.kode_jabatan)); showToast("Terhapus"); fetchData('first'); } 
                catch (e) { showToast(e.message, 'error'); }
            }
        };

        // --- 4. IMPORT EXCEL (NAMA & JENIS ONLY) ---
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

                    const CHUNK = 400;
                    for (let i = 0; i < json.length; i += CHUNK) {
                        const batch = writeBatch(db);
                        json.slice(i, i + CHUNK).forEach(row => {
                            // Cari kolom Nama & Jenis (Flexible Case)
                            const nama = row['NAMA_JABATAN'] || row['Nama_Jabatan'] || row['NAMA'] || row['Nama'] || row['JABATAN'] || row['jabatan'];
                            let jenis = row['JENIS_JABATAN'] || row['Jenis_Jabatan'] || row['JENIS'] || row['Jenis'] || 'Pelaksana';

                            if (nama) {
                                const id = generateId(nama);
                                
                                batch.set(doc(db, "master_jabatan", id), {
                                    kode_jabatan: id,
                                    nama_jabatan: String(nama).trim(),
                                    jenis_jabatan: String(jenis).trim(),
                                    updated_at: serverTimestamp()
                                }, { merge: true });
                            }
                        });
                        await batch.commit();
                    }
                    showToast(`Import ${json.length} jabatan sukses!`);
                    fetchData('first');
                } catch (err) { showToast("Gagal: " + err.message, 'error'); } 
                finally { isImporting.value = false; event.target.value = ''; }
            };
            reader.readAsArrayBuffer(file);
        };

        const openModal = (item) => {
            isEdit.value = !!item;
            if (item) {
                form.nama_jabatan = item.nama_jabatan;
                form.jenis_jabatan = item.jenis_jabatan;
            }
            else { 
                form.nama_jabatan = ''; 
                form.jenis_jabatan = 'Pelaksana'; 
            }
            showModal.value = true;
        };
        const closeModal = () => showModal.value = false;
        
        const getBadgeColor = (jenis) => {
            const j = (jenis || '').toLowerCase();
            if (j.includes('struktural')) return 'bg-warning text-dark';
            if (j.includes('fungsional')) return 'bg-primary';
            return 'bg-secondary';
        };

        onMounted(() => fetchData('first'));

        return { 
            listData, totalReal, loading, showModal, isEdit, isSaving, isImporting,
            form, searchQuery, fileInput,
            currentPage, isLastPage, nextPage, prevPage,
            simpanData, hapusData, openModal, closeModal, 
            handleImportExcel, generateId, getBadgeColor 
        };
    }
};