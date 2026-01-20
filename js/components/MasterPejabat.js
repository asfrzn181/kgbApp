import { ref, reactive, onMounted, watch } from 'vue';
import { 
    db, collection, getDocs, setDoc, deleteDoc, doc, 
    query, orderBy, limit, startAfter, writeBatch, serverTimestamp,
    where, getCountFromServer 
} from '../firebase.js';
import { showToast, showConfirm, debounce } from '../utils.js';

// --- IMPORT VIEW HTML ---
import { TplMasterPejabat } from '../views/MasterPejabatView.js';

export default {
    template: TplMasterPejabat, // Menggunakan HTML dari View
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