import { ref, reactive, watch, onMounted, computed, nextTick } from 'vue';
import {
    db, auth, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, getCountFromServer,
    query, orderBy, limit, startAfter, where, serverTimestamp, onAuthStateChanged
} from '../firebase.js';
import {
    showToast, showConfirm, debounce,
    formatTanggal, formatTitleCase,
    fetchWithCache, terbilang
} from '../utils.js';

import {
    TplSearchSelect,
    TplAutocompleteJabatan,
    TplAutocompleteUnitKerja,
    TplMain
} from '../views/SkFungsionalView.js';
import { siasnBookmarklet } from '../siasnBookmarklet.js';

// ============================================================
// SUB-COMPONENT: SearchSelect (Dropdown Searchable)
// ============================================================
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
            return opts.filter(opt =>
                String(getLabel(opt)).toLowerCase().includes(search.value.toLowerCase())
            );
        });

        const selectedLabel = computed(() => {
            const opts = props.options || [];
            if (!opts.length) return null;
            const found = opts.find(opt => getKey(opt) === props.modelValue);
            return found ? getLabel(found) : null;
        });

        const selectOpt = (opt) => {
            emit('update:modelValue', getKey(opt));
            emit('change', opt);
            isOpen.value = false;
            search.value = '';
        };

        return { isOpen, search, safeOptions, selectedLabel, selectOpt, getKey, getLabel };
    }
};

// ============================================================
// SUB-COMPONENT: AutocompleteJabatan
// ============================================================
const AutocompleteJabatan = {
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue', 'select'],
    template: TplAutocompleteJabatan,
    setup(props, { emit }) {
        const showSuggestions = ref(false);
        const suggestions = ref([]);

        const fetchSuggestions = debounce(async (keyword) => {
            if (!keyword || keyword.length < 3) { suggestions.value = []; return; }
            try {
                const q = query(
                    collection(db, "master_jabatan"),
                    where("nama_jabatan", ">=", keyword),
                    where("nama_jabatan", "<=", keyword + "\uf8ff"),
                    limit(5)
                );
                const snap = await getDocs(q);
                suggestions.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) { }
        }, 800);

        const handleInput = (e) => {
            const raw = e.target.value;
            if (e.inputType && e.inputType.startsWith('delete')) {
                emit('update:modelValue', raw);
                fetchSuggestions(raw);
                showSuggestions.value = true;
                return;
            }
            const pos = e.target.selectionStart;
            const val = formatTitleCase(raw);
            e.target.value = val;
            const diff = val.length - raw.length;
            e.target.setSelectionRange(pos + diff, pos + diff);
            emit('update:modelValue', val);
            fetchSuggestions(val);
            showSuggestions.value = true;
        };

        const delayHide = () => setTimeout(() => showSuggestions.value = false, 200);
        const handleBlur = (e) => {
            const val = formatTitleCase(e.target.value);
            e.target.value = val;
            emit('update:modelValue', val);
            delayHide();
        };

        const selectItem = (item) => {
            const fmt = formatTitleCase(item.nama_jabatan);
            emit('update:modelValue', fmt);
            emit('select', item);
            showSuggestions.value = false;
        };

        return { showSuggestions, suggestions, handleInput, handleBlur, selectItem, delayHide };
    }
};

// ============================================================
// SUB-COMPONENT: AutocompleteUnitKerja
// ============================================================
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
            snap.forEach(d => {
                const val = d.data().unit_kerja;
                if (val && val.toLowerCase().includes(keyLower)) units.add(val);
            });
            return Array.from(units).slice(0, 5);
        };

        const fetchSuggestions = debounce(async (keyword) => {
            if (!keyword || keyword.length < 3) { suggestions.value = []; return; }
            try {
                const qGlobal = query(collection(db, "usulan_sk_fungsional"), orderBy("created_at", "desc"), limit(50));
                const snap = await getDocs(qGlobal);
                suggestions.value = processSnap(snap, keyword);
            } catch (e) { }
        }, 500);

        const handleInput = (e) => {
            const raw = e.target.value;
            if (e.inputType && e.inputType.startsWith('delete')) {
                emit('update:modelValue', raw);
                fetchSuggestions(raw);
                showSuggestions.value = true;
                return;
            }
            const pos = e.target.selectionStart;
            const val = formatTitleCase(raw);
            e.target.value = val;
            const diff = val.length - raw.length;
            e.target.setSelectionRange(pos + diff, pos + diff);
            emit('update:modelValue', val);
            fetchSuggestions(val);
            showSuggestions.value = true;
        };

        const delayHide = () => setTimeout(() => showSuggestions.value = false, 200);
        const handleBlur = (e) => {
            const val = formatTitleCase(e.target.value);
            e.target.value = val;
            emit('update:modelValue', val);
            delayHide();
        };

        const selectItem = (item) => {
            const fmt = formatTitleCase(item);
            emit('update:modelValue', fmt);
            showSuggestions.value = false;
        };

        return { showSuggestions, suggestions, handleInput, handleBlur, selectItem, delayHide };
    }
};

// ============================================================
// MAIN COMPONENT: SK FUNGSIONAL
// ============================================================
export default {
    components: { SearchSelect, AutocompleteJabatan, AutocompleteUnitKerja },
    template: TplMain,
    setup() {

        // --- STATE: TABEL ---
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
            if (expandedRows.value.includes(id)) expandedRows.value = expandedRows.value.filter(r => r !== id);
            else expandedRows.value.push(id);
        };
        const isExpanded = (id) => expandedRows.value.includes(id);

        // --- STATE: MODAL ---
        const showModal = ref(false);
        const showPreviewModal = ref(false);
        const previewLoading = ref(false);
        const currentPreviewItem = ref(null);
        const previewTab = ref('TTE');

        // --- STATE: FORM ---
        const isEditMode = ref(false);
        const isSaving = ref(false);
        const isSearching = ref(false);
        const searchMsg = ref('');
        const formId = ref(null);

        // --- CACHE DATA MASTER ---
        const listGolongan = ref([]);
        const listPejabat = ref([]);
        const cacheTemplates = ref({});

        // --- COMPUTED ---
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

        // --- FORM ---
        const form = reactive({
            nip: '', nama: '',
            unit_kerja: '', perangkat_daerah: '',
            pangkat_golongan: '', golongan_kode: '', tmt_pangkat_golongan: '',
            no_pertek_bkn: '', tgl_pertek_bkn: '',
            no_ser_kom: '', tgl_ser_kom: '',
            jabatan_lama: '', jabatan_baru: '',
            tmt_jabatan: '', angka_kredit: '',
            kategori_jabatan: 'Keahlian',
            tunjangan: '',
            pejabat_nip: '',
            nomor_naskah: ''
        });

        // Opsi radio tunjangan: 'dengan' | 'non'
        const opsiTunjangan = ref('non');
        watch(opsiTunjangan, (val) => {
            if (val === 'non') form.tunjangan = '';
        });

        // Pejabat yang sedang terpilih di form (untuk ditampilkan preview)
        const pejabatTerpilih = computed(() => {
            if (!form.pejabat_nip || listPejabat.value.length === 0) return null;
            return listPejabat.value.find(p => p.nip === form.pejabat_nip) || null;
        });

        // ============================================================
        // INIT MASTER DATA (dengan cache)
        // ============================================================
        const initRefs = async () => {
            if (listGolongan.value.length === 0) {
                const qGol = query(collection(db, "master_golongan"), orderBy("kode"));
                const dataGol = await fetchWithCache('SKFUNG_MASTER_GOLONGAN', qGol, 12);
                listGolongan.value = [];
                const setGol = new Set();
                dataGol.forEach(data => {
                    if (!setGol.has(data.kode + data.tipe)) {
                        setGol.add(data.kode + data.tipe);
                        listGolongan.value.push({
                            kode: data.kode,
                            pangkat: data.pangkat,
                            tipe: data.tipe,
                            label_full: `${data.kode} - ${data.pangkat}`
                        });
                    }
                });
            }
            if (listPejabat.value.length === 0) {
                const qPj = query(collection(db, "master_pejabat"), orderBy("nama"));
                const dataPj = await fetchWithCache('SKFUNG_MASTER_PEJABAT', qPj, 12);
                listPejabat.value = dataPj;
            }
        };

        // ============================================================
        // FETCH TABLE (Pagination + Search)
        // ============================================================
        const mapDoc = (d) => {
            const data = d.data();
            data.id = d.id;
            return data;
        };

        const fetchTable = async (pageTarget) => {
            tableLoading.value = true;
            try {
                const collRef = collection(db, "usulan_sk_fungsional");
                const limitVal = parseInt(itemsPerPage.value) || 10;
                let q;

                // Semua user yang login bisa melihat semua data (tidak difilter per user)
                const baseConstraints = [];

                const isFilteringDate = filterStartDate.value || filterEndDate.value;

                if (tableSearch.value.trim()) {
                    const term = tableSearch.value.trim();
                    const isNumber = /^\d+$/.test(term);
                    let searchConstraints = [];

                    if (isNumber) {
                        searchConstraints.push(orderBy("nip"));
                        searchConstraints.push(where("nip", ">=", term));
                        searchConstraints.push(where("nip", "<=", term + "\uf8ff"));
                    } else {
                        // Cari pakai nama_search (lowercase) agar case-insensitive
                        const termNama = term.toLowerCase();
                        searchConstraints.push(orderBy("nama_search"));
                        searchConstraints.push(where("nama_search", ">=", termNama));
                        searchConstraints.push(where("nama_search", "<=", termNama + "\uf8ff"));
                    }

                    q = query(collRef, ...searchConstraints, limit(50));
                    const snap = await getDocs(q);
                    listData.value = snap.docs.map(mapDoc);
                    isLastPage.value = true;

                } else {
                    if (isFilteringDate) {
                        if (filterStartDate.value) {
                            const startDate = new Date(filterStartDate.value);
                            startDate.setHours(0, 0, 0, 0);
                            baseConstraints.push(where("created_at", ">=", startDate));
                        }
                        if (filterEndDate.value) {
                            const endDate = new Date(filterEndDate.value);
                            endDate.setHours(23, 59, 59, 999);
                            baseConstraints.push(where("created_at", "<=", endDate));
                        }
                    }

                    if (pageTarget === 1 || pageTarget === 'first') {
                        const snapshotCount = await getCountFromServer(query(collRef, ...baseConstraints));
                        totalItems.value = snapshotCount.data().count;
                        pageStack.value = [];
                        currentPage.value = 1;
                    }

                    let qConstraints = [
                        ...baseConstraints,
                        orderBy("created_at", "desc"),
                        orderBy("__name__", "desc")
                    ];

                    if (typeof pageTarget === 'number') {
                        if (pageTarget === 1) {
                            q = query(collRef, ...qConstraints, limit(limitVal));
                            currentPage.value = 1; pageStack.value = [];
                        } else {
                            if (pageTarget > currentPage.value) {
                                const lastDoc = pageStack.value[pageStack.value.length - 1];
                                if (lastDoc) {
                                    q = query(collRef, ...qConstraints, startAfter(lastDoc), limit(limitVal));
                                    currentPage.value = pageTarget;
                                } else { fetchTable(1); return; }
                            } else if (pageTarget < currentPage.value) {
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
                console.error("Fetch Error SK Fungsional:", e);
                if (e.code === 'failed-precondition' || (e.message && e.message.includes('index'))) {
                    const link = e.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                    if (link) {
                        console.warn("Index Required:", link[0]);
                        showToast("Perlu Index Database Baru. Cek Console (F12) untuk Link.", 'info');
                        window.open(link[0], '_blank');
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

        // ============================================================
        // UPDATE STATUS (Toggle Selesai)
        // ============================================================
        const updateStatus = async (item, newStatus) => {
            if (!item.id) return showToast("ID Error", "error");
            const oldStatus = item.status;
            item.status = newStatus;

            try {
                await updateDoc(doc(db, "usulan_sk_fungsional", item.id), {
                    status: newStatus,
                    updated_at: serverTimestamp()
                });
                showToast(newStatus === 'SELESAI' ? "Ditandai Selesai" : "Dikembalikan ke Draft", "success");
            } catch (e) {
                item.status = oldStatus;
                showToast("Gagal update status", "error");
            }
        };

        // ============================================================
        // HANDLE NIP INPUT (Auto-fill dari master_pegawai)
        // ============================================================
        const handleNipInput = debounce(async (e) => {
            const val = e.target.value;
            const clean = val.replace(/\s/g, '');
            if (clean.length < 5) return;
            isSearching.value = true;

            try {
                const snap = await getDoc(doc(db, "master_pegawai", clean));
                if (snap.exists()) {
                    const d = snap.data();
                    Object.assign(form, {
                        nama: d.nama || '',
                        unit_kerja: formatTitleCase(d.unit_kerja || ''),
                        perangkat_daerah: formatTitleCase(d.perangkat_daerah || ''),
                    });
                    // Auto-fill pangkat & golongan dari master jika ada
                    if (d.golongan_kode) {
                        form.golongan_kode = d.golongan_kode;
                        handleGolonganChange({ kode: d.golongan_kode, pangkat: d.pangkat });
                    } else if (d.pangkat) {
                        form.pangkat_golongan = d.pangkat;
                    }
                    // Auto-fill jabatan lama dari master pegawai
                    if (d.jabatan) form.jabatan_lama = formatTitleCase(d.jabatan);

                    searchMsg.value = "Ditemukan";
                } else {
                    searchMsg.value = "Baru";
                    form.nama = '';
                }
            } catch (e) {
                console.error(e);
            } finally {
                isSearching.value = false;
            }
        }, 800);

        // ============================================================
        // HANDLE GOLONGAN CHANGE
        // ============================================================
        const handleGolonganChange = (opt) => {
            // opt bisa berupa object dari SearchSelect atau object manual
            const kode = opt.kode || opt;
            const found = listGolongan.value.find(g => g.kode === kode);
            if (found) {
                form.golongan_kode = found.kode;
                // Sesuai permintaan: value yang diset adalah III/a bukan Penata Muda / III/a
                form.pangkat_golongan = found.kode;
            }
        };

        // ============================================================
        // HANDLE PEJABAT CHANGE
        // ============================================================
        const handlePejabatChange = (opt) => {
            form.pejabat_nip = opt.nip;
        };

        // ============================================================
        // HANDLE JABATAN BARU SELECT (Auto-fill dari master_jabatan)
        // ============================================================
        const handleJabatanBaruSelect = (jabatanItem) => {
            // Auto-fill tunjangan dari master_jabatan
            if (jabatanItem.tunjangan !== undefined && jabatanItem.tunjangan !== null && jabatanItem.tunjangan !== '') {
                form.tunjangan = jabatanItem.tunjangan;
                opsiTunjangan.value = 'dengan';
            } else {
                form.tunjangan = '';
                opsiTunjangan.value = 'non';
            }
        };

        // ============================================================
        // OPEN / CLOSE MODAL
        // ============================================================
        const openModal = (item = null) => {
            if (item) {
                if (!item.id) { showToast("ID Error", 'error'); return; }
                isEditMode.value = true;
                formId.value = item.id;
                Object.assign(form, item);
                // Set opsi tunjangan sesuai data yang dimuat
                opsiTunjangan.value = (item.tunjangan && Number(item.tunjangan) > 0) ? 'dengan' : 'non';
            } else {
                isEditMode.value = false;
                formId.value = null;
                Object.keys(form).forEach(k => form[k] = '');
                form.nomor_naskah = '100.3.3.2/GANTI INI/BKPSDMD/2026';
                form.kategori_jabatan = 'Keahlian';
                opsiTunjangan.value = 'non';
            }
            searchMsg.value = '';
            showModal.value = true;
        };
        const closeModal = () => { showModal.value = false; searchMsg.value = ''; };

        // ============================================================
        // SIMPAN DATA (Create / Update)
        // ============================================================
        const simpanData = async () => {
            if (!form.nip || !form.nama) return showToast("NIP dan Nama wajib diisi!", 'warning');
            if (!form.jabatan_baru) return showToast("Jabatan Baru wajib diisi!", 'warning');
            if (!form.tmt_jabatan) return showToast("TMT Jabatan wajib diisi!", 'warning');

            isSaving.value = true;
            try {
                // Ambil snapshot data pejabat saat menyimpan
                let pejabatSnap = {};
                if (form.pejabat_nip) {
                    const found = listPejabat.value.find(p => p.nip === form.pejabat_nip);
                    if (found) {
                        pejabatSnap = {
                            pejabat_nama: found.nama,
                            pejabat_jabatan: found.jabatan,
                            pejabat_pangkat: found.pangkat,
                        };
                    }
                }

                const safeForm = { ...form };
                // Simpan nama apa adanya sesuai input
                safeForm.nama_search = safeForm.nama.toLowerCase(); // Field khusus untuk search case-insensitive
                safeForm.unit_kerja = formatTitleCase(safeForm.unit_kerja);
                safeForm.perangkat_daerah = formatTitleCase(safeForm.perangkat_daerah);
                safeForm.jabatan_lama = formatTitleCase(safeForm.jabatan_lama);
                safeForm.jabatan_baru = formatTitleCase(safeForm.jabatan_baru);

                const payload = {
                    ...safeForm,
                    ...pejabatSnap,
                    creator_email: auth.currentUser.email,
                    updated_at: serverTimestamp()
                };

                if (isEditMode.value) {
                    await updateDoc(doc(db, "usulan_sk_fungsional", formId.value), payload);
                    showToast("Data berhasil diperbarui!", 'success');
                } else {
                    payload.created_at = serverTimestamp();
                    payload.created_by = auth.currentUser.uid;
                    payload.status = 'DRAFT';
                    await addDoc(collection(db, "usulan_sk_fungsional"), payload);
                    showToast("Data berhasil disimpan!", 'success');
                }

                closeModal();
                fetchTable(1);
            } catch (e) {
                console.error(e);
                showToast(e.message, 'error');
            } finally {
                isSaving.value = false;
            }
        };

        // ============================================================
        // HAPUS DATA
        // ============================================================
        const hapusData = async (item) => {
            if (!item || !item.id) return showToast("ID Error", 'error');
            if (await showConfirm("Hapus Data?", `Data SK Fungsional a.n ${item.nama} akan dihapus permanen.`, "Ya, Hapus")) {
                try {
                    await deleteDoc(doc(db, "usulan_sk_fungsional", item.id));
                    fetchTable(currentPage.value);
                    showToast("Data dihapus.", 'success');
                } catch (e) {
                    showToast("Gagal menghapus: " + e.message, 'error');
                }
            }
        };

        // ============================================================
        // GENERATE DOCX BLOB (Render Template .docx)
        // ============================================================
        const generateDocBlob = async (item) => {
            if (!window.PizZip || !window.docxtemplater) throw new Error("Library docxtemplater tidak tersedia!");

            // Pilih template berdasarkan ada/tidaknya tunjangan
            const hasTunjangan = !!(item.tunjangan && Number(item.tunjangan) > 0);
            const tplId = hasTunjangan ? "SK_FUNGSIONAL_TUNJANGAN" : "SK_FUNGSIONAL";

            // Load dan cache URL template
            if (!cacheTemplates.value[tplId]) {
                const ts = await getDoc(doc(db, "config_template", tplId));
                if (!ts.exists()) throw new Error(`Template "${tplId}" belum dikonfigurasi di Master Template!`);
                cacheTemplates.value[tplId] = ts.data().url || `./templates/${ts.data().nama_file}`;
            }
            const url = cacheTemplates.value[tplId];

            // Ambil data pejabat penandatangan
            let pjn = '', pjnip = '', pjj = '', pjp = '';
            const targetNip = item.pejabat_nip;
            if (targetNip) {
                const foundPj = listPejabat.value.find(p => p.nip === targetNip);
                if (foundPj) {
                    pjn = foundPj.nama || '';
                    pjnip = foundPj.nip || '';
                    pjj = foundPj.jabatan || '';
                    pjp = foundPj.pangkat || '';
                } else {
                    try {
                        const ps = await getDoc(doc(db, "master_pejabat", targetNip));
                        if (ps.exists()) {
                            const d = ps.data();
                            pjn = d.nama || ''; pjnip = d.nip || '';
                            pjj = d.jabatan || ''; pjp = d.pangkat || '';
                        }
                    } catch (e) { }
                }
            }
            // Fallback dari snapshot yang tersimpan saat save
            if (!pjn && item.pejabat_nama) pjn = item.pejabat_nama;
            if (!pjj && item.pejabat_jabatan) pjj = item.pejabat_jabatan;
            if (!pjp && item.pejabat_pangkat) pjp = item.pejabat_pangkat;

            // TTD Content berdasarkan mode preview
            let ttdContent = previewTab.value === 'TTE'
                ? "\n\n\n\xA0\xA0\xA0\xA0\xA0\xA0\xA0${ttd_pengirim}\n\n\n"
                : "\n\n";

            // Fetch dan render template
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Gagal mengunduh template dari: ${url}`);
            const buf = await res.arrayBuffer();
            const zip = new window.PizZip(buf);
            const docRender = new window.docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: () => ""
            });

            // Helper format string
            const toUp = (str) => (str || '').toString().toUpperCase();
            const toLow = (str) => (str || '').toString().toLowerCase();
            const toTitle = (str) => (str || '').toString().replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

            let combinedUnitKerja = item.unit_kerja || "";
            if (item.unit_kerja && item.perangkat_daerah) {
                const uk = item.unit_kerja.trim().toLowerCase();
                const pd = item.perangkat_daerah.trim().toLowerCase();
                if (uk !== pd) {
                    combinedUnitKerja = `${item.unit_kerja.trim()} - ${item.perangkat_daerah.trim()}`;
                }
            }

            const baseVars = {
                // 1. Identitas Surat
                NOMOR_NASKAH: item.nomor_naskah || "....................",

                // 2. Dokumen Dasar (Konsideran)
                valueNoPertekBKN: item.no_pertek_bkn || "-",
                valueSerKom: item.no_ser_kom || "-",

                // 3. Identitas PNS
                valueNama: item.nama || "",
                valueNamaPns: item.nama || "",
                valueNip: item.nip || "",
                valuePangkatGolongan: item.pangkat_golongan || "",
                valueUnitKerja: combinedUnitKerja,

                // 4. Detail Jabatan Fungsional
                valueJabatanLama: item.jabatan_lama || "-",
                valueJabatanBaru: item.jabatan_baru || "",
                valueAngkaKredit: item.angka_kredit ? `${item.angka_kredit} (${terbilang(item.angka_kredit)})` : "-",

                // 4b. Kategori & Tunjangan
                valueKategoriJabatan: item.kategori_jabatan || "Keahlian",
                valueTunjangan: item.tunjangan ? `Rp ${Number(item.tunjangan).toLocaleString('id-ID')} (${terbilang(item.tunjangan)} rupiah)` : "-",
                valueTunjanganAngka: item.tunjangan ? `Rp ${Number(item.tunjangan).toLocaleString('id-ID')}` : "-",
                valueTunjanganTerbilang: item.tunjangan ? `${terbilang(item.tunjangan)} rupiah` : "-",

                // 5. Pengesahan / Penandatangan
                JABATAN_PEJABAT: pjj || "",
                NAMA_PENGIRIM: pjn || "${nama_pengirim}",
                PANGKAT_PEJABAT: pjp || "",
                NIP_PENGIRIM: pjnip || "${nip_pengirim}",
            };

            const expandedVars = {};
            for (const [key, val] of Object.entries(baseVars)) {
                expandedVars[key] = val;
                expandedVars[`${key}Up`] = toUp(val);
                expandedVars[`${key}Low`] = toLow(val);
                expandedVars[`${key}Title`] = toTitle(val);
            }

            // Tambahkan variabel tanggal & statis
            expandedVars.tanggal_naskah = previewTab.value === 'TTE' 
                ? "${tanggal_naskah}" 
                : formatTanggal(new Date().toISOString().split('T')[0]);
            expandedVars.valueTanggalPertekBKN = formatTanggal(item.tgl_pertek_bkn);
            expandedVars.valueTanggalSerKom = formatTanggal(item.tgl_ser_kom);
            expandedVars.valueTmtPangkatGolongan = formatTanggal(item.tmt_pangkat_golongan);
            expandedVars.valueTmtJabatan = formatTanggal(item.tmt_jabatan);
            expandedVars.TTD_PENGIRIM = ttdContent;

            docRender.render(expandedVars);

            return docRender.getZip().generate({
                type: "blob",
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                compression: "DEFLATE",
                compressionOptions: { level: 7 }
            });
        };

        // ============================================================
        // PREVIEW SK
        // ============================================================
        const previewSK = async (item) => {
            if (!window.docx) return showToast("Library Preview (docx-preview) tidak tersedia!", 'error');
            showPreviewModal.value = true;
            previewLoading.value = true;
            currentPreviewItem.value = item;
            previewTab.value = 'TTE';
            await nextTick();
            try {
                const blob = await generateDocBlob(item);
                const container = document.getElementById('docx-preview-container-fungsional');
                if (container) { container.innerHTML = ''; await window.docx.renderAsync(blob, container); }
            } catch (e) {
                showToast("Gagal Preview: " + e.message, 'error');
                console.error(e);
            } finally {
                previewLoading.value = false;
            }
        };

        const changePreviewTab = async (tabName) => {
            previewTab.value = tabName;
            previewLoading.value = true;
            await nextTick();
            try {
                const blob = await generateDocBlob(currentPreviewItem.value);
                const container = document.getElementById('docx-preview-container-fungsional');
                if (container) { container.innerHTML = ''; await window.docx.renderAsync(blob, container); }
            } catch (e) {
                showToast("Gagal memuat ulang preview", 'error');
            } finally {
                previewLoading.value = false;
            }
        };

        const closePreview = () => { showPreviewModal.value = false; currentPreviewItem.value = null; };
        const downloadFromPreview = async () => { if (currentPreviewItem.value) cetakSK(currentPreviewItem.value); };

        // ============================================================
        // DOWNLOAD DRAFT (.docx)
        // ============================================================
        const cetakSK = async (item) => {
            try {
                showToast("Menyiapkan file...", 'info');
                const blob = await generateDocBlob(item);
                const prefix = previewTab.value === 'TTE' ? 'DRAFT_TTE_' : 'SK_';
                const safeName = (item.nama || 'TanpaNama').replace(/[^a-zA-Z0-9]/g, '_');
                const safeJab = (item.jabatan_baru || 'Fungsional').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
                window.saveAs(blob, `${prefix}FUNGSIONAL_${safeName}_${safeJab}.docx`);
            } catch (e) {
                showToast("Gagal download: " + e.message, 'error');
                console.error(e);
            }
        };

        // ============================================================
        // KIRIM KE SRIKANDI
        // ============================================================
        const openSrikandi = async (item) => {
            previewTab.value = 'TTE';
            try {
                showToast("Menyiapkan data untuk Srikandi...", "info");
                const docBlob = await generateDocBlob(item);
                const reader = new FileReader();
                reader.readAsDataURL(docBlob);

                reader.onloadend = () => {
                    const base64data = reader.result;

                    // Ambil data pejabat penandatangan
                    let penandatangan = "KEPALA BADAN KEPEGAWAIAN"; // Fallback
                    if (item.pejabat_nip && listPejabat.value) {
                        const foundPj = listPejabat.value.find(p => p.nip === item.pejabat_nip);
                        if (foundPj && foundPj.jabatan) {
                            penandatangan = foundPj.jabatan.toUpperCase();
                        }
                    } else if (item.pejabat_jabatan) {
                        penandatangan = item.pejabat_jabatan.toUpperCase();
                    }

                    // Verifikator standar
                    const verifikatorString = "BIDANG MUTASI|SEKRETARIS";
                    const tujuanString = "Badan Kepegawaian dan Pengembangan Sumber Daya Manusia";

                    const params = new URLSearchParams({
                        action: 'autofill_magic',
                        fill_hal: `SK Jabatan Fungsional a.n ${item.nama}`,
                        fill_ringkasan: `SK Kenaikan Jabatan Fungsional ${item.jabatan_baru} a.n ${item.nama}, ${item.pangkat_golongan || ''}.`,
                        fill_nomor: item.nomor_naskah || "NOMOR KOSONG",
                        fill_penandatangan: penandatangan,
                        fill_verifikator: verifikatorString,
                        fill_tujuan: tujuanString,
                        transfer_mode: 'direct_post_message',
                        file_name: `SK_FUNGSIONAL_${(item.nama || '').replace(/[^a-zA-Z0-9]/g, '_')}.docx`
                    });

                    const srikandiUrl = `https://srikandi.arsip.go.id/pembuatan-naskah-keluar/registrasi-naskah-keluar?${params.toString()}`;
                    const popup = window.open(srikandiUrl, '_blank');

                    if (!popup) {
                        showToast("Pop-up diblokir! Izinkan pop-up di browser.", "error");
                        return;
                    }

                    const messageHandler = (event) => {
                        if (event.data === "SRIKANDI_READY_TO_RECEIVE") {
                            popup.postMessage({
                                type: 'FILE_TRANSFER',
                                fileData: base64data,
                                fileName: `SK_FUNGSIONAL_${(item.nama || '').replace(/[^a-zA-Z0-9]/g, '_')}.docx`
                            }, '*');
                            window.removeEventListener('message', messageHandler);
                            showToast("File berhasil dikirim ke Srikandi!", "success");
                        }
                    };
                    window.addEventListener('message', messageHandler);
                };
            } catch (e) {
                console.error("Srikandi Error:", e);
                showToast("Gagal kirim ke Srikandi: " + e.message, "error");
            }
        };

        // ============================================================
        // CEK SIASN — Buka tab SIASN & terima data balik dari bookmarklet
        // ============================================================
        const cekSIASN = (nip) => {
            if (!nip) return;
            // Embed NIP & origin di URL agar bookmarklet bisa baca tanpa cross-domain issue
            const encodedNip = encodeURIComponent(nip.trim());
            const encodedOrigin = encodeURIComponent(window.location.origin);
            const siasUrl = `https://siasn-instansi.bkn.go.id/peremajaan/profil/pns/?kgb_nip=${encodedNip}&kgb_origin=${encodedOrigin}`;
            window.open(siasUrl, '_blank');
            showToast('Tab SIASN dibuka. Jalankan Bookmarklet SIASN di halaman tersebut.', 'info');
        };

        // Handler: Terima data balik dari bookmarklet via postMessage
        const handleSIASNMessage = (event) => {
            // Terima dari SIASN atau localhost (dev)
            if (!event.origin.includes('siasn-instansi.bkn.go.id') && !event.origin.includes('localhost') && !event.origin.includes('127.0.0.1')) return;
            if (!event.data || event.data.type !== 'KGBAPP_SIASN_DATA') return;

            const d = event.data.payload;
            if (!d) return;

            // Auto-fill form dengan data dari SIASN
            if (d.nama) form.nama = d.nama;
            if (d.unit_kerja) form.unit_kerja = d.unit_kerja;
            if (d.perangkat_daerah) form.perangkat_daerah = d.perangkat_daerah;
            if (d.pangkat_golongan) form.pangkat_golongan = d.pangkat_golongan;
            if (d.golongan_kode) {
                form.golongan_kode = d.golongan_kode;
                handleGolonganChange(d.golongan_kode);
            }
            if (d.tmt_pangkat_golongan) form.tmt_pangkat_golongan = d.tmt_pangkat_golongan;

            showToast(`✅ Data SIASN diimport: ${d.nama || ''}`, 'success');
        };

        // Copy bookmarklet SIASN ke clipboard
        const copyBookmarkletSIASN = async () => {
            if (!siasnBookmarklet) { showToast('Bookmarklet kosong!', 'error'); return; }
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(siasnBookmarklet);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = siasnBookmarklet;
                    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
                    document.body.appendChild(ta); ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                showToast('Bookmarklet SIASN berhasil dicopy! Paste di URL bookmark.', 'success');
            } catch (e) { showToast('Gagal copy: ' + e.message, 'error'); }
        };

        // ============================================================
        // EXPORT EXCEL
        // ============================================================
        const downloadExcel = async () => {
            if (!window.XLSX) return showToast("Library Excel tidak tersedia", 'error');

            showToast("Menyiapkan data export...", 'info');
            try {
                const collRef = collection(db, "usulan_sk_fungsional");
                const baseConstraints = [];
                const isFilteringDate = filterStartDate.value || filterEndDate.value;

                if (tableSearch.value.trim()) {
                    const term = tableSearch.value.trim();
                    const isNumber = /^\d+$/.test(term);
                    if (isNumber) {
                        baseConstraints.push(orderBy("nip"));
                        baseConstraints.push(where("nip", ">=", term));
                        baseConstraints.push(where("nip", "<=", term + "\uf8ff"));
                    } else {
                        const termNama = term.toLowerCase();
                        baseConstraints.push(orderBy("nama_search"));
                        baseConstraints.push(where("nama_search", ">=", termNama));
                        baseConstraints.push(where("nama_search", "<=", termNama + "\uf8ff"));
                    }
                } else if (isFilteringDate) {
                    if (filterStartDate.value) {
                        const startDate = new Date(filterStartDate.value);
                        startDate.setHours(0, 0, 0, 0);
                        baseConstraints.push(where("created_at", ">=", startDate));
                    }
                    if (filterEndDate.value) {
                        const endDate = new Date(filterEndDate.value);
                        endDate.setHours(23, 59, 59, 999);
                        baseConstraints.push(where("created_at", "<=", endDate));
                    }
                    baseConstraints.push(orderBy("created_at", "desc"));
                } else {
                    baseConstraints.push(orderBy("created_at", "desc"));
                }

                // Ambil maksimal 1000 data agar tidak memberatkan browser
                const q = query(collRef, ...baseConstraints, limit(1000));
                const snap = await getDocs(q);

                if (snap.empty) {
                    return showToast("Tidak ada data untuk diexport", 'warning');
                }

                const exportData = snap.docs.map(d => {
                    const data = d.data();
                    let tmtJabatan = data.tmt_jabatan || '-';
                    let tmtPangkat = data.tmt_pangkat_golongan || '-';

                    return {
                        NIP: "'" + (data.nip || ''),
                        NAMA: data.nama || '',
                        "UNIT KERJA": data.unit_kerja || '',
                        "PERANGKAT DAERAH": data.perangkat_daerah || '',
                        PANGKAT: data.pangkat_golongan || '',
                        TMT_PANGKAT: tmtPangkat,
                        JABATAN_LAMA: data.jabatan_lama || '-',
                        JABATAN_BARU: data.jabatan_baru || '',
                        TMT_JABATAN: tmtJabatan,
                        ANGKA_KREDIT: data.angka_kredit || '-',
                        TUNJANGAN: data.tunjangan || 0,
                        STATUS: data.status || 'DRAFT',
                        NOMOR_SK: data.nomor_naskah || '-'
                    };
                });

                const ws = XLSX.utils.json_to_sheet(exportData);
                const keys = Object.keys(exportData[0] || {});
                ws['!cols'] = keys.map(() => ({ wch: 20 })); // Auto width

                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Data SK Fungsional");

                XLSX.writeFile(wb, `Export_SK_Fungsional_${new Date().toISOString().split('T')[0]}.xlsx`);
                showToast("File Excel berhasil diunduh", 'success');

            } catch (error) {
                console.error("Export Error:", error);
                if (error.code === 'failed-precondition' || (error.message && error.message.includes('index'))) {
                    const link = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                    if (link) {
                        console.warn("Index Required:", link[0]);
                        showToast("Perlu Index Database Baru. Cek Console (F12) untuk Link.", 'info');
                        window.open(link[0], '_blank');
                    } else {
                        showToast("Perlu Index Database (Cek Console)", 'warning');
                    }
                } else {
                    showToast("Gagal export data: " + error.message, 'error');
                }
            }
        };

        // ============================================================
        // LIFECYCLE
        // ============================================================
        onMounted(() => {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    initRefs();
                    fetchTable(1);
                } else {
                    listData.value = [];
                }
            });
            // Dengarkan data balik dari bookmarklet SIASN
            window.addEventListener('message', handleSIASNMessage);
        });

        // ============================================================
        // RETURN
        // ============================================================
        return {
            // Tabel
            listData, tableLoading, tableSearch,
            currentPage, isLastPage, itemsPerPage,
            filterStartDate, filterEndDate,
            totalItems, totalPages, visiblePages,
            expandedRows, toggleRow, isExpanded,

            // Modal
            showModal, showPreviewModal, previewLoading,
            currentPreviewItem, previewTab,
            isEditMode, isSaving, isSearching, searchMsg,

            // Form & Master Data
            form, listGolongan, listPejabat, pejabatTerpilih,
            opsiTunjangan,

            // Actions
            fetchTable, goToPage,
            openModal, closeModal,
            simpanData, hapusData,
            updateStatus, downloadExcel,
            handleNipInput, handleGolonganChange, handlePejabatChange, handleJabatanBaruSelect,

            // Preview & Download
            previewSK, closePreview, downloadFromPreview, cetakSK,
            changePreviewTab,

            // Srikandi
            openSrikandi,

            // SIASN
            cekSIASN, copyBookmarkletSIASN,

            // Utils
            formatTanggal,
        };
    }
};
