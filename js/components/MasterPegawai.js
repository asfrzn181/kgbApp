import { ref, reactive, onMounted, watch } from 'vue';
import { 
    db, collection, getDocs, setDoc, deleteDoc, doc, 
    query, orderBy, limit, startAfter, writeBatch, serverTimestamp,
    where 
} from '../firebase.js';
import { showToast, showConfirm, debounce } from '../utils.js';

// IMPORT VIEW DARI FILE TERPISAH
import { TplMasterPegawai } from '../views/MasterPegawaiView.js';

export default {
    template: TplMasterPegawai,
    setup() {
        // --- STATE DASAR ---
        const listData = ref([]);
        const loading = ref(true);
        const loadingStats = ref(false); 
        const showModal = ref(false);
        const isEdit = ref(false);
        const isSaving = ref(false);
        const form = reactive({ nip: '', nama: '', tempat_lahir: '', perangkat_daerah: '' });
        
        // Import
        const isImporting = ref(false);
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
        const stats = reactive({ boomers: 0, genx: 0, millennials: 0, genz: 0, alpha: 0, total: 0 });

        // --- 1. LOGIKA GENERASI & INFO NIP ---
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

        // --- 2. LOGIKA HITUNG STATISTIK ---
        const hitungStatistik = async () => {
            loadingStats.value = true;
            try {
                // Ambil semua dokumen (Hati-hati jika data > 10.000, sebaiknya pakai aggregasi server)
                const q = query(collection(db, "master_pegawai"));
                const snap = await getDocs(q);
                
                stats.boomers = 0; stats.genx = 0; stats.millennials = 0; stats.genz = 0; stats.alpha = 0;
                stats.total = snap.size;

                snap.forEach(doc => {
                    const nip = doc.id; 
                    const year = parseInt(nip.substring(0, 4));
                    if (year >= 1946 && year <= 1964) stats.boomers++;
                    else if (year >= 1965 && year <= 1980) stats.genx++;
                    else if (year >= 1981 && year <= 1996) stats.millennials++;
                    else if (year >= 1997 && year <= 2012) stats.genz++;
                    else if (year >= 2013) stats.alpha++;
                });
                showToast("Statistik diperbarui!", "success");
            } catch (e) {
                console.error(e);
                showToast("Gagal hitung statistik", 'error');
            } finally { loadingStats.value = false; }
        };

        // --- 3. FETCH DATA & SEARCH ---
        const fetchData = async (direction = 'first') => {
            loading.value = true;
            try {
                let q;
                const collRef = collection(db, "master_pegawai");

                if (searchQuery.value.trim()) {
                    const term = searchQuery.value.trim();
                    q = query(collRef, 
                        orderBy('nip'), 
                        where('nip', '>=', term),
                        where('nip', '<=', term + '\uf8ff'),
                        limit(itemsPerPage)
                    );
                    if(direction !== 'next' && direction !== 'prev') { currentPage.value=1; pageStack.value=[]; }
                } else {
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
            } finally { loading.value = false; }
        };

        // Helpers
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

        const runSearch = debounce(() => { pageStack.value = []; fetchData('first'); }, 800);
        watch(searchQuery, runSearch);
        
        const nextPage = () => fetchData('next');
        const prevPage = () => fetchData('prev');

        // --- 4. IMPORT EXCEL (FULL IMPLEMENTATION) ---
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

                    // Header di Excel harus: NIP, NAMA, TEMPAT_LAHIR, PERANGKAT_DAERAH
                    const CHUNK = 300;
                    for (let i = 0; i < json.length; i += CHUNK) {
                        const batch = writeBatch(db);
                        json.slice(i, i + CHUNK).forEach(row => {
                            const nip = row['NIP'] || row['nip'];
                            const nama = row['NAMA'] || row['nama'];
                            // Optional
                            const tempat = row['TEMPAT_LAHIR'] || row['tempat_lahir'] || '';
                            const opd = row['PERANGKAT_DAERAH'] || row['perangkat_daerah'] || '';

                            if (nip && nama) {
                                const nipStr = String(nip).replace(/['"\s]/g, '');
                                batch.set(doc(db, "master_pegawai", nipStr), {
                                    nip: nipStr,
                                    nama: String(nama).trim(),
                                    tempat_lahir: String(tempat).trim(),
                                    perangkat_daerah: String(opd).trim(),
                                    updated_at: serverTimestamp()
                                }, { merge: true });
                            }
                        });
                        await batch.commit();
                    }
                    showToast(`Import ${json.length} pegawai sukses!`);
                    fetchData('first');
                } catch (err) {
                    showToast("Gagal: " + err.message, 'error');
                } finally {
                    isImporting.value = false;
                    event.target.value = '';
                }
            };
            reader.readAsArrayBuffer(file);
        };

        // --- 5. CRUD (SIMPAN & HAPUS) ---
        const simpanData = async () => {
            if (!form.nip || !form.nama) return showToast("NIP & Nama wajib diisi!", 'warning');
            isSaving.value = true;
            try {
                // ID Dokumen = NIP
                await setDoc(doc(db, "master_pegawai", form.nip), {
                    ...form,
                    updated_at: serverTimestamp()
                }, { merge: true });
                
                showToast("Pegawai Tersimpan!");
                closeModal();
                fetchData('first');
            } catch (e) {
                showToast(e.message, 'error');
            } finally {
                isSaving.value = false;
            }
        };

        const hapusData = async (item) => {
            if(await showConfirm('Hapus?', `Hapus ${item.nama}?`)) {
                try {
                    await deleteDoc(doc(db, "master_pegawai", item.nip));
                    showToast("Terhapus"); 
                    fetchData('first');
                } catch (e) {
                    showToast(e.message, 'error');
                }
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
            isImporting, handleImportExcel, 
            simpanData, hapusData, openModal, closeModal, 
            getInfoNip, getGenColor, hitungStatistik, stats,
            changeSort, getSortIcon
        };
    }
};