import { ref, reactive, onMounted, watch } from 'vue';
import { 
    db, collection, getDocs, setDoc, deleteDoc, doc, 
    query, orderBy, limit, startAfter, writeBatch, serverTimestamp,
    where, getCountFromServer 
} from '../firebase.js';
import { showToast, showConfirm, debounce, formatTitleCase } from '../utils.js'; // Import Formatter

// --- IMPORT VIEW HTML ---
import { TplMasterJabatan } from '../views/MasterJabatanView.js';

export default {
    template: TplMasterJabatan, 
    setup() {
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

        // FORM
        const form = reactive({ 
            nama_jabatan: '', 
            jenis_jabatan: 'Pelaksana' 
        });

        // --- 1. FETCH DATA (OPTIMIZED SEARCH) ---
        const fetchData = async (direction = 'first') => {
            loading.value = true;
            try {
                let q; const collRef = collection(db, "master_jabatan");

                if (searchQuery.value.trim()) {
                    // [OPTIMIZED] Server-Side Prefix Search
                    const term = searchQuery.value.trim();
                    // Karena kita simpan dalam Title Case, search juga harus Title Case (atau Upper jika data Upper)
                    // Asumsi: Kita pakai formatTitleCase saat simpan.
                    const termFormatted = formatTitleCase(term);

                    q = query(collRef, 
                        orderBy("nama_jabatan"), // Search by Nama, bukan Kode
                        where("nama_jabatan", ">=", termFormatted),
                        where("nama_jabatan", "<=", termFormatted + "\uf8ff"),
                        limit(20) // Limit search secukupnya
                    );
                    
                    const snap = await getDocs(q);
                    listData.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    isLastPage.value = true;
                    
                    if(direction !== 'next' && direction !== 'prev') { currentPage.value=1; pageStack.value=[]; }

                } else {
                    // Logic Pagination Normal
                    if (direction === 'first') { q = query(collRef, orderBy("kode_jabatan"), limit(itemsPerPage)); pageStack.value = []; currentPage.value = 1; }
                    else if (direction === 'next') { const last = pageStack.value[pageStack.value.length - 1]; q = query(collRef, orderBy("kode_jabatan"), startAfter(last), limit(itemsPerPage)); currentPage.value++; }
                    else if (direction === 'prev') { pageStack.value.pop(); const prev = pageStack.value[pageStack.value.length - 1]; if (!prev) q = query(collRef, orderBy("kode_jabatan"), limit(itemsPerPage)); else q = query(collRef, orderBy("kode_jabatan"), startAfter(prev), limit(itemsPerPage)); currentPage.value--; }
                    
                    const snap = await getDocs(q);
                    listData.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    isLastPage.value = snap.docs.length < itemsPerPage;
                    if(direction !== 'prev' && snap.docs.length > 0) pageStack.value.push(snap.docs[snap.docs.length - 1]);
                }
                
                if(!searchQuery.value && totalReal.value === 0) { 
                    const snapCount = await getCountFromServer(collRef); 
                    totalReal.value = snapCount.data().count; 
                }
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
            return String(nama).trim().replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
        };

        // --- 3. CRUD MANUAL ---
        const simpanData = async () => {
            isSaving.value = true;
            try {
                // Apply Formatter
                form.nama_jabatan = formatTitleCase(form.nama_jabatan);
                
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

        // --- 4. IMPORT EXCEL (WITH FORMATTER) ---
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
                    let count = 0;
                    for (let i = 0; i < json.length; i += CHUNK) {
                        const batch = writeBatch(db);
                        json.slice(i, i + CHUNK).forEach(row => {
                            const rawNama = row['NAMA_JABATAN'] || row['Nama_Jabatan'] || row['NAMA'] || row['Nama'] || row['JABATAN'] || row['jabatan'];
                            let jenis = row['JENIS_JABATAN'] || row['Jenis_Jabatan'] || row['JENIS'] || row['Jenis'] || 'Pelaksana';

                            if (rawNama) {
                                // [FORMATTER] Rapikan nama jabatan dari Excel
                                const cleanNama = formatTitleCase(String(rawNama).trim());
                                const id = generateId(cleanNama);
                                
                                batch.set(doc(db, "master_jabatan", id), {
                                    kode_jabatan: id,
                                    nama_jabatan: cleanNama,
                                    jenis_jabatan: String(jenis).trim(),
                                    updated_at: serverTimestamp()
                                }, { merge: true });
                                count++;
                            }
                        });
                        await batch.commit();
                    }
                    showToast(`Import ${count} jabatan sukses!`);
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