import { ref, reactive, watch, onMounted, computed, nextTick } from 'vue';
import { 
    db, auth, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc,
    query, orderBy, limit, startAfter, where, serverTimestamp, onAuthStateChanged 
} from '../firebase.js';
import { showToast, showConfirm, debounce, formatRupiah, formatTanggal } from '../utils.js';
import { store } from '../store.js';

// --- KOMPONEN 1: SELECT2 ---
const SearchSelect = {
    props: ['options', 'modelValue', 'placeholder', 'labelKey', 'valueKey', 'disabled'],
    emits: ['update:modelValue', 'change'],
    template: `
        <div class="dropdown w-100" ref="dropdown">
            <button class="form-select text-start d-flex justify-content-between align-items-center" 
                type="button" @click="!disabled && (isOpen = !isOpen)" 
                :class="{'text-muted': !modelValue, 'bg-light': disabled}" :disabled="disabled">
                <span class="text-truncate">{{ selectedLabel || placeholder || 'Pilih...' }}</span>
                <i class="bi bi-chevron-down small"></i>
            </button>
            <div class="dropdown-menu w-100 p-2 shadow" :class="{ show: isOpen }" style="max-height: 300px; overflow-y: auto;">
                <input ref="searchInput" v-model="search" type="text" class="form-control form-control-sm mb-2" placeholder="Ketik...">
                <div v-if="safeOptions.length === 0" class="text-muted small text-center py-2">Tidak ditemukan.</div>
                <a v-for="opt in safeOptions" :key="getKey(opt)" 
                   class="dropdown-item rounded small py-2" 
                   :class="{ active: modelValue === getKey(opt) }"
                   href="#" @click.prevent="selectOpt(opt)">
                   {{ getLabel(opt) }}
                </a>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const isOpen = ref(false);
        const search = ref('');
        const getKey = (opt) => props.valueKey ? opt[props.valueKey] : opt;
        const getLabel = (opt) => props.labelKey ? opt[props.labelKey] : opt;
        const safeOptions = computed(() => {
            const opts = props.options || [];
            if (!search.value) return opts;
            return opts.filter(opt => String(getLabel(opt)).toLowerCase().includes(search.value.toLowerCase()));
        });
        const selectedLabel = computed(() => {
            const opts = props.options || [];
            const found = opts.find(opt => getKey(opt) === props.modelValue);
            return found ? getLabel(found) : null;
        });
        const selectOpt = (opt) => {
            emit('update:modelValue', getKey(opt));
            emit('change', opt);
            isOpen.value = false; search.value = '';
        };
        return { isOpen, search, safeOptions, selectedLabel, selectOpt, getKey, getLabel };
    }
};

// --- KOMPONEN 2: AUTOCOMPLETE JABATAN ---
const AutocompleteJabatan = {
    props: ['modelValue'],
    emits: ['update:modelValue', 'select'],
    template: `
        <div class="position-relative">
            <input type="text" class="form-control" :value="modelValue" @input="handleInput"
                @focus="showSuggestions = true" @blur="delayHide" placeholder="Ketik nama jabatan..." autocomplete="off">
            <ul v-if="showSuggestions && suggestions.length > 0" class="list-group position-absolute w-100 shadow mt-1" style="z-index: 1050; max-height: 200px; overflow-y: auto;">
                <li v-for="item in suggestions" :key="item.id" class="list-group-item list-group-item-action small cursor-pointer py-2" @mousedown="selectItem(item)">
                    <div class="fw-bold text-dark">{{ item.nama_jabatan }}</div>
                    <div class="d-flex justify-content-between small mt-1">
                        <span class="badge bg-light text-secondary border">{{ item.jenis_jabatan || 'Umum' }}</span>
                        <span v-if="item.bup" class="badge bg-warning text-dark border">BUP {{ item.bup }}</span>
                    </div>
                </li>
            </ul>
        </div>
    `,
    setup(props, { emit }) {
        const showSuggestions = ref(false);
        const suggestions = ref([]);
        const fetchSuggestions = debounce(async (keyword) => {
            if (!keyword || keyword.length < 3) { suggestions.value = []; return; }
            try {
                const term = keyword.trim();
                const q = query(collection(db, "master_jabatan"), where("nama_jabatan", ">=", term), where("nama_jabatan", "<=", term + "\uf8ff"), limit(5));
                const snap = await getDocs(q);
                suggestions.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {}
        }, 800);
        const handleInput = (e) => { emit('update:modelValue', e.target.value); fetchSuggestions(e.target.value); showSuggestions.value = true; };
        const selectItem = (item) => { emit('update:modelValue', item.nama_jabatan); emit('select', item); showSuggestions.value = false; };
        const delayHide = () => setTimeout(() => showSuggestions.value = false, 200);
        return { showSuggestions, suggestions, handleInput, selectItem, delayHide };
    }
};

// --- MAIN COMPONENT ---
export default {
    components: { SearchSelect, AutocompleteJabatan },
    template: `
    <div class="p-4">
        <div v-if="!showModal && !showPreviewModal">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div><h3 class="fw-bold text-primary mb-1">Data Usulan KGB</h3><p class="text-muted small mb-0">Riwayat usulan gaji berkala.</p></div>
                <div class="d-flex gap-2">
                    <div class="input-group shadow-sm" style="width: 250px;">
                        <input v-model="tableSearch" type="text" class="form-control border-end-0" placeholder="Cari Nama/NIP...">
                        <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                    </div>
                    <button @click="openModal()" class="btn btn-primary shadow-sm"><i class="bi bi-plus-lg me-2"></i> Buat Baru</button>
                </div>
            </div>
            <div class="card shadow-sm border-0">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th class="ps-4">Pegawai</th>
                                    <th>Jabatan</th>
                                    <th>Gaji Baru</th>
                                    <th>TMT Berlaku</th>
                                    <th class="text-center">Status & Tanggal</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="tableLoading"><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>
                                <tr v-else-if="listData.length === 0"><td colspan="6" class="text-center py-5 text-muted">Belum ada data.</td></tr>
                                <tr v-else v-for="item in listData" :key="item.id">
                                    <td class="ps-4">
                                        <div class="fw-bold text-dark">{{ item.nama_snapshot }}</div>
                                        <div class="small text-muted font-monospace">{{ item.nip }}</div>
                                        <div class="d-none">{{ item.id }}</div>
                                    </td>
                                    <td>
                                        <div class="small fw-bold">{{ item.jabatan_snapshot }}</div>
                                        <span class="badge bg-light text-secondary border">{{ item.golongan }}</span>
                                        <span v-if="item.tipe_asn === 'PPPK'" class="badge bg-warning text-dark border ms-1">PPPK</span>
                                    </td>
                                    <td class="fw-bold text-success">{{ formatRupiah(item.gaji_baru) }}</td>
                                    <td>{{ formatTanggal(item.tmt_sekarang) }}</td>
                                    
                                    <td class="text-center">
                                        <div class="dropdown">
                                            <button class="btn btn-sm dropdown-toggle fw-bold text-white shadow-sm" 
                                                :class="statusColor(item.status)" 
                                                type="button" 
                                                data-bs-toggle="dropdown" 
                                                style="min-width: 110px;">
                                                {{ item.status || 'DRAFT' }}
                                            </button>
                                            <ul class="dropdown-menu shadow">
                                                <li><h6 class="dropdown-header">Ubah Status</h6></li>
                                                <li><a class="dropdown-item" href="#" @click.prevent="updateStatus(item, 'DRAFT')"><i class="bi bi-file-earmark me-2"></i>DRAFT</a></li>
                                                <li><a class="dropdown-item" href="#" @click.prevent="updateStatus(item, 'TEKEN')"><i class="bi bi-pen me-2 text-warning"></i>TEKEN</a></li>
                                                <li><a class="dropdown-item" href="#" @click.prevent="updateStatus(item, 'DISTRIBUSI')"><i class="bi bi-check-circle me-2 text-success"></i>DISTRIBUSI</a></li>
                                            </ul>
                                        </div>
                                        
                                        <div class="mt-1 small fw-bold text-muted" style="font-size: 0.75em;">
                                            <span v-if="item.status === 'TEKEN' && item.tgl_teken_formatted">
                                                {{ item.tgl_teken_formatted }}
                                            </span>
                                            <span v-else-if="item.status === 'DISTRIBUSI' && item.tgl_distribusi_formatted">
                                                {{ item.tgl_distribusi_formatted }}
                                            </span>
                                        </div>
                                    </td>

                                    <td class="text-end pe-4">
                                        <div class="btn-group">
                                            <button @click="previewSK(item)" class="btn btn-sm btn-light border text-primary" title="Preview"><i class="bi bi-eye-fill"></i></button>
                                            <button @click="cetakSK(item)" class="btn btn-sm btn-light border text-dark" title="Download"><i class="bi bi-download"></i></button>
                                            <button @click="openModal(item)" class="btn btn-sm btn-light border text-secondary" title="Edit"><i class="bi bi-pencil-square"></i></button>
                                            <button @click="hapusTransaksi(item)" class="btn btn-sm btn-light border text-danger" title="Hapus"><i class="bi bi-trash"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="card-footer bg-white py-3 d-flex justify-content-between">
                    <button class="btn btn-sm btn-outline-secondary" @click="prevPage" :disabled="currentPage===1">Prev</button>
                    <span class="small text-muted align-self-center">Hal {{ currentPage }}</span>
                    <button class="btn btn-sm btn-outline-primary" @click="nextPage" :disabled="isLastPage">Next</button>
                </div>
            </div>
        </div>

        <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 1050;" tabindex="-1">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title fw-bold">{{ isEditMode ? 'Edit Usulan' : 'Input Usulan Baru' }}</h5>
                        <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                    </div>
                    <div class="modal-body bg-light p-4">
                        <form @submit.prevent="simpanTransaksi">
                            
                            <div class="card shadow-sm border-0 mb-3">
                                <div class="card-header bg-white py-3"><h6 class="fw-bold text-primary mb-0">1. Identitas Pegawai</h6></div>
                                <div class="card-body">
                                    <div class="row g-3">
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold">NIP / NI PPPK</label>
                                            <div class="input-group">
                                                <input v-model="form.nip" type="text" class="form-control" :disabled="isEditMode" placeholder="Ketik NIP..." @input="handleNipInput">
                                                <span v-if="isSearching" class="input-group-text bg-white"><div class="spinner-border spinner-border-sm"></div></span>
                                            </div>
                                            <div v-if="searchMsg" class="form-text small fw-bold text-primary">{{ searchMsg }}</div>
                                        </div>
                                        <div class="col-md-2">
                                            <label class="form-label small fw-bold">Tipe ASN</label>
                                            <select v-model="form.tipe_asn" class="form-select">
                                                <option value="PNS">PNS</option>
                                                <option value="PPPK">PPPK</option>
                                            </select>
                                        </div>
                                        <div class="col-md-6"><label class="form-label small text-muted">Nama Lengkap</label><input v-model="form.nama" class="form-control fw-bold" required></div>
                                        <div class="col-md-3"><label class="form-label small text-muted">Tempat Lahir</label><input v-model="form.tempat_lahir" class="form-control" placeholder="Kota"></div>
                                        <div class="col-md-3">
                                            <label class="form-label small text-muted">Tanggal Lahir</label>
                                            <input v-model="form.tgl_lahir" type="date" class="form-control border-warning" required>
                                            <div class="form-text small fw-bold text-dark" v-if="currentAge > 0">Umur: {{ currentAge }} Thn</div>
                                        </div>
                                        <div class="col-md-6"><label class="form-label small text-muted">Jabatan</label><AutocompleteJabatan v-model="form.jabatan" @select="handleJabatanSelect" /></div>
                                        <div class="col-md-6"><label class="form-label small text-muted">Perangkat Daerah</label><input v-model="form.perangkat_daerah" class="form-control"></div>
                                        <div class="col-md-6"><label class="form-label small text-muted">Unit Kerja (Lokasi)</label><input v-model="form.unit_kerja" class="form-control"></div>
                                        
                                        <div class="col-md-6">
                                            <label class="form-label small text-muted">Jenis Jabatan</label>
                                            <select v-model="form.jenis_jabatan" class="form-select">
                                                <option value="Pelaksana">Pelaksana</option>
                                                <option value="Fungsional">Fungsional</option>
                                                <option value="Struktural">Struktural</option>
                                            </select>
                                        </div>

                                        <div class="col-md-12">
                                            <div class="form-check form-switch bg-light p-2 rounded border">
                                                <input class="form-check-input ms-0 me-2" type="checkbox" v-model="form.is_pensiun_manual" id="manualPensiunCheck">
                                                <label class="form-check-label small fw-bold text-danger" for="manualPensiunCheck">Pegawai ini Pensiun (Manual Override)</label>
                                            </div>
                                            <div class="form-text small text-end" v-if="pensiunMsg" :class="isPensiun ? 'text-danger fw-bold' : 'text-success'">Status: {{ pensiunMsg }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="card shadow-sm border-0 mb-3">
                                <div class="card-header bg-white py-3"><h6 class="fw-bold text-secondary mb-0">2. Dasar SK Lama</h6></div>
                                <div class="card-body">
                                    <div class="row g-3">
                                        <div class="col-md-6"><label class="form-label small fw-bold">Dasar Surat</label><SearchSelect :options="listDasarHukum" v-model="form.dasar_hukum" label-key="judul" value-key="judul" placeholder="Pilih..." /></div>
                                        <div class="col-md-6"><label class="form-label small text-muted">Pejabat TTD</label><input v-model="form.dasar_pejabat" class="form-control"></div>
                                        <div class="col-md-4"><label class="form-label small text-muted">Nomor SK</label><input v-model="form.dasar_nomor" class="form-control"></div>
                                        <div class="col-md-4"><label class="form-label small text-muted">Tanggal SK</label><input v-model="form.dasar_tanggal" type="date" class="form-control"></div>
                                        <div class="col-md-4"><label class="form-label small fw-bold text-primary">TMT Gaji Lama</label><input v-model="form.dasar_tmt" type="date" class="form-control" required></div>
                                        <div class="col-12 bg-light p-3 rounded border">
                                            <div class="row g-2">
                                                <div class="col-md-4"><label class="small text-muted fw-bold">Gol. Lama</label><SearchSelect :options="filteredGolongan" v-model="form.dasar_golongan" label-key="kode" value-key="kode" placeholder="Pilih..." /></div>
                                                <div class="col-md-2"><label class="small text-muted">MK Thn</label><input v-model.number="form.dasar_mk_tahun" type="number" class="form-control form-control-sm"></div>
                                                <div class="col-md-2"><label class="small text-muted">MK Bln</label><input v-model.number="form.dasar_mk_bulan" type="number" class="form-control form-control-sm"></div>
                                                <div class="col-md-4"><label class="small text-muted fw-bold">Gaji Lama</label><div class="input-group input-group-sm"><input :value="formatRupiah(form.dasar_gaji_lama)" class="form-control fw-bold text-secondary" readonly><button type="button" @click="cariGajiLama" class="btn btn-outline-secondary"><i class="bi bi-arrow-clockwise"></i></button></div></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="card shadow-sm border-0 border-start border-4 border-success mb-3">
                                <div class="card-header bg-success bg-opacity-10 py-3"><h6 class="fw-bold text-success mb-0">3. Penetapan Gaji Baru</h6></div>
                                <div class="card-body">
                                    <div class="row g-3">
                                        <div class="col-md-4"><label class="form-label small fw-bold">Golongan Baru</label><SearchSelect :options="filteredGolongan" v-model="form.golongan" label-key="label_full" value-key="kode" placeholder="Pilih..." @change="handleGolonganChange" /></div>
                                        <div class="col-md-2"><label class="form-label small fw-bold">MK Thn</label><input v-model.number="form.mk_baru_tahun" type="number" class="form-control fw-bold" min="0"></div>
                                        <div class="col-md-2"><label class="form-label small fw-bold">MK Bln</label><input v-model.number="form.mk_baru_bulan" type="number" class="form-control" min="0" max="11"></div>
                                        <div class="col-md-4"><label class="form-label small fw-bold text-success">Gaji Pokok Baru</label><div class="input-group"><input :value="formatRupiah(form.gaji_baru)" class="form-control bg-success text-white fw-bold" readonly><button type="button" @click="cariGajiBaru" class="btn btn-outline-success"><i class="bi bi-arrow-clockwise"></i></button></div><div v-if="gajiMsg" class="small text-danger mt-1">{{ gajiMsg }}</div></div>
                                        
                                        <div class="col-12"><hr></div>
                                        
                                        <div v-if="form.tipe_asn === 'PPPK'" class="col-12 bg-warning bg-opacity-10 p-3 rounded border border-warning mb-3">
                                            <h6 class="text-warning small fw-bold mb-3"><i class="bi bi-exclamation-circle-fill me-2"></i>Atribut Khusus PPPK</h6>
                                            <div class="row g-3">
                                                <div class="col-md-6"><label class="form-label small fw-bold">Masa Perjanjian Kerja</label><input v-model="form.masa_perjanjian" class="form-control" placeholder="Contoh: 5 (Lima) Tahun"></div>
                                                <div class="col-md-6"><label class="form-label small fw-bold">Perpanjangan Perjanjian Kerja</label><input v-model="form.perpanjangan_perjanjian" class="form-control" placeholder="Contoh: 01 Januari 2025 s.d 31 Desember 2029"></div>
                                            </div>
                                        </div>

                                        <div class="col-md-3"><label class="form-label small fw-bold">TMT Sekarang</label><input v-model="form.tmt_sekarang" type="date" class="form-control" required></div>
                                        <div class="col-md-3">
                                            <label class="form-label small text-muted">TMT YAD (Selanjutnya)</label>
                                            <input v-model="form.tmt_selanjutnya" type="date" class="form-control bg-white">
                                            <div v-if="isPensiun" class="small text-danger fw-bold mt-1">Info: Pegawai BUP</div>
                                        </div>
                                        <div class="col-md-6"><label class="form-label small fw-bold text-primary">Pejabat Penandatangan SK</label><SearchSelect :options="listPejabat" v-model="form.pejabat_baru_nip" label-key="jabatan" value-key="nip" placeholder="Pilih Pejabat..." /></div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer bg-white">
                        <button type="button" class="btn btn-light border px-4" @click="closeModal">Batal</button>
                        <button type="button" class="btn btn-primary px-4 shadow" @click="simpanTransaksi" :disabled="isSaving"><span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span> Simpan</button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="showPreviewModal" class="modal fade show d-block" 
             style="background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); z-index: 1060;" 
             tabindex="-1"
             @click.self="closePreview">
            <div class="modal-dialog modal-xl modal-dialog-scrollable" style="height: 95vh;">
                <div class="modal-content h-100 border-0">
                    <div class="modal-header bg-dark text-white border-0 py-2">
                        <h6 class="modal-title"><i class="bi bi-eye me-2"></i>Preview Dokumen SK</h6>
                        <div>
                            <button class="btn btn-sm btn-success me-2" @click="downloadFromPreview"><i class="bi bi-download me-1"></i> Download Word</button>
                            <button type="button" class="btn-close btn-close-white" @click="closePreview"></button>
                        </div>
                    </div>
                    <div class="modal-body bg-secondary p-0 d-flex justify-content-center overflow-auto">
                        <div id="docx-preview-container" class="bg-white shadow-lg my-4" style="width: 210mm; min-height: 297mm; padding: 20px;">
                            <div v-if="previewLoading" class="text-center py-5">
                                <div class="spinner-border text-primary" role="status"></div>
                                <div class="mt-2 text-muted">Sedang membuat dokumen...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
    `,
    setup() {
        const listData = ref([]);
        const tableLoading = ref(true);
        const tableSearch = ref('');
        const currentPage = ref(1);
        const isLastPage = ref(false);
        const pageStack = ref([]);
        
        const showModal = ref(false);
        const showPreviewModal = ref(false);
        const previewLoading = ref(false);
        const currentPreviewItem = ref(null);

        const isEditMode = ref(false);
        const isSaving = ref(false);
        const isSearching = ref(false);
        const searchMsg = ref('');
        const gajiMsg = ref('');
        const formId = ref(null);
        
        const listGolongan = ref([]); 
        const listDasarHukum = ref([]);
        const listPejabat = ref([]); 
        const configPejabat = reactive({ setda: null, bkpsdmd: null });
        const currentBup = ref(58);
        const isPensiun = ref(false);
        const pensiunMsg = ref('');
        const currentAge = ref(0);

        const form = reactive({
            nip: '', nama: '', tempat_lahir: '', tgl_lahir: '', tipe_asn: 'PNS',
            perangkat_daerah: '', unit_kerja: '', jabatan: '', pangkat: '',
            jenis_jabatan: 'Pelaksana', is_pensiun_manual: false,
            dasar_hukum: '', dasar_nomor: '', dasar_tanggal: '', dasar_pejabat: '',
            dasar_tmt: '', dasar_golongan: '', dasar_mk_tahun: 0, dasar_mk_bulan: 0, dasar_gaji_lama: 0,
            golongan: '', mk_baru_tahun: 0, mk_baru_bulan: 0, gaji_baru: 0,
            pejabat_baru_nip: '', 
            tmt_sekarang: '', tmt_selanjutnya: '', tahun_pembuatan: new Date().getFullYear(),
            masa_perjanjian: '', perpanjangan_perjanjian: ''
        });

        const filteredGolongan = computed(() => listGolongan.value.filter(g => g.tipe === form.tipe_asn));

        // Helper Map Doc (Termasuk Format Tanggal Status)
        const mapDoc = (d) => {
            const data = d.data();
            data.id = d.id; 
            
            // Format Tanggal Teken & Distribusi (jika ada)
            if (data.tgl_teken && data.tgl_teken.toDate) {
                data.tgl_teken_formatted = formatTanggal(data.tgl_teken.toDate().toISOString().split('T')[0]);
            }
            if (data.tgl_distribusi && data.tgl_distribusi.toDate) {
                data.tgl_distribusi_formatted = formatTanggal(data.tgl_distribusi.toDate().toISOString().split('T')[0]);
            }
            
            return data;
        };

        const fetchTable = async (direction = 'first') => {
            tableLoading.value = true;
            try {
                let q; const collRef = collection(db, "usulan_kgb"); const itemsPerPage = 10;
                const constraints = [];
                if (!store.isAdmin && auth.currentUser) constraints.push(where("created_by", "==", auth.currentUser.uid));

                if (tableSearch.value.trim()) {
                    const qAll = query(collRef, ...constraints, orderBy("created_at", "desc"), limit(50));
                    const snap = await getDocs(qAll);
                    const term = tableSearch.value.toLowerCase();
                    listData.value = snap.docs.map(mapDoc)
                        .filter(d => (d.nama||'').toLowerCase().includes(term) || (d.nip||'').includes(term));
                    isLastPage.value = true;
                } else {
                    if (direction === 'first') { q = query(collRef, ...constraints, orderBy("created_at", "desc"), limit(itemsPerPage)); pageStack.value = []; currentPage.value = 1; }
                    else if (direction === 'next') { const last = pageStack.value[pageStack.value.length - 1]; q = query(collRef, ...constraints, orderBy("created_at", "desc"), startAfter(last), limit(itemsPerPage)); currentPage.value++; }
                    else if (direction === 'prev') { pageStack.value.pop(); const prev = pageStack.value[pageStack.value.length - 1]; q = query(collRef, ...constraints, orderBy("created_at", "desc"), startAfter(prev), limit(itemsPerPage)); currentPage.value--; }
                    const snap = await getDocs(q);
                    listData.value = snap.docs.map(mapDoc);
                    isLastPage.value = snap.docs.length < itemsPerPage;
                    if(direction !== 'prev' && snap.docs.length > 0) pageStack.value.push(snap.docs[snap.docs.length - 1]);
                }
            } catch (e) { console.error(e); } 
            finally { tableLoading.value = false; }
        };
        
        const nextPage = () => fetchTable('next');
        const prevPage = () => fetchTable('prev');
        watch(tableSearch, debounce(() => fetchTable('first'), 800));

        // --- UPDATE STATUS & TIMESTAMP ---
        const statusColor = (status) => {
            if(status === 'TEKEN') return 'btn-warning text-dark';
            if(status === 'DISTRIBUSI') return 'btn-success';
            return 'btn-secondary'; // DRAFT
        };

        const updateStatus = async (item, newStatus) => {
            if(!item.id) return showToast("Error: ID Dokumen tidak ditemukan", "error");
            try {
                // Tentukan Data yang diupdate
                const updateData = { status: newStatus };
                
                // Tambahkan Timestamp
                if (newStatus === 'TEKEN') updateData.tgl_teken = serverTimestamp();
                if (newStatus === 'DISTRIBUSI') updateData.tgl_distribusi = serverTimestamp();

                await updateDoc(doc(db, "usulan_kgb", item.id), updateData);
                showToast(`Status diubah: ${newStatus}`);
                
                // Optimistic UI Update (Update layar tanpa reload)
                const index = listData.value.findIndex(d => d.id === item.id);
                if (index !== -1) {
                    listData.value[index].status = newStatus;
                    // Update tanggal lokal (formatted) agar langsung muncul
                    const today = formatTanggal(new Date().toISOString().split('T')[0]);
                    if (newStatus === 'TEKEN') listData.value[index].tgl_teken_formatted = today;
                    if (newStatus === 'DISTRIBUSI') listData.value[index].tgl_distribusi_formatted = today;
                }
            } catch (e) {
                console.error(e);
                showToast("Gagal ubah status: " + e.message, "error");
            }
        };

        const initRefs = async () => {
            const qGol = query(collection(db, "master_golongan"), orderBy("kode"));
            const snapGol = await getDocs(qGol);
            const setGol = new Set();
            listGolongan.value = [];
            snapGol.forEach(d => {
                const data = d.data();
                if(!setGol.has(data.kode + data.tipe)) {
                    setGol.add(data.kode + data.tipe);
                    listGolongan.value.push({ kode: data.kode, pangkat: data.pangkat, tipe: data.tipe, label_full: `${data.kode} - ${data.pangkat}` });
                }
            });
            const qPj = query(collection(db, "master_pejabat"), orderBy("nama"));
            const snapPj = await getDocs(qPj);
            listPejabat.value = snapPj.docs.map(d => d.data());
            const docVars = await getDoc(doc(db, "config_template", "GLOBAL_VARS"));
            if(docVars.exists()) {
                const data = docVars.data();
                if(data.dasar_hukum) listDasarHukum.value = data.dasar_hukum;
                if(data.kop_setda) configPejabat.setda = data.kop_setda.pejabat_nip;
                if(data.kop_bkpsdmd) configPejabat.bkpsdmd = data.kop_bkpsdmd.pejabat_nip;
            }
        };

        const getGaji = async (gol, mk) => { if(!gol) return 0; try{const id=`${gol.replace(/[^a-zA-Z0-9]/g,'').toUpperCase()}_${mk||0}`;const s=await getDoc(doc(db,"master_gaji",id));return s.exists()?s.data().gaji:0;}catch{return 0;} };
        const cariGajiBaru = async () => { form.gaji_baru = await getGaji(form.golongan, form.mk_baru_tahun); if(form.gaji_baru===0) gajiMsg.value='Gaji not found'; else gajiMsg.value=''; };
        const cariGajiLama = async () => { form.dasar_gaji_lama = await getGaji(form.dasar_golongan, form.dasar_mk_tahun); };
        watch(() => [form.golongan, form.mk_baru_tahun], () => debounce(cariGajiBaru, 500)());
        watch(() => [form.dasar_golongan, form.dasar_mk_tahun], () => debounce(cariGajiLama, 500)());

        const extractTglLahir = (nip) => {
            const clean = nip.replace(/\s/g, '');
            if (clean.length < 8) return '';
            const y = clean.substring(0, 4); const m = clean.substring(4, 6); const d = clean.substring(6, 8);
            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return `${y}-${m}-${d}`;
            return '';
        };

        const handleNipInput = debounce(async (e) => {
            const val = e.target.value; const clean = val.replace(/\s/g,'');
            const dateFromNip = extractTglLahir(clean);
            if(clean.length<5) return; isSearching.value=true;
            try {
                const snap = await getDoc(doc(db, "master_pegawai", clean));
                if(snap.exists()){
                    const d=snap.data(); 
                    let finalTgl = d.tgl_lahir; if (!finalTgl || finalTgl === '' || finalTgl === 'Invalid Date') finalTgl = dateFromNip;
                    Object.assign(form, {
                        nama:d.nama, tempat_lahir:d.tempat_lahir||'', tgl_lahir: finalTgl, 
                        perangkat_daerah:d.perangkat_daerah||'', unit_kerja:d.unit_kerja||'', 
                        jabatan:d.jabatan||'', tipe_asn:d.tipe_asn||'PNS',
                        jenis_jabatan: d.jenis_jabatan || 'Pelaksana'
                    });
                    if(form.jabatan){
                        const q=query(collection(db,"master_jabatan"),where("nama_jabatan","==",form.jabatan),limit(1));
                        const s=await getDocs(q); if(!s.empty) currentBup.value=s.docs[0].data().bup||58;
                    }
                    searchMsg.value="Ditemukan";
                } else { searchMsg.value="Baru"; form.nama = ''; form.tgl_lahir = dateFromNip; }
            } catch(e){} finally { isSearching.value=false; }
        }, 800);

        const checkBup = () => {
            if (form.tgl_lahir) {
                const birth = new Date(form.tgl_lahir); const today = new Date();
                let age = today.getFullYear() - birth.getFullYear();
                const m = today.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                currentAge.value = age;
            } else currentAge.value = 0;
            if (!form.tgl_lahir || !form.tmt_sekarang) return;
            
            const bd = new Date(form.tgl_lahir); const tmt = new Date(form.tmt_sekarang); const bup = currentBup.value || 58;
            const pd = new Date(bd); pd.setFullYear(bd.getFullYear() + bup); pd.setDate(1); pd.setMonth(pd.getMonth() + 1);
            const next = new Date(tmt); next.setFullYear(next.getFullYear() + 2);
            form.tmt_selanjutnya = next.toISOString().split('T')[0];

            if (form.is_pensiun_manual) { isPensiun.value = true; pensiunMsg.value = "Manual Pensiun"; } 
            else if (next >= pd) { isPensiun.value = true; pensiunMsg.value = `Masuk BUP (${formatTanggal(pd.toISOString())})`; } 
            else { isPensiun.value = false; pensiunMsg.value = `Batas: ${formatTanggal(pd.toISOString())}`; }
            form.tahun_pembuatan = tmt.getFullYear();
        };
        watch(()=>[form.tmt_sekarang,form.tgl_lahir,currentBup.value,form.is_pensiun_manual], checkBup);

        const handleJabatanSelect = (item) => {
            form.jabatan=item.nama_jabatan; form.jenis_jabatan = item.jenis_jabatan || 'Pelaksana'; currentBup.value=item.bup||58; checkBup();
        };
        const handleGolonganChange = (g) => { 
            if(!g) return; form.pangkat=g.pangkat; 
            form.pejabat_baru_nip = (form.tipe_asn==='PNS' && g.kode.startsWith('IV')) ? configPejabat.setda : configPejabat.bkpsdmd; 
        };

        const openModal = (item=null) => {
            initRefs();
            if(item){ 
                if(!item.id) { showToast("Error: ID Data tidak terbaca", 'error'); return; }
                isEditMode.value=true; formId.value=item.id; Object.assign(form,item); 
                if(!form.tgl_lahir && form.nip) form.tgl_lahir = extractTglLahir(form.nip);
                currentBup.value=58; checkBup(); 
            }
            else { 
                isEditMode.value=false; formId.value=null; 
                Object.keys(form).forEach(k=>form[k]=(typeof form[k]==='number'?0:'')); 
                form.tipe_asn='PNS'; form.mk_baru_tahun=0; currentBup.value=58; form.jenis_jabatan='Pelaksana'; 
            }
            showModal.value=true;
        };
        const closeModal = () => showModal.value=false;

        const simpanTransaksi = async () => {
            if(!form.nip||!form.nama) return showToast("Identitas wajib",'warning'); isSaving.value=true;
            try {
                let pjSnap={}; if(form.pejabat_baru_nip){const p=listPejabat.value.find(x=>x.nip===form.pejabat_baru_nip); if(p) pjSnap={pejabat_baru_nama:p.jabatan, pejabat_baru_pangkat:p.pangkat};}
                const safeForm = { ...form };
                if (safeForm.jenis_jabatan === undefined) safeForm.jenis_jabatan = 'Pelaksana';
                if (safeForm.golongan === undefined) safeForm.golongan = '';
                if (safeForm.masa_perjanjian === undefined) safeForm.masa_perjanjian = '';
                if (safeForm.perpanjangan_perjanjian === undefined) safeForm.perpanjangan_perjanjian = '';
                delete safeForm.eselon; 

                const payload = { 
                    ...safeForm, 
                    ...pjSnap, 
                    nama_snapshot: form.nama, 
                    jabatan_snapshot: form.jabatan, 
                    creator_email: auth.currentUser.email, 
                    updated_at: serverTimestamp() 
                };
                
                if(isEditMode.value) {
                    if(!formId.value) { showToast("ID hilang, refresh halaman.", 'error'); return; }
                    if (!payload.creator_email) payload.creator_email = auth.currentUser.email;
                    await updateDoc(doc(db,"usulan_kgb",formId.value), payload);
                } else { 
                    payload.created_at=serverTimestamp(); 
                    payload.created_by=auth.currentUser.uid; 
                    payload.creator_email = auth.currentUser.email;
                    payload.status='DRAFT'; 
                    await addDoc(collection(db,"usulan_kgb"), payload); 
                }
                
                await setDoc(doc(db,"master_pegawai",form.nip), {
                    nip:form.nip, nama:form.nama, tempat_lahir:form.tempat_lahir, tgl_lahir:form.tgl_lahir,
                    perangkat_daerah:form.perangkat_daerah, unit_kerja:form.unit_kerja, jabatan:form.jabatan,
                    tipe_asn:form.tipe_asn, jenis_jabatan: safeForm.jenis_jabatan, updated_at:serverTimestamp()
                }, {merge:true});
                
                if(form.jabatan) {
                    const jId = form.jabatan.replace(/[^a-zA-Z0-9]/g,'_').toUpperCase();
                    await setDoc(doc(db,"master_jabatan",jId), {kode_jabatan:jId, nama_jabatan:form.jabatan, bup:currentBup.value, updated_at:serverTimestamp()}, {merge:true});
                }
                showToast("Tersimpan!"); closeModal(); fetchTable();
            } catch(e){ console.error(e); showToast(e.message,'error');} finally{isSaving.value=false;}
        };

        const hapusTransaksi = async(item)=>{ 
            if(!item || !item.id) return showToast("ID Data tidak valid! Refresh halaman.", 'error');
            if(await showConfirm("Hapus?","Data hilang.")) { await deleteDoc(doc(db,"usulan_kgb",item.id)); fetchTable(); } 
        };

        const generateDocBlob = async (item) => {
            if (!window.PizZip || !window.docxtemplater) throw new Error("Library Cetak Error");
            
            const tplId = item.tipe_asn === 'PPPK' ? "PPPK" : "PNS"; 
            const ts = await getDoc(doc(db, "config_template", tplId)); if(!ts.exists()) throw new Error("Template Belum Diupload!");
            const url = ts.data().url || `./templates/${ts.data().nama_file}`;
            const gv = await getDoc(doc(db, "config_template", "GLOBAL_VARS")); const gvd = gv.exists() ? gv.data() : {};
            
            let kopT='', kopA=''; const golKode = item.golongan || "";
            if (item.tipe_asn === 'PNS' && (golKode.startsWith('IV') || golKode.startsWith('4'))) { kopT = gvd.kop_setda?.judul; kopA = gvd.kop_setda?.alamat; } 
            else { kopT = gvd.kop_bkpsdmd?.judul; kopA = gvd.kop_bkpsdmd?.alamat; }

            let pjp = item.pejabat_baru_pangkat || "", pjj = item.pejabat_baru_nama || "BUPATI BANGKA";
            if(item.pejabat_baru_nip) { const ps = await getDoc(doc(db, "master_pejabat", item.pejabat_baru_nip)); if(ps.exists()){ pjp = ps.data().pangkat; pjj = ps.data().jabatan; } }
            
            const mapH = gvd.dasar_hukum || []; const foundH = mapH.find(h => h.judul === item.dasar_hukum); const textHukum = foundH ? foundH.isi : (item.dasar_hukum || "-");
            const toTitle = (s) => s ? s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';

            const res = await fetch(url); const buf = await res.arrayBuffer();
            const zip = new window.PizZip(buf);
            const docRender = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: (p) => p.value.startsWith('$') ? `{${p.value}}` : "" });

            docRender.render({
                NAMA: item.nama || "", Nama: item.nama || "", nama: item.nama || "",
                NIP: item.nip || "", Nip: item.nip || "", nip: item.nip || "",
                PANGKAT: item.pangkat || "", Pangkat: item.pangkat || "",
                JABATAN: item.jabatan || "", Jabatan: item.jabatan || "",
                UNIT_KERJA: toTitle(item.unit_kerja), Unit_Kerja: toTitle(item.unit_kerja),
                UNIT_KERJA_INDUK: toTitle(item.perangkat_daerah),
                TGL_LAHIR: formatTanggal(item.tgl_lahir),
                DASAR_NOMOR: item.dasar_nomor || "-", NOMOR: item.dasar_nomor || "-",
                DASAR_TANGGAL: formatTanggal(item.dasar_tanggal),
                DASAR_PEJABAT: item.dasar_pejabat || "-", PEJABAT_LAMA: item.dasar_pejabat || "-", OLEH_PEJABAT: item.dasar_pejabat || "-",
                DASAR_TMT: formatTanggal(item.dasar_tmt),
                DASAR_GAJI_LAMA: formatRupiah(item.dasar_gaji_lama),
                DASAR_MK_LAMA: `${item.dasar_mk_tahun || 0} Tahun ${item.dasar_mk_bulan || 0} Bulan`,
                DASAR_HUKUM: textHukum, KONSIDERANS: textHukum,
                GOLONGAN: item.golongan || "", DALAM_GOLONGAN: item.golongan || "",
                MK_BARU: `${item.mk_baru_tahun || 0} Tahun ${item.mk_baru_bulan || 0} Bulan`,
                GAJI_BARU: formatRupiah(item.gaji_baru),
                TMT_SEKARANG: formatTanggal(item.tmt_sekarang),
                TMT_SELANJUTNYA: formatTanggal(item.tmt_selanjutnya),
                MASA_PERJANJIAN_KERJA: item.masa_perjanjian || "-", Masa_Perjanjian_Kerja: item.masa_perjanjian || "-",
                PERPANJANGAN_PERJANJIAN_KERJA: item.perpanjangan_perjanjian || "-", Perpanjangan_Perjanjian_Kerja: item.perpanjangan_perjanjian || "-",
                JABATAN_PEJABAT: pjj, PEJABAT_BARU: pjj, PANGKAT_PEJABAT: pjp,
                KOP: kopT, ALAMAT_KOP: kopA,
                NOMOR_NASKAH: "${nomor_naskah}", TANGGAL_NASKAH: "${tanggal_naskah}", SIFAT: "${sifat}",
                JABATAN_PEJABAT_TTD: "${jabatan_pejabat_ttd}", TTD_PENGIRIM: "${ttd_pengirim}",
                NAMA_PENGIRIM: "${nama_pengirim}", NIP_PENGIRIM: "${nip_pengirim}"
            });

            return docRender.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE", compressionOptions: { level: 9 } });
        };

        const previewSK = async (item) => {
            if (!window.docx) return showToast("Library Preview belum dimuat!", 'error');
            showPreviewModal.value = true;
            previewLoading.value = true;
            currentPreviewItem.value = item;
            
            try {
                const blob = await generateDocBlob(item);
                const container = document.getElementById('docx-preview-container');
                container.innerHTML = ''; 
                await window.docx.renderAsync(blob, container); 
            } catch (e) {
                console.error(e);
                showToast("Gagal Preview: " + e.message, 'error');
                showPreviewModal.value = false;
            } finally {
                previewLoading.value = false;
            }
        };

        const closePreview = () => { showPreviewModal.value = false; currentPreviewItem.value = null; };

        const downloadFromPreview = async () => {
            if(currentPreviewItem.value) cetakSK(currentPreviewItem.value);
        };

        const cetakSK = async (item) => {
            try {
                showToast("Menyiapkan...", 'info');
                const blob = await generateDocBlob(item);
                const safeName = (item.nama || 'doc').replace(/[^a-zA-Z0-9]/g,'_');
                window.saveAs(blob, `SK_KGB_${safeName}.docx`);
            } catch(e) { console.error(e); showToast("Gagal: " + e.message, 'error'); }
        };

        onMounted(() => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) fetchTable('first'); else listData.value = [];
            });
        });
        
        return { 
            listData, tableLoading, tableSearch, currentPage, isLastPage, showModal, isEditMode, isSaving, isSearching, searchMsg, gajiMsg,
            form, listGolongan, listDasarHukum, listPejabat, filteredGolongan, currentAge, isPensiun, pensiunMsg,
            nextPage, prevPage, openModal, closeModal, simpanTransaksi, hapusTransaksi, cetakSK, 
            handleNipInput, cariGajiBaru, cariGajiLama, handleGolonganChange, handleJabatanSelect, formatRupiah, formatTanggal,
            showPreviewModal, previewLoading, previewSK, closePreview, downloadFromPreview,
            statusColor, updateStatus
        };
    }
};