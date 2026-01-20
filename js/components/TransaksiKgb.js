import { ref, reactive, watch, onMounted, computed, nextTick } from 'vue';
import { 
    db, auth, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, getCountFromServer,
    query, orderBy, limit, startAfter, where, serverTimestamp, onAuthStateChanged 
} from '../firebase.js';
import { showToast, showConfirm, debounce, formatRupiah, formatTanggal } from '../utils.js';
import { store } from '../store.js';

// --- IMPORT VIEW ---
import { TplSearchSelect, TplAutocompleteJabatan, TplAutocompleteUnitKerja, TplAutocompletePerangkatDaerah, TplMain } from '../views/TransaksiKgbView.js';

// ==========================================
// 1. FORMATTER SAFE MODE (FIXED SPASI)
// ==========================================
const LIST_SINGKATAN = [
    'UPTD', 'SMP', 'SD', 'RSUD', 'TK', 'PAUD', 'BLUD', 
    'PNS', 'PPPK', 'ASN', 'SDN', 'SMPN', 'SMAN', 'SMKN', "DPRD", "PPKN", "IPA", "IPS"
];
const LIST_KECIL = [
    'dan', 'di', 'ke', 'dari', 'yang', 'pada', 'untuk', 'atau', 'dengan', 'atas', 'oleh'
];

const formatTitleCase = (text) => {
    if (!text) return '';
    // Regex replace hanya mengganti kata, spasi tetap utuh
    return text.replace(/\w+/g, (word, index) => {
        const upper = word.toUpperCase();
        const lower = word.toLowerCase();
        if (LIST_SINGKATAN.includes(upper)) return upper;
        if (index > 0 && LIST_KECIL.includes(lower)) return lower;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
};

// --- SUB-COMPONENTS (Sama, logic formatTitleCase di dalamnya otomatis pakai yg baru) ---
const SearchSelect = {
    props: ['options', 'modelValue', 'placeholder', 'labelKey', 'valueKey', 'disabled'],
    emits: ['update:modelValue', 'change'],
    template: TplSearchSelect, 
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
            emit('update:modelValue', getKey(opt)); emit('change', opt); isOpen.value = false; search.value = '';
        };
        return { isOpen, search, safeOptions, selectedLabel, selectOpt, getKey, getLabel };
    }
};

const AutocompleteJabatan = {
    props: ['modelValue'],
    emits: ['update:modelValue', 'select'],
    template: TplAutocompleteJabatan, 
    setup(props, { emit }) {
        const showSuggestions = ref(false);
        const suggestions = ref([]);
        const fetchSuggestions = debounce(async (keyword) => {
            if (!keyword || keyword.length < 3) { suggestions.value = []; return; }
            try {
                const q = query(collection(db, "master_jabatan"), where("nama_jabatan", ">=", keyword), where("nama_jabatan", "<=", keyword + "\uf8ff"), limit(5));
                const snap = await getDocs(q);
                suggestions.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {}
        }, 800);
        
        const handleInput = (e) => {
            let val = e.target.value;
            val = formatTitleCase(val); // SAFE MODE
            e.target.value = val; 
            emit('update:modelValue', val);
            fetchSuggestions(val); 
            showSuggestions.value = true;
        };
        
        const selectItem = (item) => { 
            const fmt = formatTitleCase(item.nama_jabatan);
            emit('update:modelValue', fmt); 
            emit('select', item); 
            showSuggestions.value = false; 
        };
        const delayHide = () => setTimeout(() => showSuggestions.value = false, 200);
        return { showSuggestions, suggestions, handleInput, selectItem, delayHide };
    }
};

const AutocompleteUnitKerja = {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: TplAutocompleteUnitKerja,
    setup(props, { emit }) {
        const showSuggestions = ref(false);
        const suggestions = ref([]);
        const processSnap = (snap, keyword) => {
            const units = new Set();
            const keyLower = keyword.toLowerCase();
            snap.forEach(doc => {
                const val = doc.data().unit_kerja;
                if(val && val.toLowerCase().includes(keyLower)) units.add(val);
            });
            return Array.from(units).slice(0, 5);
        };
        const fetchSuggestions = debounce(async (keyword) => {
            if (!keyword || keyword.length < 3) { suggestions.value = []; return; }
            try {
                // HEMAT: Sebaiknya punya master_unit_kerja sendiri, tapi query limit 50 ini "acceptable"
                const qGlobal = query(collection(db, "usulan_kgb"), orderBy("created_at", "desc"), limit(50)); 
                const snap = await getDocs(qGlobal);
                suggestions.value = processSnap(snap, keyword);
            } catch (e) { }
        }, 500);
        
        const handleInput = (e) => { 
            let val = e.target.value;
            val = formatTitleCase(val);
            e.target.value = val;
            emit('update:modelValue', val); 
            fetchSuggestions(val); 
            showSuggestions.value = true; 
        };
        
        const selectItem = (item) => { 
            const fmt = formatTitleCase(item);
            emit('update:modelValue', fmt); 
            showSuggestions.value = false; 
        };
        const delayHide = () => setTimeout(() => showSuggestions.value = false, 200);
        return { showSuggestions, suggestions, handleInput, selectItem, delayHide };
    }
};

const AutocompletePerangkatDaerah = {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: TplAutocompletePerangkatDaerah,
    setup(props, { emit }) {
        const showSuggestions = ref(false);
        const suggestions = ref([]);
        const processSnap = (snap, keyword) => {
            const results = new Set();
            const keyLower = keyword.toLowerCase();
            snap.forEach(doc => {
                const val = doc.data().perangkat_daerah;
                if(val && val.toLowerCase().includes(keyLower)) results.add(val);
            });
            return Array.from(results).slice(0, 5);
        };
        const fetchSuggestions = debounce(async (keyword) => {
            if (!keyword || keyword.length < 3) { suggestions.value = []; return; }
            try {
                const qGlobal = query(collection(db, "usulan_kgb"), orderBy("created_at", "desc"), limit(50)); 
                const snap = await getDocs(qGlobal);
                suggestions.value = processSnap(snap, keyword);
            } catch (e) { }
        }, 500);
        
        const handleInput = (e) => { 
            let val = e.target.value;
            val = formatTitleCase(val);
            e.target.value = val;
            emit('update:modelValue', val); 
            fetchSuggestions(val); 
            showSuggestions.value = true; 
        };
        
        const selectItem = (item) => { 
            const fmt = formatTitleCase(item);
            emit('update:modelValue', fmt); 
            showSuggestions.value = false; 
        };
        const delayHide = () => setTimeout(() => showSuggestions.value = false, 200);
        return { showSuggestions, suggestions, handleInput, selectItem, delayHide };
    }
};

// --- MAIN COMPONENT ---
export default {
    components: { SearchSelect, AutocompleteJabatan, AutocompleteUnitKerja, AutocompletePerangkatDaerah },
    template: TplMain, 
    setup() {
        const listData = ref([]);
        const tableLoading = ref(true);
        const tableSearch = ref('');
        const currentPage = ref(1);
        const itemsPerPage = ref(10); 
        const pageStack = ref([]); 
        const totalItems = ref(0);
        const isLastPage = ref(false); 
        const filterStartDate = ref('');
        const filterEndDate = ref('');
        const expandedRows = ref([]); 
        const toggleRow = (id) => {
            if (expandedRows.value.includes(id)) expandedRows.value = expandedRows.value.filter(rowId => rowId !== id);
            else expandedRows.value.push(id);
        };
        const isExpanded = (id) => expandedRows.value.includes(id);

        const showModal = ref(false);
        const showPreviewModal = ref(false);
        const previewLoading = ref(false);
        const currentPreviewItem = ref(null);
        const previewTab = ref('TTE');

        const isEditMode = ref(false);
        const isSaving = ref(false);
        const isSearching = ref(false);
        const searchMsg = ref('');
        const gajiMsg = ref('');
        const formId = ref(null);
        
        // CACHE DATA (Untuk Hemat Read di Preview)
        const listGolongan = ref([]); 
        const listDasarHukum = ref([]);
        const listPejabat = ref([]); 
        const configPejabat = reactive({ setda: null, bkpsdmd: null });
        const cacheGlobalVars = ref({}); // Cache Global Vars
        const cacheTemplates = ref({}); // Cache Template URL

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
        const totalPages = computed(() => Math.ceil(totalItems.value / itemsPerPage.value) || 1);
        
        const visiblePages = computed(() => {
            const pages = [];
            const total = totalPages.value;
            const current = currentPage.value;
            let start = Math.max(1, current - 2);
            let end = Math.min(total, start + 4);
            if (end - start < 4) start = Math.max(1, end - 4);
            for (let i = start; i <= end; i++) { pages.push(i); }
            return pages;
        });

        watch(() => form.dasar_hukum, (newVal) => {
            if (!newVal || listDasarHukum.value.length === 0) return;
            const selectedMaster = listDasarHukum.value.find(item => item.judul === newVal);
            if (selectedMaster) {
                if (selectedMaster.pejabat) form.dasar_pejabat = selectedMaster.pejabat;
                if (selectedMaster.nomor && !form.dasar_nomor) form.dasar_nomor = selectedMaster.nomor;
            }
        });

        const mapDoc = (d) => {
            const data = d.data();
            data.id = d.id; 
            if (data.tgl_teken?.toDate) data.tgl_teken_formatted = formatTanggal(data.tgl_teken.toDate().toISOString().split('T')[0]);
            if (data.tgl_distribusi?.toDate) data.tgl_distribusi_formatted = formatTanggal(data.tgl_distribusi.toDate().toISOString().split('T')[0]);
            return data;
        };

        // --- FETCH TABLE (OPTIMIZED SEARCH & PAGINATION) ---
        const fetchTable = async (pageTarget) => {
            tableLoading.value = true;
            try {
                const collRef = collection(db, "usulan_kgb"); 
                const limitVal = parseInt(itemsPerPage.value) || 10;
                let q; 
                
                // 1. Constraint Dasar (Filter User Biasa / Tanggal TMT)
                const baseConstraints = [];
                baseConstraints.push(where("created_by", "==", auth.currentUser.uid));
                
                // Note: Filter TMT hanya bisa dipakai jika TIDAK sedang searching nama/nip
                // karena Firestore punya batasan sorting field.
                const isFilteringDate = filterStartDate.value || filterEndDate.value;

                // --- CABANG LOGIKA: SEARCH vs NORMAL ---
                
                if (tableSearch.value.trim()) {
                    const term = tableSearch.value.trim();
                    const isNumber = /^\d+$/.test(term); 

                    let searchConstraints = [...baseConstraints];

                    if (isNumber) {
                        // A. Cari NIP (Angka)
                        searchConstraints.push(orderBy("nip")); 
                        searchConstraints.push(where("nip", ">=", term));
                        searchConstraints.push(where("nip", "<=", term + "\uf8ff"));
                    } else {
                        // B. Cari Nama (Huruf)
                        // [PERBAIKAN] Gunakan UPPERCASE agar cocok dengan data ASN umumnya
                        // Jika data Anda campuran (ada besar/kecil), solusi terbaik adalah 'nama_lower' (lihat bawah)
                        const termNama = term.toUpperCase(); 
                        
                        searchConstraints.push(orderBy("nama"));
                        searchConstraints.push(where("nama", ">=", termNama));
                        searchConstraints.push(where("nama", "<=", termNama + "\uf8ff"));
                    }

                    // Limit 50 hasil
                    q = query(collRef, ...searchConstraints, limit(50));
                    
                    const snap = await getDocs(q);
                    listData.value = snap.docs.map(mapDoc);
                    isLastPage.value = true;
                    
                } else {
                    // === MODE 2: PAGINATION NORMAL (Data Terbaru) ===
                    
                    if (isFilteringDate) {
                        if (filterStartDate.value) baseConstraints.push(where("tmt_sekarang", ">=", filterStartDate.value));
                        if (filterEndDate.value) baseConstraints.push(where("tmt_sekarang", "<=", filterEndDate.value));
                    }

                    // Hitung Total (Hanya sekali di awal)
                    if (pageTarget === 1 || pageTarget === 'first') {
                        const snapshotCount = await getCountFromServer(query(collRef, ...baseConstraints));
                        totalItems.value = snapshotCount.data().count;
                        pageStack.value = [];
                        currentPage.value = 1;
                    }

                    // Query Dasar (Sort by Created At)
                    // PENTING: Jika ada filter where(...), orderBy pertama harus field tsb.
                    // Jika filter TMT aktif -> Order by TMT. Jika tidak -> Order by CreatedAt
                    const sortField = isFilteringDate ? "tmt_sekarang" : "created_at";
                    
                    let qConstraints = [
                        ...baseConstraints,
                        orderBy(sortField, "desc"),
                        orderBy("__name__", "desc") // Stable sort secondary
                    ];

                    if (typeof pageTarget === 'number') {
                        if (pageTarget === 1) {
                            q = query(collRef, ...qConstraints, limit(limitVal));
                            currentPage.value = 1; pageStack.value = [];
                        } else {
                            // Next / Prev Logic
                            if (pageTarget > currentPage.value) { // Next
                                const lastDoc = pageStack.value[pageStack.value.length - 1];
                                if(lastDoc) {
                                    q = query(collRef, ...qConstraints, startAfter(lastDoc), limit(limitVal));
                                    currentPage.value = pageTarget;
                                } else { fetchTable(1); return; }
                            } 
                            else if (pageTarget < currentPage.value) { // Prev
                                const cursorIndex = pageTarget - 2;
                                if (cursorIndex < 0) {
                                    q = query(collRef, ...qConstraints, limit(limitVal));
                                    pageStack.value = [];
                                } else {
                                    const cursor = pageStack.value[cursorIndex];
                                    q = query(collRef, ...qConstraints, startAfter(cursor), limit(limitVal));
                                    pageStack.value = pageStack.value.slice(0, cursorIndex + 1);
                                }
                                currentPage.value = pageTarget;
                            } else { fetchTable(1); return; }
                        }
                    } else {
                        // Default fallback
                        q = query(collRef, ...qConstraints, limit(limitVal));
                        currentPage.value = 1; pageStack.value = [];
                    }

                    const snap = await getDocs(q);
                    listData.value = snap.docs.map(mapDoc);
                    isLastPage.value = snap.docs.length < limitVal;

                    if (snap.docs.length > 0) {
                        const lastVisible = snap.docs[snap.docs.length - 1];
                        if (currentPage.value === 1) { pageStack.value = [lastVisible]; } 
                        else {
                            if (pageStack.value.length < currentPage.value) pageStack.value.push(lastVisible);
                            else pageStack.value[currentPage.value - 1] = lastVisible;
                        }
                    }
                }
            } catch (e) { 
                console.error("Fetch Error:", e); 
                // Deteksi Error Index Firestore
                if(e.code === 'failed-precondition' || e.message.includes('index')) {
                    const link = e.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                    if(link) {
                        console.warn("Index Required. Click link:", link[0]);
                        showToast("Sistem sedang mengoptimalkan database (Index). Coba lagi dalam 2 menit.", 'info');
                        window.open(link[0], '_blank'); // Buka link otomatis biar admin klik create index
                    } else {
                        showToast("Perlu Index Database (Cek Console)", 'warning');
                    }
                }
            } finally { 
                tableLoading.value = false; 
            }
        };

        const goToPage = (p) => { if (p < 1 || p > totalPages.value || p === currentPage.value) return; fetchTable(p); };
        watch(tableSearch, debounce(() => fetchTable(1), 800));
        watch(itemsPerPage, () => fetchTable(1));

        const updateStatus = async (item, newStatus) => {
            if(!item.id) return showToast("ID Error", "error");
            const oldStatus = item.status; item.status = newStatus; 
            try {
                const updateData = { status: newStatus, tgl_selesai: newStatus === 'SELESAI' ? serverTimestamp() : null };
                await updateDoc(doc(db, "usulan_kgb", item.id), updateData);
                showToast(newStatus === 'SELESAI' ? "Selesai" : "Proses", "success");
                fetchTable(currentPage.value); 
            } catch (e) { item.status = oldStatus; showToast("Gagal update", "error"); }
        };

        // --- INIT REFS (HEMAT & CACHE) ---
        const initRefs = async () => {
            // Cek Cache Data Master
            if (listGolongan.value.length === 0) {
                const qGol = query(collection(db, "master_golongan"), orderBy("kode"));
                const snapGol = await getDocs(qGol);
                listGolongan.value = [];
                const setGol = new Set();
                snapGol.forEach(d => {
                    const data = d.data();
                    if(!setGol.has(data.kode + data.tipe)) {
                        setGol.add(data.kode + data.tipe);
                        listGolongan.value.push({ kode: data.kode, pangkat: data.pangkat, tipe: data.tipe, label_full: `${data.kode} - ${data.pangkat}` });
                    }
                });
            }
            if (listPejabat.value.length === 0) {
                const qPj = query(collection(db, "master_pejabat"), orderBy("nama"));
                const snapPj = await getDocs(qPj);
                listPejabat.value = snapPj.docs.map(d => d.data());
            }
            
            // Cek Cache Global Vars
            if (!cacheGlobalVars.value.dasar_hukum) {
                const docVars = await getDoc(doc(db, "config_template", "GLOBAL_VARS"));
                if(docVars.exists()) {
                    const data = docVars.data();
                    cacheGlobalVars.value = data; // SIMPAN DI CACHE
                    if(data.dasar_hukum) listDasarHukum.value = data.dasar_hukum;
                    if(data.kop_setda) configPejabat.setda = data.kop_setda.pejabat_nip;
                    if(data.kop_bkpsdmd) configPejabat.bkpsdmd = data.kop_bkpsdmd.pejabat_nip;
                }
            }
        };

        const getGaji = async (gol, mk) => { if(!gol) return 0; try{const id=`${gol.replace(/[^a-zA-Z0-9]/g,'').toUpperCase()}_${mk||0}`;const s=await getDoc(doc(db,"master_gaji",id));return s.exists()?s.data().gaji:0;}catch{return 0;} };
        const cariGajiBaru = async () => { form.gaji_baru = await getGaji(form.golongan, form.mk_baru_tahun); if(form.gaji_baru===0) gajiMsg.value='Gaji not found'; else gajiMsg.value=''; };
        const cariGajiLama = async () => { form.dasar_gaji_lama = await getGaji(form.dasar_golongan, form.dasar_mk_tahun); };
        watch(() => [form.golongan, form.mk_baru_tahun], () => debounce(cariGajiBaru, 500)());
        watch(() => [form.dasar_golongan, form.dasar_mk_tahun], () => debounce(cariGajiLama, 500)());

        const extractTglLahir = (nip) => {
            const clean = nip.replace(/\s/g, ''); if (clean.length < 8) return '';
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
                        nama: d.nama, tempat_lahir: d.tempat_lahir||'', tgl_lahir: finalTgl, 
                        perangkat_daerah: formatTitleCase(d.perangkat_daerah || ''), 
                        unit_kerja: formatTitleCase(d.unit_kerja || ''), 
                        jabatan: formatTitleCase(d.jabatan || ''), 
                        tipe_asn: d.tipe_asn || 'PNS',
                        jenis_jabatan: d.jenis_jabatan || 'Pelaksana'
                    });
                    if(d.golongan_kode) { form.golongan = d.golongan_kode; handleGolonganChange(d.golongan_kode); }
                    if (d.pangkat) form.pangkat = d.pangkat;
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
            if (!form.is_pensiun_manual) {
                const next = new Date(tmt); next.setFullYear(next.getFullYear() + 2);
                form.tmt_selanjutnya = next.toISOString().split('T')[0];
            }
            if (form.is_pensiun_manual) { isPensiun.value = true; pensiunMsg.value = "Status: Pensiun"; } 
            else if (new Date(form.tmt_selanjutnya) >= pd) { isPensiun.value = true; pensiunMsg.value = `Masuk BUP`; } 
            else { isPensiun.value = false; pensiunMsg.value = `BUP: ${formatTanggal(pd.toISOString())}`; }
            form.tahun_pembuatan = tmt.getFullYear();
        };
        watch(()=>[form.tmt_sekarang,form.tgl_lahir,currentBup.value,form.is_pensiun_manual], checkBup);

        const setTmtPensiun = () => { form.tmt_selanjutnya = ''; form.is_pensiun_manual = true; showToast("Set Pensiun.", "warning"); };
        const handleJabatanSelect = (item) => { form.jabatan=item.nama_jabatan; form.jenis_jabatan = item.jenis_jabatan || 'Pelaksana'; currentBup.value=item.bup||58; checkBup(); };
        const handleGolonganChange = (kode) => {
            const selected = listGolongan.value.find(g => g.kode === kode);
            if (selected) {
                form.pangkat = selected.pangkat;
                const isHighRank = selected.kode.startsWith('IV') || selected.kode.startsWith('4');
                form.pejabat_baru_nip = isHighRank ? configPejabat.setda : configPejabat.bkpsdmd;
            }
        };

        const openModal = (item=null) => {
            initRefs(); // Load Data (Cached)
            if(item){ 
                if(!item.id) { showToast("ID Error", 'error'); return; }
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
                const safeForm = { ...form }; delete safeForm.eselon; 
                if (safeForm.jenis_jabatan === undefined) safeForm.jenis_jabatan = 'Pelaksana';
                if (safeForm.golongan === undefined) safeForm.golongan = '';

                safeForm.jabatan = formatTitleCase(safeForm.jabatan);
                safeForm.unit_kerja = formatTitleCase(safeForm.unit_kerja);
                safeForm.perangkat_daerah = formatTitleCase(safeForm.perangkat_daerah);

                const payload = { ...safeForm, ...pjSnap, nama_snapshot: form.nama, jabatan_snapshot: form.jabatan, creator_email: auth.currentUser.email, updated_at: serverTimestamp() };
                
                if(isEditMode.value) {
                    await updateDoc(doc(db,"usulan_kgb",formId.value), payload);
                } else { 
                    payload.created_at=serverTimestamp(); payload.created_by=auth.currentUser.uid; payload.status='DRAFT'; 
                    await addDoc(collection(db,"usulan_kgb"), payload); 
                }
                
                // [HEMAT] Update master hanya update Timestamp, kecuali mau update detail lain
                await setDoc(doc(db,"master_pegawai",form.nip), {
                    nip:form.nip, nama:form.nama, tempat_lahir:form.tempat_lahir, tgl_lahir:form.tgl_lahir,
                    perangkat_daerah:form.perangkat_daerah, unit_kerja:form.unit_kerja, jabatan:form.jabatan,
                    tipe_asn:form.tipe_asn, jenis_jabatan: safeForm.jenis_jabatan, pangkat: safeForm.pangkat || '', updated_at:serverTimestamp()
                }, {merge:true});
                
                if(form.jabatan) {
                    const jId = form.jabatan.replace(/[^a-zA-Z0-9]/g,'_').toUpperCase();
                    await setDoc(doc(db,"master_jabatan",jId), {kode_jabatan:jId, nama_jabatan:form.jabatan, bup:currentBup.value, updated_at:serverTimestamp()}, {merge:true});
                }
                showToast("Tersimpan!"); closeModal(); fetchTable(1);
            } catch(e){ console.error(e); showToast(e.message,'error');} finally{isSaving.value=false;}
        };

        const hapusTransaksi = async(item) => { 
            if(!item || !item.id) return showToast("ID Error", 'error');
            if (item.nomor_naskah) {
                const q = query(collection(db, "usulan_kgb"), where("nomor_naskah", "==", item.nomor_naskah));
                const snap = await getDocs(q);
                if (snap.size > 1) {
                    if(await showConfirm("Hapus?", `Ada ${snap.size} data duplikat. Hapus?`)) { 
                        await deleteDoc(doc(db, "usulan_kgb", item.id)); fetchTable(1); showToast("Terhapus.", 'success');
                    }
                } else showToast("Gagal! Nomor SK Tunggal.", 'error');
                return;
            }
            if(await showConfirm("Hapus Draft?", "Data hilang permanen.")) { 
                await deleteDoc(doc(db, "usulan_kgb", item.id)); fetchTable(1); showToast("Draft dihapus.", 'success');
            } 
        };

        // --- PREVIEW & DOWNLOAD (HEMAT VERSION) ---
        const generateDocBlob = async (item) => {
            if (!window.PizZip || !window.docxtemplater) throw new Error("Lib Error");
            const tplId = item.tipe_asn === 'PPPK' ? "PPPK" : "PNS"; 
            
            // [HEMAT] GUNAKAN CACHE TEMPLATE (Jika belum ada baru fetch)
            if (!cacheTemplates.value[tplId]) {
                const ts = await getDoc(doc(db, "config_template", tplId)); 
                if(!ts.exists()) throw new Error("Template Missing");
                cacheTemplates.value[tplId] = ts.data().url || `./templates/${ts.data().nama_file}`;
            }
            const url = cacheTemplates.value[tplId];

            // [HEMAT] GUNAKAN CACHE GLOBAL VARS (Dari initRefs)
            let gvd = cacheGlobalVars.value;
            if(!gvd.dasar_hukum) { // Fallback jika belum ter-cache
                const gv = await getDoc(doc(db, "config_template", "GLOBAL_VARS")); 
                gvd = gv.exists() ? gv.data() : {};
                cacheGlobalVars.value = gvd;
            }

            let pangkatFinal = item.pangkat || ""; 
            if (item.golongan) {
                // [HEMAT] Cari di listGolongan yg sudah di-cache di RAM
                const foundGol = listGolongan.value.find(g => g.kode === item.golongan);
                if(foundGol) pangkatFinal = foundGol.pangkat;
            }
            
            const isSetda = item.tipe_asn === 'PNS' && ((item.golongan||'').startsWith('IV') || (item.golongan||'').startsWith('4'));
            let kopT = isSetda ? gvd.kop_setda?.judul : gvd.kop_bkpsdmd?.judul;
            let kopA = isSetda ? gvd.kop_setda?.alamat : gvd.kop_bkpsdmd?.alamat;

            let targetNip = item.pejabat_baru_nip || (isSetda ? gvd.kop_setda?.pejabat_nip : gvd.kop_bkpsdmd?.pejabat_nip);
            let pjp = item.pejabat_baru_pangkat || ""; let pjj = item.pejabat_baru_nama || ""; let pjn = ""; let pjnip = ""; 

            if (targetNip) { 
                // [HEMAT] Cari di listPejabat yg sudah di-cache di RAM
                const foundPj = listPejabat.value.find(p => p.nip === targetNip);
                if(foundPj) { pjp = foundPj.pangkat; pjj = foundPj.jabatan; pjn = foundPj.nama; pjnip = foundPj.nip; }
                else {
                    // Fallback fetch jika tidak ada di list cache (jarang terjadi)
                    const ps = await getDoc(doc(db, "master_pejabat", targetNip)); 
                    if(ps.exists()){ const d = ps.data(); pjp = d.pangkat || pjp; pjj = d.jabatan || pjj; pjn = d.nama || ""; pjnip = d.nip || ""; } 
                }
            }
            
            let ttdContent = previewTab.value === 'TTE' ? "\n\n\n${ttd_pengirim}\n\n\n\n" : "\n\n\n";
            let tanggalSurat = item.tanggal_naskah ? formatTanggal(item.tanggal_naskah.toDate ? item.tanggal_naskah.toDate() : new Date(item.tanggal_naskah)) : "....................";
            
            const mapH = gvd.dasar_hukum || []; 
            const searchKey = item.nomor_inpassing ? "INPASSING" : item.dasar_hukum;
            const foundH = mapH.find(h => h.judul === searchKey);
            const textHukum = foundH ? foundH.isi : "-";

            const res = await fetch(url); const buf = await res.arrayBuffer();
            const zip = new window.PizZip(buf);
            const docRender = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: (p) => "" });

            let tmtFinal = new Date(); 
            if (item.tmt_inpassing) tmtFinal = item.tmt_inpassing.toDate ? item.tmt_inpassing.toDate() : new Date(item.tmt_inpassing);
            else if (item.dasar_tmt) tmtFinal = item.dasar_tmt.toDate ? item.dasar_tmt.toDate() : new Date(item.dasar_tmt);

            let dasarTanggalObj = new Date();
            if (item.tanggal_inpassing_manual) dasarTanggalObj = item.tanggal_inpassing_manual.toDate ? item.tanggal_inpassing_manual.toDate() : new Date(item.tanggal_inpassing_manual);
            else if (item.dasar_tanggal) dasarTanggalObj = item.dasar_tanggal.toDate ? item.dasar_tanggal.toDate() : new Date(item.dasar_tanggal);

            docRender.render({
                NAMA: item.nama||"", NIP: item.nip||"", PANGKAT: pangkatFinal, JABATAN: item.jabatan||"",
                UNIT_KERJA: item.unit_kerja, UNIT_KERJA_INDUK: item.perangkat_daerah,
                TGL_LAHIR: formatTanggal(item.tgl_lahir), GOLONGAN: item.golongan||"",
                DASAR_NOMOR: item.nomor_inpassing || item.dasar_nomor ||"-", 
                DASAR_TANGGAL: formatTanggal(dasarTanggalObj), DASAR_TMT: formatTanggal(tmtFinal), 
                DASAR_PEJABAT: item.nomor_inpassing ? "BUPATI BANGKA" : item.dasar_pejabat||"-",
                DASAR_GAJI_LAMA: formatRupiah(item.dasar_gaji_lama),
                DASAR_MK_LAMA: `${(item.dasar_mk_tahun||0).toString().padStart(2,'0')} Tahun ${(item.dasar_mk_bulan||0).toString().padStart(2,'0')} Bulan`,
                DASAR_HUKUM: textHukum, MK_BARU: `${(item.mk_baru_tahun||0).toString().padStart(2,'0')} Tahun ${(item.mk_baru_bulan||0).toString().padStart(2,'0')} Bulan`,
                GAJI_BARU: formatRupiah(item.gaji_baru), TMT_SEKARANG: formatTanggal(item.tmt_sekarang), TMT_SELANJUTNYA: formatTanggal(item.tmt_selanjutnya),
                MASA_PERJANJIAN_KERJA: item.masa_perjanjian||"-", PERPANJANGAN_PERJANJIAN_KERJA: item.perpanjangan_perjanjian||"-",
                KOP: kopT, ALAMAT_KOP: kopA, NOMOR_NASKAH: item.nomor_naskah||"....................", TANGGAL_NASKAH: tanggalSurat, 
                SIFAT: "Biasa", TTD_PENGIRIM: ttdContent, JABATAN_PEJABAT: pjj, PANGKAT_PEJABAT: pjp, 
                NAMA_PENGIRIM: pjn||"${nama_pengirim}", NIP_PENGIRIM: pjnip||"${nip_pengirim}"
            });
            return docRender.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE", compressionOptions: { level: 9 } });
        };

        const previewSK = async (item) => {
            if (!window.docx) return showToast("Library Preview Missing", 'error');
            showPreviewModal.value = true; previewLoading.value = true; currentPreviewItem.value = item; previewTab.value = 'BASAH'; 
            await nextTick(); 
            try {
                if(!currentPreviewItem.value) return;
                const blob = await generateDocBlob(currentPreviewItem.value);
                const container = document.getElementById('docx-preview-container');
                if(container) { container.innerHTML = ''; await window.docx.renderAsync(blob, container); }
            } catch (e) { showToast("Gagal Preview", 'error'); } 
            finally { previewLoading.value = false; }
        };

        const changePreviewTab = async (tabName) => { 
            previewTab.value = tabName; previewLoading.value = true; await nextTick(); 
            try {
                const blob = await generateDocBlob(currentPreviewItem.value);
                const container = document.getElementById('docx-preview-container');
                if(container) { container.innerHTML = ''; await window.docx.renderAsync(blob, container); }
            } catch(e){} finally{ previewLoading.value=false; }
        };

        const closePreview = () => { showPreviewModal.value = false; currentPreviewItem.value = null; };
        const downloadFromPreview = async () => { if(currentPreviewItem.value) cetakSK(currentPreviewItem.value); };

        const cetakSK = async (item) => {
            try {
                showToast("Menyiapkan...", 'info');
                const blob = await generateDocBlob(item);
                const prefix = previewTab.value === 'TTE' ? 'DRAFT_TTE_' : 'SK_';
                const safeName = (item.nama || 'doc').replace(/[^a-zA-Z0-9]/g,'_');
                window.saveAs(blob, `${prefix}KGB_${safeName}.docx`);
            } catch(e) { showToast("Gagal: " + e.message, 'error'); }
        };

        const nextPage = () => goToPage(currentPage.value + 1);
        const prevPage = () => goToPage(currentPage.value - 1);

        onMounted(() => {
            onAuthStateChanged(auth, (user) => { if (user) fetchTable(1); else listData.value = []; });
        });
        
        return { 
            listData, tableLoading, tableSearch, currentPage, isLastPage, itemsPerPage, filterStartDate, filterEndDate, totalPages, visiblePages,
            expandedRows, toggleRow, isExpanded,
            showModal, isEditMode, isSaving, isSearching, searchMsg, gajiMsg,
            form, listGolongan, listDasarHukum, listPejabat, filteredGolongan, currentAge, isPensiun, pensiunMsg,
            nextPage, prevPage, fetchTable, goToPage, openModal, closeModal, simpanTransaksi, hapusTransaksi, cetakSK, 
            handleNipInput, cariGajiBaru, cariGajiLama, handleGolonganChange, handleJabatanSelect, formatRupiah, formatTanggal,
            showPreviewModal, previewLoading, previewSK, closePreview, downloadFromPreview,
            previewTab, changePreviewTab, updateStatus, setTmtPensiun 
        };
    }
};