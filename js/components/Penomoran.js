import { ref, reactive, onMounted, computed, nextTick } from 'vue';
import { 
    db, auth, collection, getDocs, getDoc, doc, query, orderBy, where, 
    serverTimestamp, runTransaction, updateDoc, deleteDoc, setDoc 
} from '../firebase.js';
import { showToast, showConfirm, formatTanggal, formatRupiah } from '../utils.js';
import { store } from '../store.js';

// IMPORT VIEW
import { TplPenomoran } from '../views/PenomoranView.js';

export default {
    template: TplPenomoran,
    setup() {
        const listData = ref([]);
        const listUsulan = ref([]);
        const loading = ref(true);
        const showModal = ref(false);
        const isSaving = ref(false);
        
        const isEditMode = ref(false);
        const editId = ref(null);
        const oldUsulanId = ref(null);

        const showPreviewModal = ref(false);
        const previewLoading = ref(false);
        const currentPreviewItem = ref(null);
        const previewTab = ref('BASAH');

        const form = reactive({
            usulan_id: '',
            nama_pegawai: '',
            nip: '',
            jenis_jabatan: 'Fungsional',
            golongan: '',
            tahun: new Date().getFullYear(),
            nomor_custom: '',
            no_urut: 0 
        });

        const yearOptions = computed(() => {
            const current = new Date().getFullYear();
            return Array.from({ length: 6 }, (_, i) => current + i);
        });

        const fetchData = async () => {
            loading.value = true;
            try {
                const q = query(collection(db, "nomor_surat"), orderBy("created_at", "desc"));
                const snap = await getDocs(q);
                listData.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) { console.error(e); } 
            finally { loading.value = false; }
        };

        const fetchUsulanList = async () => {
            try {
                let constraints = [orderBy("created_at", "desc")];
                if (!store.isAdmin && auth.currentUser) {
                    constraints.push(where("created_by", "==", auth.currentUser.uid));
                }

                const q = query(collection(db, "usulan_kgb"), ...constraints);
                const snap = await getDocs(q);
                
                listUsulan.value = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
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

        // --- INISIALISASI SELECT2 (PENTING) ---
        const initSelect2 = () => {
            // Tunggu DOM Render (karena v-if modal)
            setTimeout(() => {
                const $select = $('#selectUsulan');
                
                // Hancurkan jika sudah ada (untuk refresh)
                if ($select.hasClass("select2-hidden-accessible")) {
                    $select.select2('destroy');
                }

                $select.select2({
                    theme: 'bootstrap-5', // Gunakan tema bootstrap 5
                    dropdownParent: $('.modal'), // Agar bisa dicari/fokus di dalam modal
                    width: '85%' // Sesuaikan lebar
                });

                // Set Value jika ada (mode edit)
                if(form.usulan_id) {
                    $select.val(form.usulan_id).trigger('change.select2');
                } else {
                    $select.val('').trigger('change.select2');
                }

                // EVENT LISTENER: Saat user memilih di Select2
                $select.off('change').on('change', function (e) {
                    const val = $(this).val();
                    form.usulan_id = val;
                    handleUsulanChange(); // Panggil fungsi Vue
                });

            }, 200); // Delay 200ms agar modal muncul dulu
        };

        // --- HITUNG NOMOR ---
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
            } catch (e) { showToast("Gagal hitung: " + e.message, 'error'); }
        };

        // --- SIMPAN FINAL ---
        const simpanFinal = async () => {
            if (!form.nomor_custom) return showToast("Nomor belum diisi!", 'warning');
            isSaving.value = true;

            try {
                if (isEditMode.value) {
                    await runTransaction(db, async (transaction) => {
                        const logRef = doc(db, "nomor_surat", editId.value);
                        transaction.update(logRef, {
                            usulan_id: form.usulan_id,
                            nama_pegawai: form.nama_pegawai,
                            nip: form.nip,
                        });
                        if (oldUsulanId.value && oldUsulanId.value !== form.usulan_id) {
                            const oldRef = doc(db, "usulan_kgb", oldUsulanId.value);
                            transaction.update(oldRef, { nomor_naskah: null, tanggal_naskah: null });
                        }
                        const newRef = doc(db, "usulan_kgb", form.usulan_id);
                        transaction.update(newRef, { 
                            nomor_naskah: form.nomor_custom,
                            tanggal_naskah: serverTimestamp()
                        });
                    });
                    showToast("Data Nomor berhasil diperbarui!", 'success');
                } 
                else {
                    const counterId = `${form.tahun}_${form.jenis_jabatan.toUpperCase()}`;
                    const counterRef = doc(db, "counters_nomor", counterId);
                    
                    const parts = form.nomor_custom.split('/');
                    let currentUrut = 0;
                    if(parts.length > 2 && !isNaN(parts[2])) { currentUrut = parseInt(parts[2]); }

                    const snapCount = await getDoc(counterRef);
                    let dbCount = 0;
                    if (snapCount.exists()) dbCount = snapCount.data().count;

                    if (currentUrut > dbCount) {
                        await setDoc(counterRef, { count: currentUrut }, { merge: true });
                    }

                    await setDoc(doc(collection(db, "nomor_surat")), {
                        usulan_id: form.usulan_id,
                        nama_pegawai: form.nama_pegawai,
                        nip: form.nip,
                        jenis_jabatan: form.jenis_jabatan,
                        tahun: form.tahun,
                        golongan: form.golongan,
                        no_urut: currentUrut,
                        nomor_lengkap: form.nomor_custom,
                        created_at: serverTimestamp()
                    });

                    await updateDoc(doc(db, "usulan_kgb", form.usulan_id), {
                        nomor_naskah: form.nomor_custom,
                        tanggal_naskah: serverTimestamp()
                    });
                    showToast("Nomor berhasil disimpan!", 'success');
                }

                closeModal();
                fetchData();

            } catch (e) {
                console.error(e);
                showToast("Gagal simpan: " + e.message, 'error');
            } finally { isSaving.value = false; }
        };

        const editNomor = async (item) => {
            isEditMode.value = true;
            editId.value = item.id;
            oldUsulanId.value = item.usulan_id;

            form.usulan_id = item.usulan_id;
            form.nama_pegawai = item.nama_pegawai;
            form.nip = item.nip;
            form.jenis_jabatan = item.jenis_jabatan;
            form.golongan = item.golongan;
            form.tahun = item.tahun;
            form.nomor_custom = item.nomor_lengkap;
            form.no_urut = item.no_urut;

            await fetchUsulanList(); // Fetch dulu
            showModal.value = true;
            initSelect2(); // Init Select2 setelah modal terbuka
        };

        const hapusNomor = async (item) => {
            if (await showConfirm('Batalkan Nomor?', 'Jika nomor terakhir, counter akan mundur.')) {
                try {
                    const counterId = `${item.tahun}_${item.jenis_jabatan.toUpperCase()}`;
                    const counterRef = doc(db, "counters_nomor", counterId);
                    
                    await runTransaction(db, async (transaction) => {
                        const counterDoc = await transaction.get(counterRef);
                        if (counterDoc.exists()) {
                            const currentMax = counterDoc.data().count;
                            if (Number(currentMax) === Number(item.no_urut)) {
                                transaction.update(counterRef, { count: currentMax - 1 });
                            }
                        }
                        const logRef = doc(db, "nomor_surat", item.id);
                        transaction.delete(logRef);
                        if(item.usulan_id) {
                            const usulanRef = doc(db, "usulan_kgb", item.usulan_id);
                            transaction.update(usulanRef, { nomor_naskah: null, tanggal_naskah: null });
                        }
                    });

                    fetchData();
                    showToast("Nomor dibatalkan.");
                } catch (e) { console.error(e); showToast(e.message, 'error'); }
            }
        };

    // VERSI KHUSUS PENOMORAN.JS (Memakai usulanId)
        const generateDocBlob = async (usulanId) => {
            if (!window.PizZip || !window.docxtemplater) throw new Error("Library Cetak Error");
            
            // 1. FETCH DATA LENGKAP DULU (Karena di tabel penomoran datanya tidak lengkap)
            const snap = await getDoc(doc(db, "usulan_kgb", usulanId));
            if(!snap.exists()) throw new Error("Data Usulan tidak ditemukan!");
            const item = snap.data(); // <--- Ini data lengkapnya

            // 2. Fetch Template & Config
            const tplId = item.tipe_asn === 'PPPK' ? "PPPK" : "PNS"; 
            const ts = await getDoc(doc(db, "config_template", tplId)); 
            if(!ts.exists()) throw new Error("Template Belum Diupload!");
            
            const url = ts.data().url || `./templates/${ts.data().nama_file}`;
            const gv = await getDoc(doc(db, "config_template", "GLOBAL_VARS")); 
            const gvd = gv.exists() ? gv.data() : {};
            
            // 3. Logic Kop
            const golKode = item.golongan || "";
            const isSetda = item.tipe_asn === 'PNS' && (golKode.startsWith('IV') || golKode.startsWith('4'));

            let kopT='', kopA=''; 
            if (isSetda) { kopT = gvd.kop_setda?.judul; kopA = gvd.kop_setda?.alamat; } 
            else { kopT = gvd.kop_bkpsdmd?.judul; kopA = gvd.kop_bkpsdmd?.alamat; }

            // 4. Logic Pejabat
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
            
            // 5. Logic TTE vs BASAH (Update Terbaru: Tanggal & Sifat)
            let ttdContent = "";
            let sifatSurat = "Biasa"; 
            let tanggalSurat = ""; // Variabel baru

            if (previewTab.value === 'TTE') {
                // TTE: Placeholder Srikandi
                sifatSurat = "Biasa";
                ttdContent = "\n\n\n${ttd_pengirim}\n\n\n\n\n"; 
                tanggalSurat = "${tanggal_naskah}"; // Placeholder Tanggal Srikandi
            } else {
                // BASAH: Tanggal Database / Hari Ini
                sifatSurat = "Biasa";
                ttdContent = "\n\n\n\n"; 
                // Jika sudah ada tanggal di DB pakai itu, jika null pakai hari ini
                const dateObj = item.tanggal_naskah ? item.tanggal_naskah.toDate() : new Date();
                tanggalSurat = formatTanggal(dateObj);
            }

            // 6. Render
            const mapH = gvd.dasar_hukum || []; const foundH = mapH.find(h => h.judul === item.dasar_hukum); const textHukum = foundH ? foundH.isi : (item.dasar_hukum || "-");
            const toTitle = (s) => s ? s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
            const twoDigits = (val) => (val||0).toString().padStart(2, '0');

            const res = await fetch(url); const buf = await res.arrayBuffer();
            const zip = new window.PizZip(buf);
            const docRender = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: (p) => p.value.startsWith('$') ? `{${p.value}}` : "" });

            docRender.render({
                NAMA: item.nama || "", Nama: item.nama || "", nama: item.nama || "",
                NIP: item.nip || "", Nip: item.nip || "", nip: item.nip || "",
                PANGKAT: item.pangkat || "", Pangkat: item.pangkat || "",
                JABATAN: item.jabatan || "", Jabatan: item.jabatan || "",
                UNIT_KERJA: toTitle(item.unit_kerja), Unit_Kerja: toTitle(item.unit_kerja),
                UNIT_KERJA_INDUK: toTitle(item.perangkat_daerah),
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
                
                // MENGGUNAKAN LOGIC BARU
                TANGGAL_NASKAH: tanggalSurat, 
                
                SIFAT: sifatSurat, TTD_PENGIRIM: ttdContent, 
                JABATAN_PEJABAT: pjj, PANGKAT_PEJABAT: pjp, JABATAN_PEJABAT_TTD: pjj || "${jabatan_pejabat_ttd}", 
                NAMA_PENGIRIM: pjn || "${nama_pengirim}", NIP_PENGIRIM: pjnip || "${nip_pengirim}"
            });

            return docRender.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE", compressionOptions: { level: 7 } });
        };

        const previewSK = async (logItem) => {
            if (!window.docx) return showToast("Library Preview belum dimuat!", 'error');
            showPreviewModal.value = true;
            previewLoading.value = true;
            currentPreviewItem.value = logItem;
            previewTab.value = 'BASAH'; 
            await renderCurrentPreview();
        };

        const changePreviewTab = async (tabName) => {
            previewTab.value = tabName;
            previewLoading.value = true;
            await renderCurrentPreview();
        };

        const renderCurrentPreview = async () => {
            try {
                if(!currentPreviewItem.value) return;
                const blob = await generateDocBlob(currentPreviewItem.value.usulan_id);
                const container = document.getElementById('docx-preview-container');
                if(container) { container.innerHTML = ''; await window.docx.renderAsync(blob, container); }
            } catch (e) { console.error(e); showToast("Gagal Preview: " + e.message, 'error'); } 
            finally { previewLoading.value = false; }
        };

        const downloadFromPreview = async () => {
            if(currentPreviewItem.value) await cetakSK(currentPreviewItem.value);
        };

        const closePreview = () => { showPreviewModal.value = false; currentPreviewItem.value = null; };

        const cetakSK = async (logItem) => {
            try {
                showToast("Menyiapkan download...", 'info');
                const blob = await generateDocBlob(logItem.usulan_id);
                const prefix = previewTab.value === 'TTE' ? 'DRAFT_TTE_' : 'SK_';
                const safeName = (logItem.nama_pegawai || 'doc').replace(/[^a-zA-Z0-9]/g,'_');
                window.saveAs(blob, `${prefix}KGB_${safeName}.docx`);
            } catch(e) { console.error(e); showToast("Gagal: " + e.message, 'error'); }
        };

        const openModal = async () => {
            isEditMode.value = false; 
            editId.value = null;
            oldUsulanId.value = null;
            
            form.usulan_id = '';
            form.nama_pegawai = '';
            form.nip = '';
            form.jenis_jabatan = 'Fungsional';
            form.golongan = '';
            form.tahun = new Date().getFullYear();
            form.nomor_custom = '';
            form.no_urut = 0;
            
            await fetchUsulanList(); 
            showModal.value = true;
            initSelect2(); // Init Select2 saat modal baru dibuka
        };
        const closeModal = () => showModal.value = false;

        onMounted(() => { fetchData(); });

        return {
            listData, listUsulan, loading, showModal, isSaving, form, isEditMode,
            yearOptions, previewTab,
            fetchUsulanList, handleUsulanChange, 
            previewNomor, simpanFinal, hapusNomor, editNomor,
            openModal, closeModal,
            previewSK, cetakSK, downloadFromPreview, closePreview, changePreviewTab,
            showPreviewModal, previewLoading
        };
    }
};