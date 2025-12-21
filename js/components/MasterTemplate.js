import { ref, reactive, onMounted } from 'vue';
import { 
    db, collection, getDocs, getDoc, setDoc, deleteDoc, doc, 
    query, orderBy, serverTimestamp 
} from '../firebase.js';
import { showToast, showConfirm } from '../utils.js';

// --- IMPORT VIEW HTML ---
import { TplMasterTemplate } from '../views/MasterTemplateView.js';

export default {
    template: TplMasterTemplate,
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

        // 1. FUNGSI GANTI TAB
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
            await fetchPejabat(); 

            try {
                const docRef = doc(db, "config_template", "GLOBAL_VARS");
                const snap = await getDoc(docRef);
                
                if (snap.exists()) {
                    const data = snap.data();
                    
                    if (data.kop_setda) Object.assign(varsForm.kop_setda, data.kop_setda);
                    if (data.kop_bkpsdmd) Object.assign(varsForm.kop_bkpsdmd, data.kop_bkpsdmd);
                    
                    if (Array.isArray(data.dasar_hukum)) {
                        // Mapping agar jika data lama belum ada field 'pejabat', tidak error
                        varsForm.dasar_hukum = data.dasar_hukum.map(d => ({
                            judul: d.judul || '',
                            nomor: d.nomor || '',
                            pejabat: d.pejabat || '', // Default Kosong
                            isi: d.isi || ''
                        }));
                    } else {
                        // Default jika kosong
                        varsForm.dasar_hukum = [
                            { judul: 'Perpres Gaji', nomor: '', pejabat: 'Presiden RI', isi: 'Atas dasar Peraturan Pemerintah...' },
                            { judul: 'Dasar Pangkat', nomor: '', pejabat: 'Bupati', isi: 'Surat Keputusan terakhir...' }
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
                    ...varsForm,
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

        // --- CRUD ARRAY DASAR HUKUM (UPDATED) ---
        const tambahDasar = () => {
            // Tambahkan object kosong dengan field pejabat
            varsForm.dasar_hukum.push({ judul: '', nomor: '', pejabat: '', isi: '' });
        };
        
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