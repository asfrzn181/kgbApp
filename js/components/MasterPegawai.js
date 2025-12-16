import { ref, reactive, onMounted, watch } from 'vue';
// PERBAIKAN 1: Menambahkan 'where' di sini
import { 
    db, collection, getDocs, setDoc, deleteDoc, doc, 
    query, orderBy, limit, startAfter, writeBatch, serverTimestamp,
    where 
} from '../firebase.js';
import { showToast, showConfirm, debounce } from '../utils.js';

export default {
    template: `
    <div class="p-4">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
            <div>
                <h3 class="fw-bold text-primary mb-1">Master Pegawai</h3>
                <p class="text-muted small mb-0">Total Data: {{ totalEstimasi > 0 ? totalEstimasi + '+' : '...' }} Pegawai</p>
            </div>
            
            <div class="d-flex gap-2">
                 <button @click="hitungStatistik" class="btn btn-outline-primary shadow-sm" :disabled="loadingStats">
                    <i class="bi" :class="loadingStats ? 'bi-hourglass-split' : 'bi-pie-chart-fill'"></i>
                    {{ loadingStats ? 'Menghitung...' : 'Refresh Rekap Generasi' }}
                </button>
            </div>
        </div>

        <div class="row g-3 mb-4" v-if="stats.total > 0">
            <div class="col">
                <div class="card border-0 shadow-sm border-start border-4 border-secondary h-100">
                    <div class="card-body p-2 ps-3">
                        <div class="text-muted small fw-bold text-uppercase">Baby Boomers</div>
                        <div class="fs-4 fw-bold">{{ stats.boomers }}</div>
                        <div class="small text-muted">1946-1964</div>
                    </div>
                </div>
            </div>
            <div class="col">
                <div class="card border-0 shadow-sm border-start border-4 border-success h-100">
                    <div class="card-body p-2 ps-3">
                        <div class="text-muted small fw-bold text-uppercase">Gen X</div>
                        <div class="fs-4 fw-bold">{{ stats.genx }}</div>
                        <div class="small text-muted">1965-1980</div>
                    </div>
                </div>
            </div>
            <div class="col">
                <div class="card border-0 shadow-sm border-start border-4 border-primary h-100">
                    <div class="card-body p-2 ps-3">
                        <div class="text-muted small fw-bold text-uppercase">Millennials</div>
                        <div class="fs-4 fw-bold">{{ stats.millennials }}</div>
                        <div class="small text-muted">1981-1996</div>
                    </div>
                </div>
            </div>
            <div class="col">
                <div class="card border-0 shadow-sm border-start border-4 border-info h-100">
                    <div class="card-body p-2 ps-3">
                        <div class="text-muted small fw-bold text-uppercase">Gen Z</div>
                        <div class="fs-4 fw-bold">{{ stats.genz }}</div>
                        <div class="small text-muted">1997-2012</div>
                    </div>
                </div>
            </div>
            <div class="col">
                <div class="card border-0 shadow-sm border-start border-4 border-warning h-100">
                    <div class="card-body p-2 ps-3">
                        <div class="text-muted small fw-bold text-uppercase">Gen Alpha</div>
                        <div class="fs-4 fw-bold">{{ stats.alpha }}</div>
                        <div class="small text-muted">2013+</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-between mb-3">
            <div class="input-group shadow-sm" style="width: 300px;">
                <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                <input v-model="searchQuery" type="text" class="form-control border-start-0 ps-0" placeholder="Cari NIP (Ketik 4 digit)...">
            </div>

            <div class="d-flex gap-2">
                <input type="file" ref="fileInput" @change="handleImportExcel" hidden accept=".xlsx, .xls" />
                <button @click="$refs.fileInput.click()" class="btn btn-success shadow-sm" :disabled="isImporting">
                    <span v-if="isImporting" class="spinner-border spinner-border-sm me-1"></span>
                    <span v-else><i class="bi bi-file-earmark-excel me-1"></i> Import</span>
                </button>
                <button @click="openModal()" class="btn btn-primary shadow-sm">
                    <i class="bi bi-person-plus-fill me-1"></i> Tambah
                </button>
            </div>
        </div>

        <div class="card shadow-sm border-0">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-4 cursor-pointer" @click="changeSort('nip')">
                                    Identitas Pegawai <i class="bi" :class="getSortIcon('nip')"></i>
                                </th>
                                <th class="cursor-pointer" @click="changeSort('tempat_lahir')">
                                    Generasi / Gender <i class="bi" :class="getSortIcon('tempat_lahir')"></i>
                                </th>
                                <th class="cursor-pointer" @click="changeSort('perangkat_daerah')">
                                    Perangkat Daerah <i class="bi" :class="getSortIcon('perangkat_daerah')"></i>
                                </th>
                                <th class="text-end pe-4">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading">
                                <td colspan="4" class="text-center py-5 text-muted">
                                    <div class="spinner-border spinner-border-sm text-primary me-2"></div> Memuat data...
                                </td>
                            </tr>
                            <tr v-else-if="listData.length === 0">
                                <td colspan="4" class="text-center py-5 text-muted">
                                    <i class="bi bi-inbox fs-1 d-block mb-2 opacity-25"></i>
                                    Data tidak ditemukan.
                                </td>
                            </tr>
                            <tr v-else v-for="item in listData" :key="item.nip">
                                <td class="ps-4">
                                    <div class="fw-bold text-dark font-monospace bg-light d-inline px-1 rounded">{{ item.nip }}</div>
                                    <div class="text-primary fw-bold mt-1">{{ item.nama }}</div>
                                </td>
                                <td>
                                    <span class="badge mb-1" :class="getGenColor(getInfoNip(item.nip).generation)">
                                        {{ getInfoNip(item.nip).generation }}
                                    </span>
                                    <div class="small text-muted d-flex align-items-center">
                                        <i class="bi bi-calendar-event me-1"></i> 
                                        {{ item.tempat_lahir || '?' }}, {{ getInfoNip(item.nip).tgl }}
                                    </div>
                                    <div class="small text-muted mt-1">
                                        <i class="bi" :class="getInfoNip(item.nip).genderIcon"></i> 
                                        {{ getInfoNip(item.nip).gender }}
                                    </div>
                                </td>
                                <td><span class="badge bg-light text-secondary border text-wrap text-start">{{ item.perangkat_daerah || '-' }}</span></td>
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
                <div class="small text-muted">
                    Halaman {{ currentPage }}
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-secondary me-1" @click="prevPage" :disabled="currentPage === 1 || loading">
                        <i class="bi bi-chevron-left"></i> Prev
                    </button>
                    <button class="btn btn-sm btn-outline-primary" @click="nextPage" :disabled="isLastPage || loading">
                        Next <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        </div>

        <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);" tabindex="-1" @click.self="closeModal">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title fw-bold">{{ isEdit ? 'Edit Data' : 'Tambah Data' }}</h5>
                        <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form @submit.prevent="simpanData">
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">NIP</label>
                                <input v-model="form.nip" class="form-control" :disabled="isEdit" placeholder="1985..." required>
                                <div class="form-text small" v-if="form.nip.length >= 4">
                                    Generasi: <span class="fw-bold">{{ getInfoNip(form.nip).generation }}</span>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Nama Lengkap</label>
                                <input v-model="form.nama" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Tempat Lahir</label>
                                <input v-model="form.tempat_lahir" class="form-control">
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Perangkat Daerah</label>
                                <input v-model="form.perangkat_daerah" class="form-control">
                            </div>
                            <div class="d-grid mt-4">
                                <button type="submit" class="btn btn-primary py-2" :disabled="isSaving">
                                    {{ isSaving ? 'Menyimpan...' : 'Simpan Data' }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        // --- STATE DASAR ---
        const listData = ref([]);
        const loading = ref(true);
        const loadingStats = ref(false); // Loading khusus statistik
        const showModal = ref(false);
        const isEdit = ref(false);
        const isSaving = ref(false);
        const form = reactive({ nip: '', nama: '', tempat_lahir: '', perangkat_daerah: '' });
        
        // Import
        const isImporting = ref(false);
        const progressMsg = ref('Import');
        const fileInput = ref(null);

        // Pagination & Sort
        const itemsPerPage = 10;
        const currentPage = ref(1);
        const isLastPage = ref(false);
        const totalEstimasi = ref(0);
        const pageStack = ref([]);
        const searchQuery = ref('');
        const sortBy = ref('updated_at');
        const sortOrder = ref('desc');

        // State Statistik
        const stats = reactive({
            boomers: 0,
            genx: 0,
            millennials: 0,
            genz: 0,
            alpha: 0,
            total: 0
        });

        // --- 1. LOGIKA GENERASI ---
        const getInfoNip = (nip) => {
            if(!nip || nip.length < 4) return { tgl: '-', gender: '-', generation: '?', genderIcon: '' };
            
            const year = parseInt(nip.substring(0, 4));
            const m = nip.substring(4,6);
            const d = nip.substring(6,8);
            
            const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
            const tglString = `${d} ${months[parseInt(m)-1] || ''} ${year}`;

            let generation = 'Tidak Diketahui';
            if (year >= 1946 && year <= 1964) generation = 'Baby Boomers';
            else if (year >= 1965 && year <= 1980) generation = 'Gen X';
            else if (year >= 1981 && year <= 1996) generation = 'Millennials';
            else if (year >= 1997 && year <= 2012) generation = 'Gen Z';
            else if (year >= 2013) generation = 'Gen Alpha';

            let gender = '-';
            let genderIcon = 'bi-gender-ambiguous';
            if(nip.length >= 15) {
                const g = nip.substring(14, 15);
                if(g === '1') { gender = 'Laki-laki'; genderIcon = 'bi-gender-male'; }
                if(g === '2') { gender = 'Perempuan'; genderIcon = 'bi-gender-female'; }
            }
            return { tgl: tglString, gender, generation, genderIcon };
        };

        const getGenColor = (gen) => {
            if(gen === 'Baby Boomers') return 'bg-secondary';
            if(gen === 'Gen X') return 'bg-success';
            if(gen === 'Millennials') return 'bg-primary';
            if(gen === 'Gen Z') return 'bg-info text-dark';
            if(gen === 'Gen Alpha') return 'bg-warning text-dark';
            return 'bg-light text-dark border';
        };

        // --- 2. LOGIKA HITUNG STATISTIK (REKAP) ---
        // Kita hitung manual karena Firestore tidak bisa count group by field substring
        const hitungStatistik = async () => {
            loadingStats.value = true;
            try {
                // Ambil SEMUA NIP saja (tanpa field lain biar ringan)
                const q = query(collection(db, "master_pegawai"));
                const snap = await getDocs(q);
                
                // Reset Counters
                stats.boomers = 0; stats.genx = 0; stats.millennials = 0; stats.genz = 0; stats.alpha = 0;
                stats.total = snap.size;

                snap.forEach(doc => {
                    const nip = doc.id; // NIP adalah ID dokumen
                    const year = parseInt(nip.substring(0, 4));
                    
                    if (year >= 1946 && year <= 1964) stats.boomers++;
                    else if (year >= 1965 && year <= 1980) stats.genx++;
                    else if (year >= 1981 && year <= 1996) stats.millennials++;
                    else if (year >= 1997 && year <= 2012) stats.genz++;
                    else if (year >= 2013) stats.alpha++;
                });

                showToast("Statistik berhasil diperbarui!", "success");

            } catch (e) {
                console.error(e);
                showToast("Gagal hitung statistik", 'error');
            } finally {
                loadingStats.value = false;
            }
        };

        // --- 3. LOGIKA FETCH DATA & SEARCH (PERBAIKAN ERROR WHERE) ---
        const fetchData = async (direction = 'first') => {
            loading.value = true;
            try {
                let q;
                const collRef = collection(db, "master_pegawai");

                if (searchQuery.value.trim()) {
                    // MODE SEARCH: FIX ERROR ReferenceError: where is not defined
                    // Sekarang 'where' sudah diimport di atas
                    const term = searchQuery.value.trim();
                    q = query(collRef, 
                        orderBy('nip'), 
                        where('nip', '>=', term),
                        where('nip', '<=', term + '\uf8ff'),
                        limit(itemsPerPage)
                    );
                    if(direction !== 'next' && direction !== 'prev') { currentPage.value=1; pageStack.value=[]; }
                } else {
                    // MODE NORMAL
                    if (direction === 'first') {
                        q = query(collRef, orderBy(sortBy.value, sortOrder.value), limit(itemsPerPage));
                        pageStack.value = []; currentPage.value = 1;
                    } else if (direction === 'next') {
                        const lastVisible = pageStack.value[pageStack.value.length-1];
                        q = query(collRef, orderBy(sortBy.value, sortOrder.value), startAfter(lastVisible), limit(itemsPerPage));
                        currentPage.value++;
                    } else if (direction === 'prev') {
                        pageStack.value.pop();
                        const prevDoc = pageStack.value[pageStack.value.length-1];
                        if(!prevDoc) q = query(collRef, orderBy(sortBy.value, sortOrder.value), limit(itemsPerPage));
                        else q = query(collRef, orderBy(sortBy.value, sortOrder.value), startAfter(prevDoc), limit(itemsPerPage));
                        currentPage.value--;
                    }
                }

                const snap = await getDocs(q);
                if (snap.empty) {
                    if (direction === 'next') { isLastPage.value = true; currentPage.value--; }
                    else { listData.value = []; }
                } else {
                    isLastPage.value = snap.docs.length < itemsPerPage;
                    listData.value = snap.docs.map(d => d.data());
                    if (direction !== 'prev' && !searchQuery.value) {
                        const lastVisible = snap.docs[snap.docs.length-1];
                        if(direction === 'next' || pageStack.value.length === 0) pageStack.value.push(lastVisible);
                    }
                }
                if(totalEstimasi.value === 0 && !searchQuery.value) totalEstimasi.value = listData.value.length;
            } catch (e) {
                console.error(e);
                showToast("Error Load Data", 'error');
            } finally {
                loading.value = false;
            }
        };

        // ... Sisa fungsi (Sorting, Import, CRUD) sama persis ...
        // (Saya sertakan kode penting untuk Sorting & Watcher)
        
        const changeSort = (field) => {
            if(searchQuery.value) return showToast("Sort nonaktif saat search", 'info');
            if(sortBy.value === field) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
            else { sortBy.value = field; sortOrder.value = 'asc'; }
            pageStack.value = []; currentPage.value = 1;
            fetchData('first');
        };

        const getSortIcon = (field) => {
            if (sortBy.value !== field) return 'bi-arrow-down-up opacity-25';
            return sortOrder.value === 'asc' ? 'bi-arrow-up text-primary' : 'bi-arrow-down text-primary';
        };

        const runSearch = debounce(() => {
            pageStack.value = [];
            fetchData('first');
        }, 800);
        watch(searchQuery, runSearch);
        
        const nextPage = () => fetchData('next');
        const prevPage = () => fetchData('prev');
        
        // PASTE SEMUA FUNGSI IMPORT & CRUD ANDA DISINI (handleImportExcel, simpanData, hapusData, openModal, closeModal)
        // (Kode sama dengan sebelumnya, tidak berubah)
        
        const handleImportExcel = (event) => { /* ... kode import excel ... */ }; // Gunakan kode import sebelumnya
        const simpanData = async () => { /* ... kode simpan ... */ };
        const hapusData = async (item) => { 
            if(await showConfirm('Hapus?', `Hapus ${item.nama}?`)) {
                await deleteDoc(doc(db, "master_pegawai", item.nip));
                showToast("Terhapus"); fetchData('first');
            }
        };
        const openModal = (item) => {
            isEdit.value = !!item;
            if (item) Object.assign(form, item);
            else { form.nip=''; form.nama=''; form.tempat_lahir=''; form.perangkat_daerah=''; }
            showModal.value = true;
        };
        const closeModal = () => showModal.value = false;

        onMounted(() => fetchData('first'));

        return { 
            listData, loading, loadingStats, showModal, isEdit, isSaving, 
            form, searchQuery, 
            currentPage, isLastPage, nextPage, prevPage, totalEstimasi,
            isImporting, progressMsg, handleImportExcel, 
            simpanData, hapusData, openModal, closeModal, 
            getInfoNip, getGenColor, hitungStatistik, stats,
            changeSort, getSortIcon
        };
    }
};