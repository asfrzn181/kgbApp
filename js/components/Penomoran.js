import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue';
import { 
    db, auth, collection, getDocs, getDoc, doc, query, orderBy, where, 
    serverTimestamp, runTransaction, updateDoc, deleteDoc, setDoc,
    limit, startAfter, getCountFromServer
} from '../firebase.js';
import { showToast, showConfirm, formatTanggal, formatRupiah, debounce } from '../utils.js';
import { store } from '../store.js';

// IMPORT VIEW
import { TplPenomoran, TplAutocompleteUsulan } from '../views/PenomoranView.js';

// --- KOMPONEN AUTOCOMPLETE MANUAL (TETAP) ---
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
        
        // CACHE (HEMAT READ)
        const cacheGlobalVars = ref({});
        const cacheTemplates = ref({});

        // PAGINATION & FILTER STATE
        const currentPage = ref(1);
        const itemsPerPage = ref(10);
        const pageStack = ref([]);
        const totalItems = ref(0);
        const filterStartDate = ref('');
        const filterEndDate = ref('');
        const tableSearch = ref('');

        const isEditMode = ref(false);
        const editId = ref(null);
        const oldUsulanId = ref(null);

        const showPreviewModal = ref(false);
        const previewLoading = ref(false);
        const currentPreviewItem = ref(null);
        const previewTab = ref('TTE');

        const customNumberStatus = ref(null);
        const customNumberMsg = ref('');

        const showGapModal = ref(false);
        const gapLoading = ref(false);
        const emptyNumbers = ref([]);
        const maxCounterVal = ref(0);
        const gapForm = reactive({
            tahun: new Date().getFullYear(),
            jenis_jabatan: 'Fungsional'
        });

        const form = reactive({
            usulan_id: '', nama_pegawai: '', nip: '', jenis_jabatan: 'Fungsional',
            golongan: '', tahun: new Date().getFullYear(), nomor_custom: '', no_urut: 0,
            kategori: 'KGB' 
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

        // --- FETCH DATA LOG (OPTIMIZED SEARCH) ---
        const fetchData = async (pageTarget) => {
            loading.value = true;
            try {
                const collRef = collection(db, "nomor_surat");
                const limitVal = parseInt(itemsPerPage.value) || 10;
                let q;

                // [FILTER INPASSING] Kita asumsikan kategori selain 'INPASSING' adalah reguler.
                // Karena operator != butuh index, kita pakai 'where("kategori", "==", "KGB")' jika data lama sudah dimigrasi.
                // Jika data lama kategori-nya null/undefined, query ini MUNGKIN melewatkannya.
                // SOLUSI AMAN: Tarik data, filter client side (seperti sebelumnya), TAPI batasi limit pencarian.
                
                // Note: Untuk search NIP/Nama, kita bisa langsung tembak tanpa filter kategori dulu,
                // nanti hasil search baru kita filter JS. Ini jauh lebih hemat daripada tarik 1000 data.

                const constraints = [];
                if (filterStartDate.value) constraints.push(where("created_at", ">=", new Date(filterStartDate.value)));
                if (filterEndDate.value) {
                    const end = new Date(filterEndDate.value); end.setHours(23, 59, 59); 
                    constraints.push(where("created_at", "<=", end));
                }

                if (tableSearch.value.trim()) {
                    // --- MODE SEARCH SERVER-SIDE ---
                    const term = tableSearch.value.trim();
                    const isNumber = /^\d+$/.test(term); 
                    let searchConstraints = []; // Tanpa constraint tanggal/kategori dulu (kompleksitas index)

                    if (isNumber) { // Cari NIP
                        searchConstraints.push(orderBy("nip"));
                        searchConstraints.push(where("nip", ">=", term));
                        searchConstraints.push(where("nip", "<=", term + "\uf8ff"));
                    } else { // Cari Nama
                        const termNama = term.toUpperCase(); // Asumsi nama di DB Uppercase
                        searchConstraints.push(orderBy("nama_pegawai"));
                        searchConstraints.push(where("nama_pegawai", ">=", termNama));
                        searchConstraints.push(where("nama_pegawai", "<=", termNama + "\uf8ff"));
                    }

                    // Limit 50 cukup
                    const qAll = query(collRef, ...searchConstraints, limit(50));
                    const snap = await getDocs(qAll);
                    
                    listData.value = snap.docs.map(mapDoc)
                        .filter(d => d.kategori !== 'INPASSING'); // Tetap filter inpassing di client
                    
                    totalItems.value = listData.value.length;
                } else {
                    // --- MODE PAGINATION BUFFER ---
                    // Ambil buffer (3x limit) untuk kompensasi data Inpassing yang terbuang
                    const bufferLimit = limitVal * 3;
                    
                    let qBase = query(collRef, ...constraints, orderBy("created_at", "desc"), limit(bufferLimit));

                    if (pageTarget === 1) {
                        q = qBase; currentPage.value = 1; pageStack.value = [];
                    } else {
                        if (pageTarget > currentPage.value) {
                            const lastDoc = pageStack.value[pageStack.value.length - 1];
                            if(lastDoc) {
                                q = query(collRef, ...constraints, orderBy("created_at", "desc"), startAfter(lastDoc), limit(bufferLimit));
                                currentPage.value = pageTarget;
                            } else { fetchData(1); return; }
                        } 
                        else if (pageTarget < currentPage.value) {
                            const cursorIndex = pageTarget - 2;
                            if (cursorIndex < 0) {
                                q = qBase; pageStack.value = [];
                            } else {
                                const cursor = pageStack.value[cursorIndex];
                                q = query(collRef, ...constraints, orderBy("created_at", "desc"), startAfter(cursor), limit(bufferLimit));
                                pageStack.value = pageStack.value.slice(0, cursorIndex + 1);
                            }
                            currentPage.value = pageTarget;
                        } else { fetchData(1); return; }
                    }

                    const snap = await getDocs(q);
                    
                    // Filter Inpassing
                    let validDocs = snap.docs.filter(d => d.data().kategori !== 'INPASSING');
                    
                    // Slice sesuai page limit
                    const slicedDocs = validDocs.slice(0, limitVal);
                    listData.value = slicedDocs.map(mapDoc);
                    
                    if (slicedDocs.length > 0) {
                        const lastVisibleData = slicedDocs[slicedDocs.length - 1];
                        const lastVisibleDoc = snap.docs.find(d => d.id === lastVisibleData.id);
                        if (currentPage.value === 1) pageStack.value = [lastVisibleDoc];
                        else {
                            if (pageStack.value.length < currentPage.value) pageStack.value.push(lastVisibleDoc);
                            else pageStack.value[currentPage.value - 1] = lastVisibleDoc;
                        }
                    }
                    
                    // Total items estimation (Hanya di page 1 agar hemat)
                    if(pageTarget === 1) {
                         const snapshotCount = await getCountFromServer(query(collRef, ...constraints));
                         totalItems.value = snapshotCount.data().count; 
                    }
                }
            } catch (e) { console.error("Fetch Error:", e); } finally { loading.value = false; }
        };

        const goToPage = (p) => {
            if (p < 1 || p > totalPages.value || p === currentPage.value) return;
            fetchData(p);
        };

        watch(tableSearch, debounce(() => fetchData(1), 800));
        watch(itemsPerPage, () => fetchData(1));

        const fetchUsulanList = async () => {
            try {
                let constraints = [orderBy("created_at", "desc"), limit(100)]; // [HEMAT] Batasi 100 usulan terbaru saja
                // if (!store.isAdmin && auth.currentUser) {
                //     constraints.push(where("created_by", "==", auth.currentUser.uid));
                // }
                constraints.push(where("created_by", "==", auth.currentUser.uid));
                const q = query(collection(db, "usulan_kgb"), ...constraints);
                const snap = await getDocs(q);
                listUsulan.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(u => !u.nomor_naskah || (isEditMode.value && u.id === form.usulan_id)); 
            } catch (e) { console.error(e); }
        };

        const handleUsulanChange = () => {
            const selected = listUsulan.value.find(u => u.id === form.usulan_id);
            if (selected) {
                form.nama_pegawai = selected.nama_snapshot;
                form.nip = selected.nip;
                if(!isEditMode.value) {
                    form.golongan = selected.golongan;
                    const j = (selected.jenis_jabatan || '').toLowerCase();
                    console.log('Jenis Jabatan Usulan:', j);
                    if (j.includes('struktural') || j.includes('pelaksana')) form.jenis_jabatan = 'Struktural';
                    else form.jenis_jabatan = 'Fungsional';
                }
            }
        };

        const checkCustomNumber = debounce(async (nomor) => {
            if (!nomor) { customNumberStatus.value = null; customNumberMsg.value = ''; return; }
            customNumberStatus.value = 'checking'; customNumberMsg.value = 'Mengecek...';
            try {
                const q = query(collection(db, "nomor_surat"), 
                    where("nomor_lengkap", "==", nomor),
                    where("jenis_jabatan", "==", form.jenis_jabatan));
                
                const snap = await getDocs(q);
                if (!snap.empty) {
                    if (isEditMode.value && snap.docs[0].id === editId.value) {
                        customNumberStatus.value = 'available'; customNumberMsg.value = 'Nomor milik dokumen ini.';
                    } else {
                        const owner = snap.docs[0].data();
                        customNumberStatus.value = 'taken'; customNumberMsg.value = `Dipakai: ${owner.nama_pegawai}`;
                    }
                } else {
                    if (!nomor.includes('B-800')) { customNumberStatus.value = 'warning'; customNumberMsg.value = 'Format tidak standar.'; } 
                    else { customNumberStatus.value = 'available'; customNumberMsg.value = 'Tersedia.'; }
                }
            } catch (e) { customNumberStatus.value = 'invalid'; customNumberMsg.value = 'Gagal cek.'; }
        }, 800);

        watch(() => form.jenis_jabatan, () => { if(form.nomor_custom) checkCustomNumber(form.nomor_custom); });
        watch(() => form.nomor_custom, (newVal) => checkCustomNumber(newVal));

        // --- GAP DETECTOR ---
        const checkGaps = async () => {
            gapLoading.value = true; emptyNumbers.value = []; maxCounterVal.value = 0;
            try {
                const counterId = `${gapForm.tahun}_${gapForm.jenis_jabatan.toUpperCase()}`;
                const snapCount = await getDoc(doc(db, "counters_nomor", counterId));
                if (!snapCount.exists()) return;

                const maxVal = snapCount.data().count;
                maxCounterVal.value = maxVal;
                if (maxVal === 0) return;

                const q = query(collection(db, "nomor_surat"),
                    where("tahun", "==", gapForm.tahun),
                    where("jenis_jabatan", "==", gapForm.jenis_jabatan));
                
                const snapUsed = await getDocs(q);
                const usedSet = new Set();
                snapUsed.docs.forEach(d => { if(d.data().kategori !== 'INPASSING') usedSet.add(Number(d.data().no_urut)); });

                const gaps = [];
                for(let i=1; i<=maxVal; i++) { if(!usedSet.has(i)) gaps.push(i); }
                emptyNumbers.value = gaps;
            } catch (e) { console.error(e); showToast("Gagal cek nomor kosong", 'error'); } 
            finally { gapLoading.value = false; }
        };

        const useGapNumber = (no) => {
            showGapModal.value = false; openModal();
            form.tahun = gapForm.tahun; form.jenis_jabatan = gapForm.jenis_jabatan; form.no_urut = no;
            const noUrutStr = String(no).padStart(4, '0');
            form.nomor_custom = `B-800.1.11.13/IX/${noUrutStr}/BKPSDMD/${form.tahun}`;
            showToast(`Menggunakan slot kosong #${no}`, 'info');
            checkCustomNumber(form.nomor_custom);
        };

        const previewNomor = async () => {
            if (!form.usulan_id) return showToast("Pilih usulan dulu!", 'warning');
            try {
                const counterId = `${form.tahun}_${form.jenis_jabatan.toUpperCase()}`;
                const snap = await getDoc(doc(db, "counters_nomor", counterId));
                let nextCount = 1;
                if (snap.exists()) { nextCount = snap.data().count + 1; }
                const golRomawi = form.golongan ? form.golongan.split('/')[0] : '';
                const noUrutStr = String(nextCount).padStart(4, '0'); 
                form.nomor_custom = `B-800.1.11.13/${golRomawi}/${noUrutStr}/BKPSDMD/${form.tahun}`;
                form.no_urut = nextCount; 
                checkCustomNumber(form.nomor_custom);
            } catch (e) { showToast("Gagal hitung", 'error'); }
        };

        const simpanFinal = async () => {
            if (!form.nomor_custom) return showToast("Nomor belum diisi!", 'warning');
            if (customNumberStatus.value === 'taken') return showToast("Nomor terpakai!", 'error');
            isSaving.value = true;
            try {
                const parts = form.nomor_custom.split('/');
                let inputUrut = 0;
                if(parts.length > 2 && !isNaN(parseInt(parts[2]))) inputUrut = parseInt(parts[2]); 
                else inputUrut = form.no_urut || 0; 

                if (!isEditMode.value || (isEditMode.value && inputUrut !== form.no_urut)) {
                    const qCek = query(collection(db, "nomor_surat"),
                        where("no_urut", "==", inputUrut),
                        where("jenis_jabatan", "==", form.jenis_jabatan),
                        where("tahun", "==", form.tahun)
                    );
                    const snapCek = await getDocs(qCek);
                    if (!snapCek.empty) {
                        const existing = snapCek.docs[0].data();
                        if (existing.kategori !== 'INPASSING') {
                            if (!isEditMode.value || (isEditMode.value && snapCek.docs[0].id !== editId.value)) throw new Error(`Nomor Urut ${inputUrut} sudah digunakan!`);
                        }
                    }
                }

                if (isEditMode.value) {
                    await runTransaction(db, async (transaction) => {
                        const logRef = doc(db, "nomor_surat", editId.value);
                        transaction.update(logRef, {
                            usulan_id: form.usulan_id, nama_pegawai: form.nama_pegawai, nip: form.nip,
                            nomor_lengkap: form.nomor_custom, no_urut: inputUrut, kategori: 'KGB' 
                        });
                        if (oldUsulanId.value && oldUsulanId.value !== form.usulan_id) {
                            transaction.update(doc(db, "usulan_kgb", oldUsulanId.value), { nomor_naskah: null, tanggal_naskah: null });
                        }
                        transaction.update(doc(db, "usulan_kgb", form.usulan_id), { nomor_naskah: form.nomor_custom, tanggal_naskah: serverTimestamp() });
                    });
                    showToast("Update berhasil!", 'success');
                } else {
                    const counterId = `${form.tahun}_${form.jenis_jabatan.toUpperCase()}`;
                    const counterRef = doc(db, "counters_nomor", counterId);
                    const snapCount = await getDoc(counterRef);
                    let dbLastCount = 0;
                    if (snapCount.exists()) dbLastCount = snapCount.data().count;

                    if (inputUrut > dbLastCount) await setDoc(counterRef, { count: inputUrut }, { merge: true });

                    await setDoc(doc(collection(db, "nomor_surat")), {
                        usulan_id: form.usulan_id, nama_pegawai: form.nama_pegawai, nip: form.nip,
                        jenis_jabatan: form.jenis_jabatan, tahun: form.tahun, golongan: form.golongan,
                        no_urut: inputUrut, nomor_lengkap: form.nomor_custom, created_at: serverTimestamp(),
                        kategori: 'KGB' 
                    });
                    await updateDoc(doc(db, "usulan_kgb", form.usulan_id), { nomor_naskah: form.nomor_custom, tanggal_naskah: serverTimestamp() });
                    showToast("Nomor disimpan!", 'success');
                }
                closeModal(); fetchData(1);
            } catch (e) { console.error(e); showToast("Gagal: " + e.message, 'error'); } finally { isSaving.value = false; }
        };

        const editNomor = async (item) => {
            isEditMode.value = true; editId.value = item.id; oldUsulanId.value = item.usulan_id;
            Object.assign(form, { ...item, nomor_custom: item.nomor_lengkap });
            customNumberStatus.value = null; customNumberMsg.value = '';
            await fetchUsulanList(); showModal.value = true;
        };

        const hapusNomor = async (item) => {
            if (await showConfirm('Batalkan Nomor?', 'Nomor ini akan menjadi KOSONG.')) {
                try {
                    await runTransaction(db, async (transaction) => {
                        transaction.delete(doc(db, "nomor_surat", item.id));
                        if(item.usulan_id) {
                            transaction.update(doc(db, "usulan_kgb", item.usulan_id), { nomor_naskah: null, tanggal_naskah: null });
                        }
                    });
                    fetchData(1); showToast("Nomor dibatalkan.");
                } catch (e) { console.error(e); showToast(e.message, 'error'); }
            }
        };

        const generateDocBlob = async (usulanId) => {
            if (!window.PizZip || !window.docxtemplater) throw new Error("Library Error");
            const snap = await getDoc(doc(db, "usulan_kgb", usulanId));
            if(!snap.exists()) throw new Error("Data Usulan tidak ditemukan!");
            const item = snap.data();

            // [HEMAT] GUNAKAN CACHE TEMPLATE
            const tplId = item.tipe_asn === 'PPPK' ? "PPPK" : "PNS"; 
            if(!cacheTemplates.value[tplId]) {
                const ts = await getDoc(doc(db, "config_template", tplId)); 
                if(!ts.exists()) throw new Error("Template Missing");
                cacheTemplates.value[tplId] = ts.data().url || `./templates/${ts.data().nama_file}`;
            }
            const url = cacheTemplates.value[tplId];

            // [HEMAT] GUNAKAN CACHE GLOBAL VARS
            let gvd = cacheGlobalVars.value;
            if(!gvd?.dasar_hukum) {
                const gv = await getDoc(doc(db, "config_template", "GLOBAL_VARS")); 
                gvd = gv.exists() ? gv.data() : {};
                cacheGlobalVars.value = gvd;
            }

            let pangkatFinal = item.pangkat || ""; 
            // Opsional: Bisa cache master golongan juga, tapi untuk single doc read ini ok
            if (item.golongan && !pangkatFinal) {
                try {
                    const qPkt = query(collection(db, "master_golongan"), where("kode", "==", item.golongan));
                    const snapPkt = await getDocs(qPkt);
                    if (!snapPkt.empty) pangkatFinal = snapPkt.docs[0].data().pangkat;
                } catch (e) {}
            }

            const golKode = item.golongan || "";
            const isSetda = item.tipe_asn === 'PNS' && (golKode.startsWith('IV') || golKode.startsWith('4'));
            let kopT=isSetda ? gvd.kop_setda?.judul : gvd.kop_bkpsdmd?.judul;
            let kopA=isSetda ? gvd.kop_setda?.alamat : gvd.kop_bkpsdmd?.alamat;
            let targetNip = item.pejabat_baru_nip || (isSetda ? gvd.kop_setda?.pejabat_nip : gvd.kop_bkpsdmd?.pejabat_nip);
            let pjp="", pjj="BUPATI BANGKA", pjn="", pjnip="";
            
            // Opsional: Cache Pejabat juga bisa ditambahkan
            if (targetNip) { 
                const ps = await getDoc(doc(db, "master_pejabat", targetNip)); 
                if(ps.exists()){ const d = ps.data(); pjp=d.pangkat||pjp; pjj=d.jabatan||pjj; pjn=d.nama||""; pjnip=d.nip||""; } 
            }
            
            let ttdContent = previewTab.value === 'TTE' ? "\n\n\n${ttd_pengirim}\n\n\n\n" : "\n\n\n\n";
            let tanggalSurat = item.tanggal_naskah ? formatTanggal(item.tanggal_naskah.toDate ? item.tanggal_naskah.toDate() : new Date(item.tanggal_naskah)) : "....................";
            const mapH = gvd.dasar_hukum || []; 
            const searchKey = item.nomor_inpassing ? "INPASSING" : item.dasar_hukum;
            const foundH = mapH.find(h => h.judul === searchKey);
            const textHukum = foundH ? foundH.isi : "-";

            const res = await fetch(url); const buf = await res.arrayBuffer();
            const zip = new window.PizZip(buf);
            const docRender = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: (p) => p.value.startsWith('$') ? `{${p.value}}` : "" });

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

        const previewSK = async (logItem) => {
            if (!window.docx) return showToast("Library Error", 'error');
            showPreviewModal.value = true; previewLoading.value = true; currentPreviewItem.value = logItem; previewTab.value = 'BASAH'; 
            await nextTick(); await renderCurrentPreview();
        };
        const changePreviewTab = async (tabName) => { previewTab.value = tabName; previLoading.value = true; await nextTick(); await renderCurrentPreview(); };
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
                const prefix = previewTab.value === 'TTE' ? 'DRAFT_TTE_' : 'SK_';
                window.saveAs(blob, `${prefix}KGB_${logItem.nama_pegawai.replace(/\W/g,'')}.docx`);
            } catch(e) { showToast("Gagal: " + e.message, 'error'); }
        };

        const openModal = async () => {
            isEditMode.value = false; editId.value = null; oldUsulanId.value = null;
            Object.assign(form, { usulan_id:'', nama_pegawai:'', nip:'', jenis_jabatan:'Fungsional', golongan:'', tahun: new Date().getFullYear(), nomor_custom:'', no_urut: 0 });
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
            showGapModal, gapLoading, emptyNumbers, maxCounterVal, gapForm, checkGaps, useGapNumber
        };
    }
};