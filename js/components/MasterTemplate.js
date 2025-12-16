import { ref, reactive, onMounted } from 'vue';
import { 
    db, collection, getDocs, getDoc, setDoc, deleteDoc, doc, 
    query, orderBy, serverTimestamp,
    storage, storageRef, uploadBytes, getDownloadURL, deleteObject 
} from '../firebase.js';
import { showToast, showConfirm } from '../utils.js';

export default {
    template: `
    <div class="p-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h3 class="fw-bold text-primary mb-1">Config Template & Variabel</h3>
                <p class="text-muted small mb-0">Atur file template, dasar hukum, dan pejabat penandatangan.</p>
            </div>
        </div>

        <ul class="nav nav-tabs mb-4 border-bottom-0">
            <li class="nav-item">
                <a class="nav-link" style="cursor: pointer" :class="{ active: activeTab === 'files' }" @click="changeTab('files')">
                    <i class="bi bi-file-earmark-word me-2"></i> File Template
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" style="cursor: pointer" :class="{ active: activeTab === 'kop' }" @click="changeTab('kop')">
                    <i class="bi bi-building-gear me-2"></i> Setting Kop & Pejabat
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" style="cursor: pointer" :class="{ active: activeTab === 'dasar' }" @click="changeTab('dasar')">
                    <i class="bi bi-journal-bookmark me-2"></i> Master Dasar Hukum
                </a>
            </li>
        </ul>

        <div v-if="activeTab === 'files'">
            <div class="d-flex justify-content-end mb-3">
                <button @click="openModal()" class="btn btn-primary shadow-sm">
                    <i class="bi bi-plus-lg me-2"></i> Set Template Baru
                </button>
            </div>

            <div class="row g-4">
                <div v-if="loading" class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>
                <div v-else-if="listData.length === 0" class="col-12 text-center py-5 text-muted">Belum ada konfigurasi template.</div>
                
                <div v-else v-for="item in listData" :key="item.id" class="col-md-6 col-lg-3">
                    <div class="card h-100 border-0 shadow-sm hover-shadow transition-all">
                        <div class="card-body text-center p-4">
                            <div class="bg-success bg-opacity-10 p-3 rounded-circle d-inline-block mb-3">
                                <i class="bi bi-file-earmark-word-fill fs-2 text-success"></i>
                            </div>
                            <h6 class="fw-bold mb-1 text-uppercase">{{ formatJudul(item.kategori) }}</h6>
                            <code class="d-block bg-light p-2 rounded mb-3 text-break fw-bold text-dark mt-2">
                                {{ item.nama_file }}
                            </code>
                            <div class="d-grid gap-2">
                                <a :href="'./templates/' + item.nama_file" target="_blank" class="btn btn-sm btn-outline-primary">
                                    <i class="bi bi-eye"></i> Cek File
                                </a>
                                <button @click="hapusTemplate(item)" class="btn btn-sm btn-outline-danger">
                                    <i class="bi bi-trash"></i> Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="activeTab === 'kop'">
            <div class="card border-0 shadow-sm">
                <div class="card-body p-4">
                    <div class="alert alert-info border-0 d-flex align-items-center mb-4">
                        <i class="bi bi-info-circle-fill me-3 fs-4"></i>
                        <div>
                            <strong>Logika Otomatis:</strong><br>
                            - Golongan IV ke atas menggunakan Kop <b>SETDA</b>.<br>
                            - Golongan I, II, III, dan PPPK menggunakan Kop <b>BKPSDMD</b>.
                        </div>
                    </div>

                    <div v-if="loading" class="text-center py-5"><div class="spinner-border text-primary"></div></div>
                    
                    <form v-else @submit.prevent="simpanVars">
                        <div class="row g-4">
                            <div class="col-md-6">
                                <div class="card h-100 border-warning border-2">
                                    <div class="card-header bg-warning bg-opacity-10 fw-bold text-warning-emphasis">
                                        <i class="bi bi-bank me-2"></i> KOP SETDA (Gol IV)
                                    </div>
                                    <div class="card-body">
                                        <div class="mb-3">
                                            <label class="form-label small fw-bold">Nama Instansi</label>
                                            <input v-model="varsForm.kop_setda.judul" type="text" class="form-control">
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label small fw-bold">Alamat Lengkap</label>
                                            <textarea v-model="varsForm.kop_setda.alamat" class="form-control" rows="3"></textarea>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label small fw-bold text-primary">Pejabat Penandatangan</label>
                                            <select v-model="varsForm.kop_setda.pejabat_nip" class="form-select border-primary">
                                                <option value="" disabled>-- Pilih Pejabat --</option>
                                                <option v-for="p in pejabatList" :key="p.nip" :value="p.nip">
                                                    {{ p.nama }} ({{ p.jabatan }})
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="col-md-6">
                                <div class="card h-100 border-primary border-2">
                                    <div class="card-header bg-primary bg-opacity-10 fw-bold text-primary">
                                        <i class="bi bi-building me-2"></i> KOP BKPSDMD (Gol I-III & PPPK)
                                    </div>
                                    <div class="card-body">
                                        <div class="mb-3">
                                            <label class="form-label small fw-bold">Nama Instansi</label>
                                            <input v-model="varsForm.kop_bkpsdmd.judul" type="text" class="form-control">
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label small fw-bold">Alamat Lengkap</label>
                                            <textarea v-model="varsForm.kop_bkpsdmd.alamat" class="form-control" rows="3"></textarea>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label small fw-bold text-primary">Pejabat Penandatangan</label>
                                            <select v-model="varsForm.kop_bkpsdmd.pejabat_nip" class="form-select border-primary">
                                                <option value="" disabled>-- Pilih Pejabat --</option>
                                                <option v-for="p in pejabatList" :key="p.nip" :value="p.nip">
                                                    {{ p.nama }} ({{ p.jabatan }})
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="d-grid mt-4">
                            <button type="submit" class="btn btn-success" :disabled="isSaving">
                                <i class="bi bi-save me-2"></i> Simpan Konfigurasi
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div v-if="activeTab === 'dasar'">
            <div class="card border-0 shadow-sm">
                <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                    <h6 class="mb-0 fw-bold text-primary">Daftar Dasar Hukum (Konsiderans)</h6>
                    <button @click="tambahDasar" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-plus-circle me-1"></i> Tambah Item
                    </button>
                </div>
                
                <div v-if="loading" class="text-center py-5"><div class="spinner-border text-primary"></div></div>

                <div v-else class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th style="width: 25%">Judul / Kode</th>
                                    <th>Isi Teks Dasar Hukum</th>
                                    <th style="width: 10%" class="text-end">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="varsForm.dasar_hukum.length === 0">
                                    <td colspan="3" class="text-center py-4 text-muted">Belum ada data dasar hukum.</td>
                                </tr>
                                <tr v-else v-for="(item, index) in varsForm.dasar_hukum" :key="index">
                                    <td>
                                        <input v-model="item.judul" type="text" class="form-control fw-bold" placeholder="Contoh: Perpres Gaji">
                                    </td>
                                    <td>
                                        <textarea v-model="item.isi" class="form-control" rows="2" placeholder="Isi teks hukum..."></textarea>
                                    </td>
                                    <td class="text-end">
                                        <button @click="hapusDasar(index)" class="btn btn-sm btn-outline-danger" title="Hapus">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="card-footer bg-white p-3">
                    <button @click="simpanVars" class="btn btn-success w-100" :disabled="isSaving">
                        <i class="bi bi-save me-2"></i> Simpan Perubahan Dasar Hukum
                    </button>
                </div>
            </div>
        </div>

        <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5);" tabindex="-1" @click.self="closeModal">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title fw-bold">Set Template File</h5>
                        <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form @submit.prevent="simpanConfig">
                            <div class="mb-3">
                                <label class="form-label fw-bold small text-muted">Kategori SK</label>
                                <select v-model="form.kategori" class="form-select" required>
                                    <option value="" disabled>-- Pilih Jenis --</option>
                                    <option value="PNS">PNS</option>
                                    <option value="IMPASSING_PNS">IMPASSING PNS</option>
                                    <option value="PPPK">PPPK</option>
                                    <option value="IMPASSING_PPPK">IMPASSING PPPK</option>
                                </select>
                            </div>
                            <div class="mb-4">
                                <label class="form-label fw-bold small text-muted">Nama File (.docx)</label>
                                <div class="input-group">
                                    <span class="input-group-text bg-light text-muted">/templates/</span>
                                    <input v-model="form.nama_file" type="text" class="form-control" placeholder="file.docx" required>
                                </div>
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
        const activeTab = ref('files');
        const listData = ref([]);
        const pejabatList = ref([]);
        const loading = ref(true);
        const showModal = ref(false);
        const isSaving = ref(false);
        
        const form = reactive({ kategori: '', nama_file: '' });

        // STRUKTUR DATA UTAMA
        const varsForm = reactive({
            kop_setda: { judul: '', alamat: '', pejabat_nip: '' },
            kop_bkpsdmd: { judul: '', alamat: '', pejabat_nip: '' },
            dasar_hukum: [] // Array dinamis
        });

        // 1. FUNGSI GANTI TAB (FIXED)
        const changeTab = async (tabName) => {
            activeTab.value = tabName;
            
            // Jika masuk ke tab KOP atau DASAR, load data variabel
            if (tabName === 'kop' || tabName === 'dasar') {
                await loadVars();
            } else {
                await fetchData(); // Load file list
            }
        };

        // 2. FETCH DATA FILE TEMPLATE
        const fetchData = async () => {
            loading.value = true;
            try {
                const q = query(collection(db, "config_template"), orderBy("updated_at", "desc"));
                const snap = await getDocs(q);
                // Filter agar 'GLOBAL_VARS' tidak muncul di list file
                listData.value = snap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(d => d.id !== 'GLOBAL_VARS'); 
            } catch (e) { console.error(e); } 
            finally { loading.value = false; }
        };

        // 3. FETCH DATA PEJABAT
        const fetchPejabat = async () => {
            try {
                const q = query(collection(db, "master_pejabat"), orderBy("nama"));
                const snap = await getDocs(q);
                pejabatList.value = snap.docs.map(doc => doc.data());
            } catch (e) { console.error("Gagal load pejabat", e); }
        };

        // 4. LOAD VARIABEL (Kop & Dasar)
        const loadVars = async () => {
            loading.value = true;
            await fetchPejabat(); // Pastikan list pejabat terload dulu

            try {
                const docRef = doc(db, "config_template", "GLOBAL_VARS");
                const snap = await getDoc(docRef);
                
                if (snap.exists()) {
                    const data = snap.data();
                    
                    // Merge Data Hati-hati agar tidak error null
                    if (data.kop_setda) Object.assign(varsForm.kop_setda, data.kop_setda);
                    if (data.kop_bkpsdmd) Object.assign(varsForm.kop_bkpsdmd, data.kop_bkpsdmd);
                    
                    // Array Dasar Hukum
                    if (Array.isArray(data.dasar_hukum)) {
                        varsForm.dasar_hukum = data.dasar_hukum;
                    } else {
                        // Default jika kosong
                        varsForm.dasar_hukum = [
                            { judul: 'Perpres Gaji', isi: 'Atas dasar Peraturan Pemerintah...' },
                            { judul: 'Dasar Pangkat', isi: 'Surat Keputusan terakhir...' }
                        ];
                    }
                } 
            } catch (e) {
                showToast("Gagal memuat konfigurasi", 'error');
            } finally {
                loading.value = false;
            }
        };

        // 5. SIMPAN VARIABEL
        const simpanVars = async () => {
            isSaving.value = true;
            try {
                await setDoc(doc(db, "config_template", "GLOBAL_VARS"), {
                    ...varsForm, // Simpan state varsForm apa adanya
                    updated_at: serverTimestamp()
                });
                showToast("Konfigurasi berhasil diperbarui!", 'success');
            } catch (e) {
                showToast(e.message, 'error');
            } finally {
                isSaving.value = false;
            }
        };

        // --- CRUD FILE TEMPLATE ---
        const simpanConfig = async () => {
            if (!form.nama_file.endsWith('.docx')) return showToast("Wajib .docx", 'warning');
            isSaving.value = true;
            try {
                await setDoc(doc(db, "config_template", form.kategori), {
                    kategori: form.kategori,
                    nama_file: form.nama_file.trim(),
                    updated_at: serverTimestamp()
                });
                showToast("Tersimpan!"); closeModal(); fetchData();
            } catch (e) { showToast(e.message, 'error'); } 
            finally { isSaving.value = false; }
        };

        const hapusTemplate = async (item) => {
            if (await showConfirm('Hapus?', `Hapus mapping ${item.kategori}?`)) {
                await deleteDoc(doc(db, "config_template", item.id));
                fetchData();
            }
        };

        // --- CRUD ARRAY DASAR HUKUM ---
        const tambahDasar = () => varsForm.dasar_hukum.push({ judul: '', isi: '' });
        const hapusDasar = (index) => varsForm.dasar_hukum.splice(index, 1);

        // Helpers
        const openModal = () => { form.kategori=''; form.nama_file=''; showModal.value=true; };
        const closeModal = () => showModal.value = false;
        const formatJudul = (v) => v ? v.replace(/_/g, ' ') : '';

        onMounted(() => fetchData());

        return { 
            activeTab, listData, loading, showModal, isSaving, 
            form, varsForm, pejabatList,
            changeTab, loadVars, simpanVars,
            simpanConfig, hapusTemplate,
            tambahDasar, hapusDasar,
            openModal, closeModal, formatJudul 
        };
    }
};