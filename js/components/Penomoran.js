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

// --- KOMPONEN AUTOCOMPLETE MANUAL ---
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
                item.nama_snapshot.toLowerCase().includes(term) || 
                item.nip.includes(term)
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
        const previewTab = ref('BASAH');

        // CHECK NUMBER STATE
        const customNumberStatus = ref(null);
        const customNumberMsg = ref('');

        const form = reactive({
            usulan_id: '', nama_pegawai: '', nip: '', jenis_jabatan: 'Fungsional',
            golongan: '', tahun: new Date().getFullYear(), nomor_custom: '', no_urut: 0 
        });

        const yearOptions = computed(() => {
            const current = new Date().getFullYear();
            return Array.from({ length: 6 }, (_, i) => current + i);
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

        const fetchData = async (pageTarget) => {
            loading.value = true;
            try {
                const collRef = collection(db, "nomor_surat");
                const limitVal = parseInt(itemsPerPage.value) || 10;
                let q;

                const constraints = [];
                // FILTER TANGGAL
                if (filterStartDate.value) {
                    const start = new Date(filterStartDate.value);
                    constraints.push(where("created_at", ">=", start));
                }
                if (filterEndDate.value) {
                    const end = new Date(filterEndDate.value);
                    end.setHours(23, 59, 59); // Sampai akhir hari
                    constraints.push(where("created_at", "<=", end));
                }

                if (pageTarget === 1 || pageTarget === 'first') {
                    const snapshotCount = await getCountFromServer(query(collRef, ...constraints));
                    totalItems.value = snapshotCount.data().count;
                    pageStack.value = [];
                    currentPage.value = 1;
                }

                if (tableSearch.value.trim()) {
                    // Search Mode (Client side filter on top 50 matches)
                    const qAll = query(collRef, ...constraints, orderBy("created_at", "desc"), limit(50));
                    const snap = await getDocs(qAll);
                    const term = tableSearch.value.toLowerCase();
                    listData.value = snap.docs.map(mapDoc).filter(d => 
                        (d.nomor_lengkap||'').toLowerCase().includes(term) || 
                        (d.nama_pegawai||'').toLowerCase().includes(term)
                    );
                } else {
                    // Pagination Mode
                    if (typeof pageTarget === 'number') {
                        if (pageTarget === 1) {
                            q = query(collRef, ...constraints, orderBy("created_at", "desc"), limit(limitVal));
                            currentPage.value = 1;
                            pageStack.value = [];
                        } else {
                            if (pageTarget === currentPage.value + 1) {
                                const lastDoc = pageStack.value[pageStack.value.length - 1];
                                q = query(collRef, ...constraints, orderBy("created_at", "desc"), startAfter(lastDoc), limit(limitVal));
                                currentPage.value = pageTarget;
                            } 
                            else if (pageTarget === currentPage.value - 1) {
                                const cursorIndex = pageTarget - 2;
                                if (cursorIndex < 0) {
                                    q = query(collRef, ...constraints, orderBy("created_at", "desc"), limit(limitVal));
                                    pageStack.value = [];
                                } else {
                                    const cursor = pageStack.value[cursorIndex];
                                    q = query(collRef, ...constraints, orderBy("created_at", "desc"), startAfter(cursor), limit(limitVal));
                                    pageStack.value = pageStack.value.slice(0, cursorIndex + 1);
                                }
                                currentPage.value = pageTarget;
                            } else {
                                fetchTable(1); // Reset if jump too far
                                return;
                            }
                        }
                    } else {
                        q = query(collRef, ...constraints, orderBy("created_at", "desc"), limit(limitVal));
                        currentPage.value = 1;
                        pageStack.value = [];
                    }

                    const snap = await getDocs(q);
                    listData.value = snap.docs.map(mapDoc);

                    if (snap.docs.length > 0) {
                        if (currentPage.value === 1) {
                            pageStack.value = [snap.docs[snap.docs.length - 1]];
                        } else if (pageStack.value.length < currentPage.value) {
                            pageStack.value.push(snap.docs[snap.docs.length - 1]);
                        }
                    }
                }
            } catch (e) { console.error(e); } 
            finally { loading.value = false; }
        };

        const goToPage = (p) => {
            if (p < 1 || p > totalPages.value || p === currentPage.value) return;
            if (p === currentPage.value + 1 || p === currentPage.value - 1) fetchData(p);
            else fetchData(1);
        };

        // Watch search debounce
        watch(tableSearch, debounce(() => fetchData(1), 800));

        const fetchUsulanList = async () => {
            try {
                let constraints = [orderBy("created_at", "desc")];
                if (!store.isAdmin && auth.currentUser) {
                    constraints.push(where("created_by", "==", auth.currentUser.uid));
                }
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
                    if (j.includes('struktural')) form.jenis_jabatan = 'Struktural';
                    else form.jenis_jabatan = 'Fungsional';
                }
            }
        };

        const checkCustomNumber = debounce(async (nomor) => {
            if (!nomor) { customNumberStatus.value = null; customNumberMsg.value = ''; return; }
            customNumberStatus.value = 'checking'; customNumberMsg.value = 'Mengecek...';
            try {
                const q = query(collection(db, "nomor_surat"), where("nomor_lengkap", "==", nomor));
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
            } catch (e) { console.error(e); customNumberStatus.value = 'invalid'; customNumberMsg.value = 'Gagal cek.'; }
        }, 800);

        watch(() => form.nomor_custom, (newVal) => checkCustomNumber(newVal));

        const previewNomor = async () => {
            if (!form.usulan_id) return showToast("Pilih usulan dulu!", 'warning');
            try {
                const counterId = `${form.tahun}_${form.jenis_jabatan.toUpperCase()}`;
                const counterRef = doc(db, "counters_nomor", counterId);
                const snap = await getDoc(counterRef);
                let nextCount = 1;
                if (snap.exists()) { nextCount = snap.data().count + 1; }
                const golRomawi = form.golongan ? form.golongan.split('/')[0] : '';
                const noUrutStr = String(nextCount).padStart(4, '0'); 
                form.nomor_custom = `B-800.1.11.13/${golRomawi}/${noUrutStr}/BKPSDMD/${form.tahun}`;
                form.no_urut = nextCount; 
                checkCustomNumber(form.nomor_custom);
            } catch (e) { showToast("Gagal hitung: " + e.message, 'error'); }
        };

        const simpanFinal = async () => {
            if (!form.nomor_custom) return showToast("Nomor belum diisi!", 'warning');
            if (customNumberStatus.value === 'taken') return showToast("Nomor terpakai!", 'error');
            isSaving.value = true;
            try {
                const parts = form.nomor_custom.split('/');
                let currentUrut = 0;
                if(parts.length > 2 && !isNaN(parseInt(parts[2]))) { currentUrut = parseInt(parts[2]); } 
                else { currentUrut = form.no_urut || 0; }

                if (isEditMode.value) {
                    await runTransaction(db, async (transaction) => {
                        const logRef = doc(db, "nomor_surat", editId.value);
                        transaction.update(logRef, {
                            usulan_id: form.usulan_id, nama_pegawai: form.nama_pegawai, nip: form.nip,
                            nomor_lengkap: form.nomor_custom, no_urut: currentUrut
                        });
                        if (oldUsulanId.value && oldUsulanId.value !== form.usulan_id) {
                            const oldRef = doc(db, "usulan_kgb", oldUsulanId.value);
                            transaction.update(oldRef, { nomor_naskah: null, tanggal_naskah: null });
                        }
                        const newRef = doc(db, "usulan_kgb", form.usulan_id);
                        transaction.update(newRef, { nomor_naskah: form.nomor_custom, tanggal_naskah: serverTimestamp() });
                    });
                    showToast("Update berhasil!", 'success');
                } else {
                    const counterId = `${form.tahun}_${form.jenis_jabatan.toUpperCase()}`;
                    const counterRef = doc(db, "counters_nomor", counterId);
                    const snapCount = await getDoc(counterRef);
                    let dbCount = 0;
                    if (snapCount.exists()) dbCount = snapCount.data().count;
                    if (currentUrut > dbCount) { await setDoc(counterRef, { count: currentUrut }, { merge: true }); }

                    await setDoc(doc(collection(db, "nomor_surat")), {
                        usulan_id: form.usulan_id, nama_pegawai: form.nama_pegawai, nip: form.nip,
                        jenis_jabatan: form.jenis_jabatan, tahun: form.tahun, golongan: form.golongan,
                        no_urut: currentUrut, nomor_lengkap: form.nomor_custom, created_at: serverTimestamp()
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
            if (await showConfirm('Batalkan Nomor?', 'Counter akan mundur jika nomor terakhir.')) {
                try {
                    const counterId = `${item.tahun}_${item.jenis_jabatan.toUpperCase()}`;
                    const counterRef = doc(db, "counters_nomor", counterId);
                    await runTransaction(db, async (transaction) => {
                        const counterDoc = await transaction.get(counterRef);
                        if (counterDoc.exists()) {
                            if (Number(counterDoc.data().count) === Number(item.no_urut)) {
                                transaction.update(counterRef, { count: Number(item.no_urut) - 1 });
                            }
                        }
                        transaction.delete(doc(db, "nomor_surat", item.id));
                        if(item.usulan_id) transaction.update(doc(db, "usulan_kgb", item.usulan_id), { nomor_naskah: null, tanggal_naskah: null });
                    });
                    fetchData(1); showToast("Dibatalkan.");
                } catch (e) { console.error(e); showToast(e.message, 'error'); }
            }
        };

        const generateDocBlob = async (usulanId) => {
            if (!window.PizZip || !window.docxtemplater) throw new Error("Library Cetak Error");
            
            const snap = await getDoc(doc(db, "usulan_kgb", usulanId));
            if(!snap.exists()) throw new Error("Data Usulan tidak ditemukan!");
            const item = snap.data();

            // --- [FIX] AMBIL PANGKAT DARI MASTER GOLONGAN ---
            let pangkatFinal = item.pangkat || ""; 
            if (item.golongan) {
                try {
                    const qPkt = query(collection(db, "master_golongan"), where("kode", "==", item.golongan));
                    const snapPkt = await getDocs(qPkt);
                    if (!snapPkt.empty) {
                        const d = snapPkt.docs[0].data();
                        if(d.pangkat) pangkatFinal = d.pangkat;
                    }
                } catch (e) { 
                    console.error("Gagal load pangkat", e);
                }
            }
            // --------------------------------------------------

            const tplId = item.tipe_asn === 'PPPK' ? "PPPK" : "PNS"; 
            const ts = await getDoc(doc(db, "config_template", tplId)); 
            if(!ts.exists()) throw new Error("Template Belum Diupload!");
            
            const url = ts.data().url || `./templates/${ts.data().nama_file}`;
            const gv = await getDoc(doc(db, "config_template", "GLOBAL_VARS")); 
            const gvd = gv.exists() ? gv.data() : {};
            
            const golKode = item.golongan || "";
            const isSetda = item.tipe_asn === 'PNS' && (golKode.startsWith('IV') || golKode.startsWith('4'));

            let kopT='', kopA=''; 
            if (isSetda) { kopT = gvd.kop_setda?.judul; kopA = gvd.kop_setda?.alamat; } 
            else { kopT = gvd.kop_bkpsdmd?.judul; kopA = gvd.kop_bkpsdmd?.alamat; }

            let targetNip = item.pejabat_baru_nip;
            if (!targetNip) {
                if (isSetda) targetNip = gvd.kop_setda?.pejabat_nip;
                else targetNip = gvd.kop_bkpsdmd?.pejabat_nip;
            }

            let pjp = item.pejabat_baru_pangkat || "";
            let pjj = item.pejabat_baru_nama || "BUPATI BANGKA";
            let pjn = ""; let pjnip = ""; 

            if (targetNip) { 
                const ps = await getDoc(doc(db, "master_pejabat", targetNip)); 
                if(ps.exists()){ 
                    const d = ps.data();
                    pjp = d.pangkat || pjp; 
                    pjj = d.jabatan || pjj; 
                    pjn = d.nama || ""; 
                    pjnip = d.nip || "";
                } 
            }
            
            let ttdContent = "";
            let sifatSurat = "Biasa"; 
            let tanggalSurat = ""; 

            if (previewTab.value === 'TTE') {
                sifatSurat = "Biasa";
                ttdContent = "\n\n\n${ttd_pengirim}\n\n\n\n\n"; 
                tanggalSurat = "${tanggal_naskah}"; 
            } else {
                sifatSurat = "Biasa";
                ttdContent = "\n\n\n\n"; 
                const dateObj = item.tanggal_naskah ? item.tanggal_naskah.toDate() : new Date();
                tanggalSurat = formatTanggal(dateObj);
            }

            const mapH = gvd.dasar_hukum || []; const foundH = mapH.find(h => h.judul === item.dasar_hukum); const textHukum = foundH ? foundH.isi : (item.dasar_hukum || "-");
            const toTitle = (s) => s ? s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
            const twoDigits = (val) => (val||0).toString().padStart(2, '0');

            const res = await fetch(url); const buf = await res.arrayBuffer();
            const zip = new window.PizZip(buf);
            const docRender = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: (p) => p.value.startsWith('$') ? `{${p.value}}` : "" });

            docRender.render({
                NAMA: item.nama || "", Nama: item.nama || "", nama: item.nama || "",
                NIP: item.nip || "", Nip: item.nip || "", nip: item.nip || "",
                
                // [FIX] Gunakan variabel pangkatFinal yang sudah dicari di atas
                PANGKAT: pangkatFinal, Pangkat: pangkatFinal,
                
                JABATAN: item.jabatan || "", Jabatan: item.jabatan || "",
                UNIT_KERJA: item.unit_kerja, Unit_Kerja: item.unit_kerja,
                UNIT_KERJA_INDUK: item.perangkat_daerah,
                TGL_LAHIR: formatTanggal(item.tgl_lahir),
                GOLONGAN: item.golongan || "", DALAM_GOLONGAN: item.golongan || "",
                DASAR_NOMOR: item.dasar_nomor || "-", NOMOR: item.dasar_nomor || "-",
                DASAR_TANGGAL: formatTanggal(item.dasar_tanggal),
                DASAR_PEJABAT: item.dasar_pejabat || "-", PEJABAT_LAMA: item.dasar_pejabat || "-", OLEH_PEJABAT: item.dasar_pejabat || "-",
                DASAR_TMT: formatTanggal(item.dasar_tmt),
                DASAR_GAJI_LAMA: formatRupiah(item.dasar_gaji_lama),
                DASAR_MK_LAMA: `${twoDigits(item.dasar_mk_tahun)} Tahun ${twoDigits(item.dasar_mk_bulan)} Bulan`,
                DASAR_HUKUM: textHukum, KONSIDERANS: textHukum,
                MK_BARU: `${twoDigits(item.mk_baru_tahun)} Tahun ${twoDigits(item.mk_baru_bulan)} Bulan`,
                GAJI_BARU: formatRupiah(item.gaji_baru),
                TMT_SEKARANG: formatTanggal(item.tmt_sekarang),
                TMT_SELANJUTNYA: formatTanggal(item.tmt_selanjutnya),
                MASA_PERJANJIAN_KERJA: item.masa_perjanjian || "-",
                PERPANJANGAN_PERJANJIAN_KERJA: item.perpanjangan_perjanjian || "-",
                KOP: kopT, ALAMAT_KOP: kopA,
                NOMOR_NASKAH: item.nomor_naskah || "....................", 
                TANGGAL_NASKAH: tanggalSurat, 
                SIFAT: sifatSurat, TTD_PENGIRIM: ttdContent, 
                JABATAN_PEJABAT: pjj, PANGKAT_PEJABAT: pjp, JABATAN_PEJABAT_TTD: pjj || "${jabatan_pejabat_ttd}", 
                NAMA_PENGIRIM: pjn || "${nama_pengirim}", NIP_PENGIRIM: pjnip || "${nip_pengirim}"
            });

            return docRender.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE", compressionOptions: { level: 9 } });
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
            // EXPORT PAGINATION STATES
            currentPage, totalPages, visiblePages, itemsPerPage, totalItems, goToPage, fetchData,
            filterStartDate, filterEndDate, tableSearch
        };
    }
};