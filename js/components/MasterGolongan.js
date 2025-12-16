import { ref, reactive, onMounted, computed } from 'vue';
import { 
    db, collection, getDocs, setDoc, deleteDoc, doc, 
    writeBatch, serverTimestamp, query, orderBy 
} from '../firebase.js';
import { showToast, showConfirm } from '../utils.js';

export default {
    template: `
    <div class="p-4">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
            <div class="mb-3 mb-md-0">
                <h3 class="fw-bold text-primary mb-1">Master Golongan & Pangkat</h3>
                <p class="text-muted small mb-0">Referensi kepangkatan PNS dan PPPK.</p>
            </div>
            
            <div class="d-flex gap-2 flex-wrap">
                <input type="file" ref="fileInput" @change="handleImportExcel" hidden accept=".xlsx, .xls" />
                <button @click="$refs.fileInput.click()" class="btn btn-success shadow-sm" :disabled="isSaving">
                    <span v-if="isImporting" class="spinner-border spinner-border-sm me-1"></span>
                    <i v-else class="bi bi-file-earmark-excel me-1"></i> Import Excel
                </button>

                <button @click="resetDefault" class="btn btn-outline-danger shadow-sm" :disabled="isSaving">
                    <i class="bi bi-database-fill-gear me-1"></i> Reset Standar
                </button>

                <button @click="openModal()" class="btn btn-primary shadow-sm">
                    <i class="bi bi-plus-lg me-1"></i> Tambah
                </button>
            </div>
        </div>

        <ul class="nav nav-pills mb-3">
            <li class="nav-item">
                <a class="nav-link cursor-pointer" :class="{ active: filterTipe === 'PNS' }" @click="filterTipe = 'PNS'">PNS</a>
            </li>
            <li class="nav-item">
                <a class="nav-link cursor-pointer" :class="{ active: filterTipe === 'PPPK' }" @click="filterTipe = 'PPPK'">PPPK</a>
            </li>
        </ul>

        <div class="card shadow-sm border-0">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-4">Kode Golongan</th>
                                <th>Nama Pangkat</th>
                                <th>Kelompok (Ruang)</th>
                                <th class="text-end pe-4">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading"><td colspan="4" class="text-center py-5">Loading...</td></tr>
                            <tr v-else-if="filteredList.length === 0"><td colspan="4" class="text-center py-5">Data kosong. Silakan Import atau Reset Default.</td></tr>
                            
                            <tr v-else v-for="item in filteredList" :key="item.id">
                                <td class="ps-4 fw-bold font-monospace text-primary">{{ item.kode }}</td>
                                <td class="fw-bold">{{ item.pangkat }}</td>
                                <td><span class="badge bg-light text-dark border">Gol. {{ item.group }}</span></td>
                                <td class="text-end pe-4">
                                    <button @click="openModal(item)" class="btn btn-sm btn-light border me-1"><i class="bi bi-pencil"></i></button>
                                    <button @click="hapusData(item)" class="btn btn-sm btn-light border text-danger"><i class="bi bi-trash"></i></button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5);" tabindex="-1" @click.self="closeModal">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">{{ isEdit ? 'Edit' : 'Tambah' }} Golongan</h5>
                        <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form @submit.prevent="simpanData">
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Tipe ASN</label>
                                <select v-model="form.tipe" class="form-select" :disabled="isEdit">
                                    <option value="PNS">PNS</option>
                                    <option value="PPPK">PPPK</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Kelompok (Group)</label>
                                <input v-model="form.group" class="form-control" placeholder="Contoh: III" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-muted">Kode Golongan (ID)</label>
                                <input v-model="form.kode" class="form-control" :disabled="isEdit" placeholder="Contoh: III/a" required>
                            </div>
                            <div class="mb-4">
                                <label class="form-label small fw-bold text-muted">Nama Pangkat</label>
                                <input v-model="form.pangkat" class="form-control" placeholder="Contoh: Penata Muda" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-100" :disabled="isSaving">Simpan</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const listData = ref([]);
        const loading = ref(true);
        const filterTipe = ref('PNS');
        const showModal = ref(false);
        const isEdit = ref(false);
        const isSaving = ref(false);
        const isImporting = ref(false);
        const fileInput = ref(null);

        const form = reactive({ tipe: 'PNS', group: '', kode: '', pangkat: '' });

        // DATA JSON DEFAULT (STANDAR BKN)
        const RAW_DATA = {
          "PNS": {
            "I": { "I/a": "Juru Muda", "I/b": "Juru Muda Tk. I", "I/c": "Juru", "I/d": "Juru Tk. I" },
            "II": { "II/a": "Pengatur Muda", "II/b": "Pengatur Muda Tk. I", "II/c": "Pengatur", "II/d": "Pengatur Tk. I" },
            "III": { "III/a": "Penata Muda", "III/b": "Penata Muda Tk. I", "III/c": "Penata", "III/d": "Penata Tk. I" },
            "IV": { "IV/a": "Pembina", "IV/b": "Pembina Tk. I", "IV/c": "Pembina Utama Muda", "IV/d": "Pembina Utama Madya", "IV/e": "Pembina Utama" }
          },
          "PPPK": {
            "I": { "I": "PPPK Golongan I" }, "II": { "II": "PPPK Golongan II" }, "III": { "III": "PPPK Golongan III" },
            "IV": { "IV": "PPPK Golongan IV" }, "V": { "V": "PPPK Golongan V" }, "VI": { "VI": "PPPK Golongan VI" },
            "VII": { "VII": "PPPK Golongan VII" }, "VIII": { "VIII": "PPPK Golongan VIII" }, "IX": { "IX": "PPPK Golongan IX" },
            "X": { "X": "PPPK Golongan X" }, "XI": { "XI": "PPPK Golongan XI" }, "XII": { "XII": "PPPK Golongan XII" },
            "XIII": { "XIII": "PPPK Golongan XIII" }, "XIV": { "XIV": "PPPK Golongan XIV" }, "XV": { "XV": "PPPK Golongan XV" },
            "XVI": { "XVI": "PPPK Golongan XVI" }, "XVII": { "XVII": "PPPK Golongan XVII" }
          }
        };

        const fetchData = async () => {
            loading.value = true;
            try {
                const q = query(collection(db, "master_golongan"), orderBy("kode"));
                const snap = await getDocs(q);
                listData.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) { console.error(e); } 
            finally { loading.value = false; }
        };

        const filteredList = computed(() => listData.value.filter(item => item.tipe === filterTipe.value));

        // --- 1. FITUR IMPORT EXCEL (CUSTOM DATA) ---
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

                    // HEADER EXCEL: TIPE, KELOMPOK, KODE, PANGKAT
                    const CHUNK = 300;
                    for (let i = 0; i < json.length; i += CHUNK) {
                        const batch = writeBatch(db);
                        json.slice(i, i + CHUNK).forEach(row => {
                            const tipe = row['TIPE'] || row['tipe']; // PNS / PPPK
                            const group = row['KELOMPOK'] || row['kelompok']; // I, II, III
                            const kode = row['KODE'] || row['kode']; // III/a
                            const pangkat = row['PANGKAT'] || row['pangkat']; // Penata Muda

                            if (tipe && kode) {
                                // ID Unik: PNS_IIIA
                                const docId = `${tipe}_${String(kode).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
                                batch.set(doc(db, "master_golongan", docId), {
                                    tipe: String(tipe).toUpperCase(),
                                    group: String(group),
                                    kode: String(kode),
                                    pangkat: String(pangkat),
                                    updated_at: serverTimestamp()
                                }, { merge: true });
                            }
                        });
                        await batch.commit();
                    }
                    showToast(`Import ${json.length} data sukses!`);
                    fetchData();
                } catch (err) {
                    showToast("Gagal: " + err.message, 'error');
                } finally {
                    isImporting.value = false;
                    event.target.value = '';
                }
            };
            reader.readAsArrayBuffer(file);
        };

        // --- 2. RESET DEFAULT (STANDAR BKN) ---
        const resetDefault = async () => {
            if (!await showConfirm('Reset Data?', 'Database Golongan akan diisi ulang dengan standar BKN.')) return;
            isSaving.value = true;
            try {
                const batch = writeBatch(db);
                for (const [tipe, groups] of Object.entries(RAW_DATA)) {
                    for (const [groupName, codes] of Object.entries(groups)) {
                        for (const [kode, pangkatName] of Object.entries(codes)) {
                            const docId = `${tipe}_${kode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
                            batch.set(doc(db, "master_golongan", docId), {
                                tipe: tipe, group: groupName, kode: kode, pangkat: pangkatName,
                                updated_at: serverTimestamp()
                            });
                        }
                    }
                }
                await batch.commit();
                showToast(`Data berhasil di-reset!`);
                fetchData();
            } catch (e) { showToast(e.message, 'error'); } 
            finally { isSaving.value = false; }
        };

        // --- 3. CRUD MANUAL ---
        const simpanData = async () => {
            isSaving.value = true;
            try {
                const docId = `${form.tipe}_${form.kode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
                await setDoc(doc(db, "master_golongan", docId), { ...form, updated_at: serverTimestamp() });
                showToast("Tersimpan!"); closeModal(); fetchData();
            } catch (e) { showToast(e.message, 'error'); } 
            finally { isSaving.value = false; }
        };

        const hapusData = async (item) => {
            if (await showConfirm('Hapus?', `Hapus ${item.kode}?`)) {
                await deleteDoc(doc(db, "master_golongan", item.id));
                fetchData();
            }
        };

        const openModal = (item) => {
            isEdit.value = !!item;
            if (item) Object.assign(form, item);
            else { form.tipe = filterTipe.value; form.group = ''; form.kode = ''; form.pangkat = ''; }
            showModal.value = true;
        };
        const closeModal = () => showModal.value = false;

        onMounted(fetchData);

        return { 
            listData, filteredList, loading, filterTipe,
            showModal, isEdit, isSaving, isImporting, form, fileInput,
            resetDefault, handleImportExcel, 
            simpanData, hapusData, openModal, closeModal 
        };
    }
};