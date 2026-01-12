import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue';
import { 
    db, auth, collection, getDocs, getDoc, doc, query, orderBy, where, 
    serverTimestamp, runTransaction, updateDoc, deleteDoc, setDoc,
    limit, startAfter, getCountFromServer
} from '../firebase.js';
import { showToast, showConfirm, formatTanggal, formatRupiah, debounce } from '../utils.js';
import { store } from '../store.js';

// IMPORT VIEW
import { TplPenomoran, TplAutocompleteUsulan } from '../views/PenomoranInpassingView.js';

// --- KOMPONEN AUTOCOMPLETE ---
const AutocompleteUsulan = {
    props: ['options', 'modelValue', 'disabled'],
    emits: ['update:modelValue', 'change'],
    template: TplAutocompleteUsulan,
    setup(props, { emit }) {
        const isOpen = ref(false);
        const search = ref('');
        const displayValue = ref('');

        const filteredOptions = computed(() => {
            if (!search.value) return props.options.slice(0, 50);
            const term = search.value.toLowerCase();
            return props.options.filter(item => 
                (item.nama_snapshot||'').toLowerCase().includes(term) || 
                (item.nip||'').includes(term)
            ).slice(0, 50);
        });

        const handleInput = (e) => { search.value = e.target.value; displayValue.value = e.target.value; isOpen.value = true; };
        const selectItem = (item) => { displayValue.value = `${item.nama_snapshot}`; emit('update:modelValue', item.id); emit('change'); isOpen.value = false; search.value = ''; };
        const delayClose = () => { setTimeout(() => { isOpen.value = false; }, 200); };

        watch(() => props.modelValue, (newVal) => {
            if (newVal && props.options.length > 0) {
                const found = props.options.find(o => o.id === newVal);
                if (found) displayValue.value = `${found.nama_snapshot}`;
            } else { displayValue.value = ''; }
        }, { immediate: true });

        watch(() => props.options, (newOpts) => {
            if (props.modelValue && newOpts.length > 0) {
                const found = newOpts.find(o => o.id === props.modelValue);
                if (found) displayValue.value = `${found.nama_snapshot}`;
            }
        });

        return { isOpen, search, displayValue, filteredOptions, handleInput, selectItem, delayClose };
    }
};

// --- MAIN COMPONENT ---
export default {
    components: { AutocompleteUsulan },
    template: TplPenomoran,
    setup() {
        const listData = ref([]);
        const listUsulan = ref([]);
        const loading = ref(true);
        const showModal = ref(false);
        const isSaving = ref(false);
        
        // PAGINATION
        const currentPage = ref(1);
        const itemsPerPage = ref(10);
        const pageStack = ref([]);
        const totalItems = ref(0);
        const filterStartDate = ref('');
        const filterEndDate = ref('');
        const tableSearch = ref('');

        // EDIT & PREVIEW
        const isEditMode = ref(false);
        const editId = ref(null);
        const oldUsulanId = ref(null);
        const showPreviewModal = ref(false);
        const previewLoading = ref(false);
        const currentPreviewItem = ref(null);
        const previewTab = ref('BASAH');

        // CHECK NUMBER
        const customNumberStatus = ref(null);
        const customNumberMsg = ref('');

        // GAP DETECTOR STATE
        const showGapModal = ref(false);
        const gapLoading = ref(false);
        const emptyNumbers = ref([]);
        const maxCounterVal = ref(0);
        const gapForm = reactive({
            tahun: new Date().getFullYear(),
        });

        const getTodayISO = () => {
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // HELPER: TMT Default (Tanggal 1, 2 Bulan kedepan)
        const getNextTwoMonthsISO = () => {
            const d = new Date();
            // Parameter: (Tahun, Bulan + 2, Tanggal 1)
            // Javascript otomatis menangani pergantian tahun.
            // Contoh: Bulan 11 (Des) + 2 = Bulan 1 (Feb tahun depan)
            const target = new Date(d.getFullYear(), d.getMonth() + 2, 1);
            
            const year = target.getFullYear();
            const month = String(target.getMonth() + 1).padStart(2, '0');
            const day = String(target.getDate()).padStart(2, '0'); // Selalu '01'
            return `${year}-${month}-${day}`;
        };

        // FORM STATE
        const form = reactive({
            usulan_id: '', nama_pegawai: '', nip: '', jenis_jabatan: 'Fungsional',
            golongan: '', tahun: new Date().getFullYear(), nomor_custom: '', no_urut: 0,
            kategori: 'INPASSING',
            // Atribut Manual Inpassing
            mk_inpassing_tahun: 0,
            mk_inpassing_bulan: 0,
            gaji_lama_inpassing: 0,
            mk_berikutnya_tahun: 0,
            mk_berikutnya_bulan: 0,
            // [BARU] Keterangan
            keterangan_inpassing: '',
            tanggal_inpassing_manual: getTodayISO(),
            tmt_inpassing: getNextTwoMonthsISO()
        });

        const yearOptions = computed(() => {
            const current = new Date().getFullYear();
            return Array.from({ length: 6 }, (_, i) => current - 1 + i);
        });

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

        const mapDoc = (d) => {
            const data = d.data();
            data.id = d.id;
            if(data.created_at?.toDate) data.created_at_formatted = formatTanggal(data.created_at.toDate());
            return data;
        };

        // FETCH DATA LOG (FILTER: INPASSING) + STABLE SORT
        const fetchData = async (pageTarget) => {
            loading.value = true;
            try {
                const collRef = collection(db, "nomor_surat");
                const limitVal = parseInt(itemsPerPage.value) || 10;
                let q;

                const constraints = [];
                constraints.push(where("kategori", "==", "INPASSING")); // Filter Wajib

                if (filterStartDate.value) constraints.push(where("created_at", ">=", new Date(filterStartDate.value)));
                if (filterEndDate.value) {
                    const end = new Date(filterEndDate.value); end.setHours(23, 59, 59);
                    constraints.push(where("created_at", "<=", end));
                }

                if (pageTarget === 1 || pageTarget === 'first') {
                    const snapshotCount = await getCountFromServer(query(collRef, ...constraints));
                    totalItems.value = snapshotCount.data().count;
                    pageStack.value = [];
                    currentPage.value = 1;
                }

                if (tableSearch.value.trim()) {
                    // MODE SEARCH
                    const qAll = query(
                        collRef, ...constraints, 
                        orderBy("created_at", "desc"), orderBy("__name__", "desc"),
                        limit(1000)
                    );
                    const snap = await getDocs(qAll);
                    const term = tableSearch.value.toLowerCase();
                    listData.value = snap.docs.map(mapDoc).filter(d => (d.nomor_lengkap||'').toLowerCase().includes(term) || (d.nama_pegawai||'').toLowerCase().includes(term));
                } else {
                    // MODE PAGINATION (STABLE SORT)
                    let qBase = query(
                        collRef, ...constraints, 
                        orderBy("created_at", "desc"), orderBy("__name__", "desc"),
                        limit(limitVal)
                    );

                    if (typeof pageTarget === 'number') {
                        if (pageTarget === 1) {
                            q = qBase;
                            currentPage.value = 1; pageStack.value = [];
                        } else {
                            if (pageTarget > currentPage.value) {
                                const lastDoc = pageStack.value[pageStack.value.length - 1];
                                if (lastDoc) {
                                    q = query(
                                        collRef, ...constraints, 
                                        orderBy("created_at", "desc"), orderBy("__name__", "desc"),
                                        startAfter(lastDoc), limit(limitVal)
                                    );
                                    currentPage.value = pageTarget;
                                } else { fetchData(1); return; }
                            } else if (pageTarget < currentPage.value) {
                                const cursorIndex = pageTarget - 2;
                                if (cursorIndex < 0) { 
                                    q = qBase; pageStack.value = []; 
                                }
                                else {
                                    const cursor = pageStack.value[cursorIndex];
                                    q = query(
                                        collRef, ...constraints, 
                                        orderBy("created_at", "desc"), orderBy("__name__", "desc"),
                                        startAfter(cursor), limit(limitVal)
                                    );
                                    pageStack.value = pageStack.value.slice(0, cursorIndex + 1);
                                }
                                currentPage.value = pageTarget;
                            } else { fetchData(1); return; }
                        }
                    } else {
                        q = qBase;
                        currentPage.value = 1; pageStack.value = [];
                    }
                    const snap = await getDocs(q);
                    listData.value = snap.docs.map(mapDoc);
                    if (snap.docs.length > 0) {
                        const lastVisible = snap.docs[snap.docs.length - 1];
                        if (currentPage.value === 1) pageStack.value = [lastVisible];
                        else if (pageStack.value.length < currentPage.value) pageStack.value.push(lastVisible);
                        else pageStack.value[currentPage.value - 1] = lastVisible;
                    }
                }
            } catch (e) { console.error(e); } finally { loading.value = false; }
        };

        const goToPage = (p) => { if (p !== currentPage.value) fetchData(p); };
        watch(tableSearch, debounce(() => fetchData(1), 800));

        // FETCH DATA PEGAWAI (DARI USULAN_KGB)
        const fetchUsulanList = async () => {
            try {
                let constraints = [orderBy("created_at", "desc")];
                if (!store.isAdmin && auth.currentUser) constraints.push(where("created_by", "==", auth.currentUser.uid));
                
                // Gunakan usulan_kgb
                const q = query(collection(db, "usulan_kgb"), ...constraints);
                const snap = await getDocs(q);
                
                listUsulan.value = snap.docs.map(d => ({ 
                    id: d.id, 
                    ...d.data()
                })).filter(u => !u.nomor_inpassing || (isEditMode.value && u.id === form.usulan_id)); 
            } catch (e) { console.error(e); }
        };

        const handleUsulanChange = () => {
            const selected = listUsulan.value.find(u => u.id === form.usulan_id);
            if (selected) {
                // 1. Auto Fill Identitas
                // Cek nama_snapshot dulu, kalau kosong ambil nama biasa
                form.nama_pegawai = selected.nama_snapshot || selected.nama || '';
                form.nip = selected.nip || '';

                // 2. Auto Fill Klasifikasi (Hanya jika bukan Mode Edit)
                if(!isEditMode.value) {
                    
                    // a. Set Golongan
                    form.golongan = selected.golongan || '';
                    const type = selected.jenis_jabatan.toLowerCase();
                    form.jenis_jabatan = type.includes('struktural') || type.includes('pelaksana') ? 'Struktural' : 'Fungsional';
                    form.mk_berikutnya_tahun = 0;
                    form.mk_berikutnya_bulan = 0;

                    form.tanggal_inpassing_manual = selected.tanggal_inpassing_manual ? selected.tanggal_inpassing_manual.toDate().toISOString().split('T')[0] : getTodayISO();
                    // Trigger ulang pengecekan nomor (karena jenis jabatan berubah)
                    if(form.nomor_custom) checkCustomNumber(form.nomor_custom);
                }
            }
        };

        const checkCustomNumber = debounce(async (nomor) => {
            if (!nomor) { customNumberStatus.value = null; customNumberMsg.value = ''; return; }
            customNumberStatus.value = 'checking'; customNumberMsg.value = 'Mengecek...';
            try {
                const q = query(collection(db, "nomor_surat"), 
                    where("nomor_lengkap", "==", nomor),
                    where("kategori", "==", "INPASSING")
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    if (isEditMode.value && snap.docs[0].id === editId.value) { customNumberStatus.value = 'available'; customNumberMsg.value = 'Milik sendiri.'; }
                    else { const owner = snap.docs[0].data(); customNumberStatus.value = 'taken'; customNumberMsg.value = `Dipakai: ${owner.nama_pegawai}`; }
                } else {
                    if (!nomor.includes('800')) { customNumberStatus.value = 'warning'; customNumberMsg.value = 'Format mungkin tidak standar.'; } 
                    else { customNumberStatus.value = 'available'; customNumberMsg.value = 'Tersedia.'; }
                }
            } catch (e) { customNumberStatus.value = 'invalid'; }
        }, 800);

        watch(() => form.nomor_custom, (newVal) => checkCustomNumber(newVal));

        // --- GAP DETECTOR (UNIFIED COUNTER) ---
        const checkGaps = async () => {
            gapLoading.value = true;
            emptyNumbers.value = [];
            maxCounterVal.value = 0;
            try {
                // Unified Counter: TAHUN_INPASSING
                const counterId = `${gapForm.tahun}_INPASSING`;
                const snapCount = await getDoc(doc(db, "counters_nomor", counterId));
                
                if (!snapCount.exists()) { gapLoading.value = false; return; }
                const maxVal = snapCount.data().count;
                maxCounterVal.value = maxVal;
                if (maxVal === 0) { gapLoading.value = false; return; }

                const q = query(collection(db, "nomor_surat"),
                    where("tahun", "==", gapForm.tahun),
                    where("kategori", "==", "INPASSING")
                );
                
                const snapUsed = await getDocs(q);
                const usedSet = new Set();
                snapUsed.docs.forEach(d => usedSet.add(Number(d.data().no_urut)));

                const gaps = [];
                for(let i=1; i<=maxVal; i++) { if(!usedSet.has(i)) gaps.push(i); }
                emptyNumbers.value = gaps;
            } catch (e) { console.error(e); showToast("Gagal cek nomor kosong", 'error'); } 
            finally { gapLoading.value = false; }
        };

        const useGapNumber = (no) => {
            showGapModal.value = false;
            openModal();
            form.tahun = gapForm.tahun;
            form.no_urut = no;
            
            const noUrutStr = String(no).padStart(4, '0');
            const kodeKlasifikasi = "800.1.11.13"; 
            form.nomor_custom = `B-${kodeKlasifikasi}/${noUrutStr}/IMPS/BKPSDMD/${form.tahun}`;
            
            showToast(`Menggunakan slot kosong #${no}`, 'info');
            checkCustomNumber(form.nomor_custom);
        };

        // --- PREVIEW NOMOR (UNIFIED COUNTER) ---
        const previewNomor = async () => {
            if (!form.usulan_id) return showToast("Pilih usulan dulu!", 'warning');
            try {
                const counterId = `${form.tahun}_INPASSING`;
                const counterRef = doc(db, "counters_nomor", counterId);
                const snap = await getDoc(counterRef);
                let nextCount = 1;
                if (snap.exists()) { nextCount = snap.data().count + 1; }
                
                const noUrutStr = String(nextCount).padStart(4, '0'); 
                const kodeKlasifikasi = "800.1.11.13"; 
                
                form.nomor_custom = `B-${kodeKlasifikasi}/${noUrutStr}/IMPS/BKPSDMD/${form.tahun}`;
                form.no_urut = nextCount; 
                
                checkCustomNumber(form.nomor_custom);
            } catch (e) { showToast("Gagal hitung: " + e.message, 'error'); }
        };

        // --- SIMPAN FINAL ---
        const simpanFinal = async () => {
            if (!form.nomor_custom) return showToast("Nomor belum diisi!", 'warning');
            if (customNumberStatus.value === 'taken') return showToast("Nomor terpakai!", 'error');
            isSaving.value = true;
            try {
                const parts = form.nomor_custom.split('/');
                let currentUrut = 0;
                if(parts.length > 2) {
                     const foundPart = parts.find(p => p.length === 4 && !isNaN(p));
                     if(foundPart) currentUrut = parseInt(foundPart);
                     else currentUrut = form.no_urut || 0;
                } else { currentUrut = form.no_urut || 0; }

                // Double Check (Global)
                if (!isEditMode.value || (isEditMode.value && currentUrut !== form.no_urut)) {
                    const qCek = query(collection(db, "nomor_surat"),
                        where("no_urut", "==", currentUrut),
                        where("kategori", "==", "INPASSING"),
                        where("tahun", "==", form.tahun)
                    );
                    const snapCek = await getDocs(qCek);
                    if (!snapCek.empty) {
                        if (!isEditMode.value || (isEditMode.value && snapCek.docs[0].id !== editId.value)) {
                            throw new Error(`Nomor Urut ${currentUrut} sudah digunakan!`);
                        }
                    }
                }

                // [UPDATE DATA] Data Utama ke Collection usulan_kgb
                const dataUpdateUtama = {
                    nomor_inpassing: form.nomor_custom, 
                    tgl_inpassing: serverTimestamp(),
                    
                    // --- SIMPAN SEBAGAI DATA BARU (TIDAK MENIMPA GAJI LAMA) ---
                    inpassing_golongan: form.golongan, 
                    inpassing_gaji: form.gaji_lama_inpassing, 
                    
                    // --- ATRIBUT MANUAL ---
                    mk_inpassing_tahun: form.mk_inpassing_tahun,
                    mk_inpassing_bulan: form.mk_inpassing_bulan,
                    gaji_lama_inpassing: form.gaji_lama_inpassing,
                    mk_berikutnya_tahun: form.mk_berikutnya_tahun,
                    mk_berikutnya_bulan: form.mk_berikutnya_bulan,
                    
                    // [PENTING] Simpan Tanggal Manual & TMT
                    tanggal_inpassing_manual: form.tanggal_inpassing_manual ? new Date(form.tanggal_inpassing_manual) : null,
                    tmt_inpassing: form.tmt_inpassing ? new Date(form.tmt_inpassing) : null,
                    
                    // [BARU] Simpan Keterangan
                    keterangan_inpassing: form.keterangan_inpassing || ''
                };

                const dataLog = {
                    usulan_id: form.usulan_id, 
                    nama_pegawai: form.nama_pegawai, 
                    nip: form.nip,
                    jenis_jabatan: form.jenis_jabatan, 
                    kategori: 'INPASSING', 
                    tahun: form.tahun, 
                    golongan: form.golongan, 
                    no_urut: currentUrut, 
                    nomor_lengkap: form.nomor_custom,
                    ...dataUpdateUtama
                };

                if (isEditMode.value) {
                    await runTransaction(db, async (transaction) => {
                        const logRef = doc(db, "nomor_surat", editId.value);
                        transaction.update(logRef, dataLog);
                        
                        // [PERBAIKAN KRITIS] Bersihkan data pemilik lama secara MENYELURUH
                        if (oldUsulanId.value && oldUsulanId.value !== form.usulan_id) {
                            transaction.update(doc(db, "usulan_kgb", oldUsulanId.value), { 
                                nomor_inpassing: null, 
                                tgl_inpassing: null, 
                                inpassing_gaji: null, 
                                inpassing_golongan: null,
                                
                                // Bersihkan field baru juga:
                                keterangan_inpassing: null,
                                mk_inpassing_tahun: null, mk_inpassing_bulan: null,
                                mk_berikutnya_tahun: null, mk_berikutnya_bulan: null,
                                gaji_lama_inpassing: null,
                                tanggal_inpassing_manual: null,
                                tmt_inpassing: null
                            });
                        }
                        transaction.update(doc(db, "usulan_kgb", form.usulan_id), dataUpdateUtama);
                    });
                    showToast("Update berhasil!", 'success');
                } else {
                    const counterId = `${form.tahun}_INPASSING`;
                    const counterRef = doc(db, "counters_nomor", counterId);
                    const snapCount = await getDoc(counterRef);
                    let dbCount = 0;
                    if (snapCount.exists()) dbCount = snapCount.data().count;
                    
                    if (currentUrut > dbCount) { 
                        await setDoc(counterRef, { count: currentUrut }, { merge: true }); 
                    }

                    dataLog.created_at = serverTimestamp();
                    await setDoc(doc(collection(db, "nomor_surat")), dataLog);
                    await updateDoc(doc(db, "usulan_kgb", form.usulan_id), dataUpdateUtama);
                    
                    showToast("Nomor disimpan!", 'success');
                }
                closeModal(); fetchData(1);
            } catch (e) { console.error(e); showToast("Gagal: " + e.message, 'error'); } finally { isSaving.value = false; }
        };

        const editNomor = async (item) => {
            isEditMode.value = true; editId.value = item.id; oldUsulanId.value = item.usulan_id;
            
            // 1. Load Tanggal Manual (SK)
            // Default fallback: Hari Ini (Karena SK biasanya tanggal hari ini)
            let tglManual = getTodayISO(); 
            if(item.tanggal_inpassing_manual && item.tanggal_inpassing_manual.toDate) {
                 tglManual = item.tanggal_inpassing_manual.toDate().toISOString().split('T')[0];
            }

            // 2. Load TMT Inpassing
            // Default fallback: 2 Bulan kedepan (Sesuai aturan baru)
            let tmtVal = getNextTwoMonthsISO(); 
            if(item.tmt_inpassing && item.tmt_inpassing.toDate) {
                 tmtVal = item.tmt_inpassing.toDate().toISOString().split('T')[0];
            }

            Object.assign(form, { 
                ...item, 
                nomor_custom: item.nomor_lengkap,
                mk_inpassing_tahun: item.mk_inpassing_tahun || 0,
                mk_inpassing_bulan: item.mk_inpassing_bulan || 0,
                gaji_lama_inpassing: item.gaji_lama_inpassing || 0,
                mk_berikutnya_tahun: item.mk_berikutnya_tahun || 0,
                mk_berikutnya_bulan: item.mk_berikutnya_bulan || 0,
                keterangan_inpassing: item.keterangan_inpassing || '',
                
                // Assign tanggal-tanggal yang sudah di-load di atas
                tanggal_inpassing_manual: tglManual,
                tmt_inpassing: tmtVal 
            });
            
            customNumberStatus.value = null; customNumberMsg.value = '';
            await fetchUsulanList(); showModal.value = true;
        };

        const hapusNomor = async (item) => {
            // [PERBAIKAN 1] Ubah pesan konfirmasi agar sesuai fakta
            // Jangan janjikan counter mundur, tapi jelaskan akan jadi Gap.
            if (await showConfirm('Batalkan Nomor Inpassing?', 'Nomor ini akan menjadi KOSONG (Gap) dan bisa digunakan kembali melalui menu "Cek No. Kosong".')) {
                try {
                    await runTransaction(db, async (transaction) => {
                        // 1. Hapus Log Nomor
                        transaction.delete(doc(db, "nomor_surat", item.id));
                        
                        // 2. Reset Status di Data Pegawai (Bersihkan SEMUA jejak Inpassing)
                        if(item.usulan_id) {
                            const usulanRef = doc(db, "usulan_kgb", item.usulan_id);
                            transaction.update(usulanRef, { 
                                nomor_inpassing: null, 
                                tgl_inpassing: null,
                                inpassing_gaji: null, 
                                inpassing_golongan: null,
                                keterangan_inpassing: null,
                                mk_inpassing_bulan: null,
                                mk_inpassing_tahun: null,
                                mk_berikutnya_bulan: null,
                                mk_berikutnya_tahun: null,
                                gaji_lama_inpassing: null,
                                
                                // [PENTING] Hapus juga tanggal manual & field pendukung lain
                                tanggal_inpassing_manual: null,
                                tmt_inpassing: null
                            });
                        }
                    });
                    
                    fetchData(1); 
                    showToast("Nomor Inpassing dibatalkan (Gap Created).");
                } catch (e) { 
                    console.error(e); 
                    showToast(e.message, 'error'); 
                }
            }
        };

        const generateDocBlob = async (usulanId) => {
            if (!window.PizZip || !window.docxtemplater) throw new Error("Library Error");
            
            // 1. Ambil Data Pegawai
            const snap = await getDoc(doc(db, "usulan_kgb", usulanId));
            if(!snap.exists()) throw new Error("Data Usulan tidak ditemukan!");
            const item = snap.data();

            // 2. Load Pangkat Otomatis
            let pangkatFinal = item.pangkat || ""; 
            if (!pangkatFinal && item.golongan) {
                try {
                    const qPkt = query(collection(db, "master_golongan"), where("kode", "==", item.golongan));
                    const snapPkt = await getDocs(qPkt);
                    if (!snapPkt.empty) pangkatFinal = snapPkt.docs[0].data().pangkat;
                } catch (e) { console.error("Gagal load pangkat", e); }
            }

            // 3. Load Template
            // Pastikan ID ini sesuai dengan di Firestore ('INPASSING' atau 'inpassing_pns')
            const ts = await getDoc(doc(db, "config_template", "IMPASSING_PNS")); 
            let url = "";
            if (ts.exists()) {
                url = ts.data().url || `./templates/${ts.data().nama_file}`;
            } else {
                url = "./templates/inpassing_pns.docx"; // Fallback lokal
            }

            // 4. Load Global Vars (Kop Surat & Pejabat)
            const gv = await getDoc(doc(db, "config_template", "GLOBAL_VARS")); 
            const gvd = gv.exists() ? gv.data() : {};
            
            const golKode = item.golongan || "";
            const isSetda = (golKode.startsWith('IV') || golKode.startsWith('4')); 
            let kopT=isSetda ? gvd.kop_setda?.judul : gvd.kop_bkpsdmd?.judul;
            let kopA=isSetda ? gvd.kop_setda?.alamat : gvd.kop_bkpsdmd?.alamat;
            let targetNip = item.pejabat_baru_nip || (isSetda ? gvd.kop_setda?.pejabat_nip : gvd.kop_bkpsdmd?.pejabat_nip);
            
            let pjp="", pjj="BUPATI BANGKA", pjn="", pjnip="";
            if (targetNip) { 
                const ps = await getDoc(doc(db, "master_pejabat", targetNip)); 
                if(ps.exists()){ const d = ps.data(); pjp=d.pangkat||pjp; pjj=d.jabatan||pjj; pjn=d.nama||""; pjnip=d.nip||""; } 
            }

            // 5. Format Helper
            let ttdContent = previewTab.value === 'TTE' ? "\n\n\n${ttd_pengirim}\n\n\n" : "\n\n\n\n";
            // Format Tanggal Surat
            let tanggalSurat = "";

            // 1. Prioritas Utama: Cek Tanggal Manual (Inputan User)
            if (item.tanggal_inpassing_manual) {
                // Cek apakah formatnya Timestamp Firestore atau Date biasa
                const tglObj = item.tanggal_inpassing_manual.toDate 
                    ? item.tanggal_inpassing_manual.toDate() 
                    : new Date(item.tanggal_inpassing_manual);
                
                tanggalSurat = formatTanggal(tglObj);
            } 
            // 2. Jika Manual Kosong & Mode TTE -> Pakai Placeholder
            else if (previewTab.value === 'TTE') {
                tanggalSurat = "{TANGGAL_BUAT}"; // Jangan pakai ${}, pakai {} sesuai delimiter
            } 
            // 3. Default: Pakai Tanggal Naskah atau Hari Ini
            else {
                const tglObj = item.tanggal_naskah ? item.tanggal_naskah.toDate() : new Date();
                tanggalSurat = formatTanggal(tglObj);
            }
            const formatRp = (val) => "Rp " + (Number(val)||0).toLocaleString('id-ID');
            const twoDigit = (num) => String(num).padStart(2, '0');
            let tmtDateObj = new Date(); // Default: Hari ini (jika kosong)
            
            if (item.tmt_inpassing) {
                // Cek apakah format Firestore (Timestamp) atau String biasa
                tmtDateObj = item.tmt_inpassing.toDate 
                    ? item.tmt_inpassing.toDate() 
                    : new Date(item.tmt_inpassing);
            }
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Gagal memuat file template: ${url}`);
                const buf = await res.arrayBuffer();
                
                const zip = new window.PizZip(buf);
                
                // [PERBAIKAN PENTING] 
                // Gunakan delimiters '{' dan '}' sesuai template Word Anda
                const docRender = new window.docxtemplater(zip, { 
                    paragraphLoop: true, 
                    linebreaks: true,
                    delimiters: { start: '{', end: '}' }, // UBAH KE KURUNG TUNGGAL
                    nullGetter: (p) => "-" // Jika data kosong, isi "-"
                });

                // 6. Mapping Data (Sesuaikan dengan Template Anda)
                docRender.render({
                    // Identitas
                    NAMA: item.nama_snapshot || item.nama || "",
                    NIP: item.nip || "",
                    TEMPAT_LAHIR: item.tempat_lahir || "", // Tambahan
                    TGL_LAHIR: formatTanggal(item.tgl_lahir), // Tambahan
                    
                    // Pangkat & Jabatan
                    PANGKAT: pangkatFinal,
                    GOLONGAN: item.golongan || "-",
                    JABATAN: item.jabatan || "-",
                    UNIT_KERJA: item.unit_kerja,
                    
                    // Data Inpassing
                    DASAR_TMT: formatTanggal(tmtDateObj), // Mapping ke DASAR_TMT
                    MK_INPASSING_TAHUN: twoDigit(item.mk_inpassing_tahun || 0),
                    MK_INPASSING_BULAN: twoDigit(item.mk_inpassing_bulan || 0),
                    
                    // Gaji (Perhatikan mapping di Template Word Anda)
                    // Di template tertulis: Gaji Pokok Lama {GAJI_LAMA_INPASSING}
                    GAJI_LAMA_INPASSING: formatRp(item.gaji_lama_inpassing), 
                    
                    // Di template tertulis: Gaji Pokok Baru {DASAR_GAJI_LAMA} (Mungkin salah nama variabel di Word?)
                    // Asumsi: Dasar Gaji Lama di Word maksudnya adalah Gaji Hasil Inpassing
                    DASAR_GAJI_LAMA: formatRp(item.dasar_gaji_lama), 

                    // Kenaikan Berkala Berikutnya
                    MKBT: twoDigit(item.mk_berikutnya_tahun || 0),
                    MKBB: twoDigit(item.mk_berikutnya_bulan || 0),
                    
                    // Keterangan
                    KETERANGAN: item.keterangan_inpassing || "-",

                    // Surat & TTD
                    KOP: kopT, 
                    ALAMAT_KOP: kopA, 
                    NOMOR_NASKAH: item.nomor_inpassing || "....................", 
                    
                    // Mapping tanggal surat ke variabel {TANGGAL_BUAT} sesuai template
                    TANGGAL_BUAT: tanggalSurat, 
                    
                    TTD_PENGIRIM: ttdContent, 
                    JABATAN_PEJABAT: pjj, 
                    PANGKAT_PEJABAT: pjp, 
                    NAMA_PENGIRIM: pjn || "${nama_pengirim}", 
                    NIP_PENGIRIM: pjnip || "${nip_pengirim}",
                    MKGB : 'Masa Kerja Golongan untuk Kenaikan Gaji Berkala Berikutnya',
                    
                });
                
                return docRender.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE", compressionOptions: { level: 7 } });
            
            } catch (err) {
                console.error("Template Error:", err);
                throw new Error("Gagal render template: " + err.message);
            }
        };

        const previewSK = async (logItem) => {
            if (!window.docx) return showToast("Library Error", 'error');
            showPreviewModal.value = true; previewLoading.value = true; currentPreviewItem.value = logItem; previewTab.value = 'BASAH'; 
            await nextTick(); await renderCurrentPreview();
        };
        const changePreviewTab = async (tabName) => { previewTab.value = tabName; previewLoading.value = true; await nextTick(); await renderCurrentPreview(); };
        const renderCurrentPreview = async () => {
            try {
                if(!currentPreviewItem.value) return;
                const blob = await generateDocBlob(currentPreviewItem.value.usulan_id);
                const container = document.getElementById('docx-preview-container');
                if(container) { container.innerHTML = ''; await window.docx.renderAsync(blob, container); }
            } catch (e) { showToast("Gagal Preview", 'error'); } finally { previewLoading.value = false; }
        };
        const downloadFromPreview = async () => { if(currentPreviewItem.value) await cetakSK(currentPreviewItem.value); };
        const closePreview = () => { showPreviewModal.value = false; currentPreviewItem.value = null; };
        const cetakSK = async (logItem) => {
            try {
                showToast("Menyiapkan download...", 'info');
                const blob = await generateDocBlob(logItem.usulan_id);
                const prefix = previewTab.value === 'TTE' ? 'DRAFT_TTE_INPASSING' : 'SK_INPASSING_';
                window.saveAs(blob, `${prefix}${logItem.nama_pegawai.replace(/\W/g,'')}.docx`);
            } catch(e) { showToast("Gagal: " + e.message, 'error'); }
        };

        const openModal = async () => {
            isEditMode.value = false; editId.value = null; oldUsulanId.value = null;
            Object.assign(form, { 
                usulan_id:'', nama_pegawai:'', nip:'', jenis_jabatan:'Fungsional', golongan:'', 
                tahun: new Date().getFullYear(), nomor_custom:'', no_urut: 0, kategori:'INPASSING',
                mk_inpassing_tahun: 0, mk_inpassing_bulan: 0, gaji_lama_inpassing: 0, mk_berikutnya_tahun: 0, mk_berikutnya_bulan: 0,
                keterangan_inpassing: '',
                tanggal_inpassing_manual: getTodayISO(),
                tmt_inpassing: getNextTwoMonthsISO()
            });
            customNumberStatus.value = null; customNumberMsg.value = '';
            await fetchUsulanList(); showModal.value = true;
        };
        const closeModal = () => showModal.value = false;

        onMounted(() => fetchData(1));

        return {
            listData, listUsulan, loading, showModal, isSaving, form, isEditMode, yearOptions, previewTab,
            fetchUsulanList, handleUsulanChange, previewNomor, simpanFinal, hapusNomor, editNomor, openModal, closeModal,
            previewSK, cetakSK, downloadFromPreview, closePreview, changePreviewTab, showPreviewModal, previewLoading,
            customNumberStatus, customNumberMsg,
            currentPage, totalPages, visiblePages, itemsPerPage, totalItems, goToPage, fetchData,
            filterStartDate, filterEndDate, tableSearch,
            // GAP EXPORTS
            showGapModal, gapLoading, emptyNumbers, maxCounterVal, gapForm, checkGaps, useGapNumber
        };
    }
};