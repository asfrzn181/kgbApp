import { ref, reactive, onMounted, watch } from 'vue';
import { 
    db, collection, getDocs, setDoc, deleteDoc, doc, 
    query, orderBy, limit, startAfter, writeBatch, serverTimestamp,
    where, getCountFromServer 
} from '../firebase.js';
import { showToast, showConfirm, formatRupiah, debounce } from '../utils.js';

// --- IMPORT VIEW HTML ---
import { TplMasterGaji } from '../views/MasterGajiView.js';

export default {
    template: TplMasterGaji, 
    setup() {
        // State
        const listData = ref([]);
        const totalReal = ref(0); 
        const loading = ref(true);
        const showModal = ref(false);
        const isEdit = ref(false);
        const isSaving = ref(false);
        const form = reactive({ golongan: '', mkg: 0, gaji: 0 });
        
        // Import & Search & Pagination State
        const isImporting = ref(false);
        const fileInput = ref(null);
        const searchQuery = ref('');
        const itemsPerPage = 15;
        const currentPage = ref(1);
        const isLastPage = ref(false);
        const pageStack = ref([]);

        // --- HITUNG JUMLAH DATA REAL (SERVER SIDE) ---
        // Biaya: 1 Read per 1000 dokumen (Murah)
        const hitungTotalReal = async () => {
            try {
                const coll = collection(db, "master_gaji");
                const snapshot = await getCountFromServer(coll);
                totalReal.value = snapshot.data().count;
            } catch (e) { console.error("Gagal hitung total:", e); }
        };

        // --- FETCH DATA (OPTIMIZED) ---
        const fetchData = async (direction = 'first') => {
            loading.value = true;
            try {
                let q;
                const collRef = collection(db, "master_gaji");

                if (searchQuery.value.trim()) {
                    // [SEARCH MODE] Prefix Search Golongan
                    const term = searchQuery.value.trim();
                    // Asumsi: Golongan di DB disimpan standar (misal "III/a" atau "IV/b")
                    // Jika user ketik "III", akan muncul semua gol III.
                    
                    q = query(collRef, 
                        orderBy('golongan'), 
                        where('golongan', '>=', term),
                        where('golongan', '<=', term + '\uf8ff'),
                        limit(itemsPerPage)
                    );
                    
                    if(direction === 'first') { currentPage.value = 1; pageStack.value = []; }
                } else {
                    // [NORMAL MODE] Stable Sort by Golongan -> MKG
                    // Index Composite Diperlukan: (golongan ASC, mkg ASC)
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
                showToast("Data Gagal Dimuat. Cek Console.", 'error');
            } finally {
                loading.value = false;
            }
        };

        const nextPage = () => fetchData('next');
        const prevPage = () => fetchData('prev');
        const runSearch = debounce(() => fetchData('first'), 800);
        watch(searchQuery, runSearch);

        // --- IMPORT EXCEL (BATCH WRITE) ---
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
                    
                    const CHUNK = 400; // Batch limit 500
                    let count = 0;
                    
                    for(let i=0; i<json.length; i+=CHUNK){
                        const batch = writeBatch(db);
                        json.slice(i, i+CHUNK).forEach(row => {
                            const gol = row['GOLONGAN'] || row['golongan'];
                            const mk = row['MKG'] || row['mkg'];
                            const gaji = row['GAJI'] || row['gaji'];
                            
                            if(gol && gaji) {
                                // ID Unik: GOL_MK (Contoh: III/A_0)
                                const docId = String(gol).trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() + '_' + (mk||0);
                                batch.set(doc(db, "master_gaji", docId), {
                                    golongan: String(gol).trim(), 
                                    mkg: Number(mk||0), 
                                    gaji: Number(gaji),
                                    updated_at: serverTimestamp()
                                }, {merge:true});
                                count++;
                            }
                        });
                        await batch.commit();
                    }

                    showToast(`Import ${count} data gaji selesai!`);
                    fetchData('first');
                    hitungTotalReal(); 

                } catch (err) { showToast(err.message, 'error'); } 
                finally { isImporting.value = false; event.target.value = ''; }
            };
            reader.readAsArrayBuffer(file);
        };

        // --- CRUD Manual ---
        const generateId = (gol, mk) => String(gol).trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() + '_' + mk;

        const simpanData = async () => {
            isSaving.value = true;
            try {
                const docId = generateId(form.golongan, form.mkg);
                await setDoc(doc(db, "master_gaji", docId), {
                    golongan: form.golongan, 
                    mkg: Number(form.mkg), 
                    gaji: Number(form.gaji),
                    updated_at: serverTimestamp()
                }, { merge: true });
                
                showToast("Disimpan!"); closeModal(); 
                fetchData('first');
                hitungTotalReal();
            } catch (e) { showToast(e.message, 'error'); } 
            finally { isSaving.value = false; }
        };

        const hapusData = async (item) => {
            if (await showConfirm('Hapus?', `Hapus data gaji ini?`)) {
                try {
                    await deleteDoc(doc(db, "master_gaji", item.id));
                    showToast("Terhapus"); 
                    fetchData('first');
                    hitungTotalReal();
                } catch(e) { showToast(e.message, 'error'); }
            }
        };

        const openModal = (item) => {
            isEdit.value = !!item;
            if (item) Object.assign(form, item);
            else { form.golongan = ''; form.mkg = 0; form.gaji = 0; }
            showModal.value = true;
        };
        const closeModal = () => showModal.value = false;

        onMounted(() => {
            fetchData('first');
            hitungTotalReal();
        });

        return { 
            listData, totalReal, hitungTotalReal,
            loading, showModal, isEdit, isSaving, 
            form, searchQuery, isImporting,
            currentPage, isLastPage, nextPage, prevPage,
            simpanData, hapusData, openModal, closeModal, 
            handleImportExcel, formatRupiah 
        };
    }
};