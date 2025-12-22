import { ref, reactive, watch, onMounted, computed, nextTick } from 'vue';
import { 
    db, auth, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc,
    query, orderBy, limit, startAfter, where, serverTimestamp, onAuthStateChanged 
} from '../firebase.js';
import { showToast, showConfirm, debounce, formatRupiah, formatTanggal } from '../utils.js';
import { store } from '../store.js';

// --- IMPORT TAMPILAN DARI FOLDER VIEWS ---
import { TplSearchSelect, TplAutocompleteJabatan, TplMain } from '../views/TransaksiKgbView.js';

// --- KOMPONEN 1: SELECT2 ---
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
            emit('update:modelValue', getKey(opt));
            emit('change', opt);
            isOpen.value = false; 
            search.value = '';
        };

        return { isOpen, search, safeOptions, selectedLabel, selectOpt, getKey, getLabel };
    }
};

// --- KOMPONEN 2: AUTOCOMPLETE JABATAN ---
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
                const term = keyword.trim();
                const q = query(collection(db, "master_jabatan"), where("nama_jabatan", ">=", term), where("nama_jabatan", "<=", term + "\uf8ff"), limit(5));
                const snap = await getDocs(q);
                suggestions.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {}
        }, 800);

        const handleInput = (e) => { 
            emit('update:modelValue', e.target.value); 
            fetchSuggestions(e.target.value); 
            showSuggestions.value = true; 
        };
        
        const selectItem = (item) => { 
            emit('update:modelValue', item.nama_jabatan); 
            emit('select', item); 
            showSuggestions.value = false; 
        };
        
        const delayHide = () => setTimeout(() => showSuggestions.value = false, 200);
        
        return { showSuggestions, suggestions, handleInput, selectItem, delayHide };
    }
};

// --- MAIN COMPONENT ---
export default {
    components: { SearchSelect, AutocompleteJabatan },
    template: TplMain, 
    setup() {
        const listData = ref([]);
        const tableLoading = ref(true);
        const tableSearch = ref('');
        const currentPage = ref(1);
        const isLastPage = ref(false);
        const pageStack = ref([]);
        
        const showModal = ref(false);
        const showPreviewModal = ref(false);
        const previewLoading = ref(false);
        const currentPreviewItem = ref(null);
        // [NEW] State Tab Preview
        const previewTab = ref('BASAH');

        const isEditMode = ref(false);
        const isSaving = ref(false);
        const isSearching = ref(false);
        const searchMsg = ref('');
        const gajiMsg = ref('');
        const formId = ref(null);
        
        const listGolongan = ref([]); 
        const listDasarHukum = ref([]);
        const listPejabat = ref([]); 
        const configPejabat = reactive({ setda: null, bkpsdmd: null });
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

        // --- WATCHER ---
        watch(() => form.dasar_hukum, (newVal) => {
            if (!newVal || listDasarHukum.value.length === 0) return;
            const selectedMaster = listDasarHukum.value.find(item => item.judul === newVal);
            if (selectedMaster) {
                if (selectedMaster.pejabat) form.dasar_pejabat = selectedMaster.pejabat;
                if (selectedMaster.nomor && !form.dasar_nomor) form.dasar_nomor = selectedMaster.nomor;
            }
        });

        // --- FETCH TABLE ---
        const mapDoc = (d) => {
            const data = d.data();
            data.id = d.id; 
            if (data.tgl_teken && data.tgl_teken.toDate) {
                data.tgl_teken_formatted = formatTanggal(data.tgl_teken.toDate().toISOString().split('T')[0]);
            }
            if (data.tgl_distribusi && data.tgl_distribusi.toDate) {
                data.tgl_distribusi_formatted = formatTanggal(data.tgl_distribusi.toDate().toISOString().split('T')[0]);
            }
            return data;
        };

        const fetchTable = async (direction = 'first') => {
            tableLoading.value = true;
            try {
                let q; const collRef = collection(db, "usulan_kgb"); const itemsPerPage = 10;
                const constraints = [];
                if (!store.isAdmin && auth.currentUser) constraints.push(where("created_by", "==", auth.currentUser.uid));

                if (tableSearch.value.trim()) {
                    const qAll = query(collRef, ...constraints, orderBy("created_at", "desc"), limit(50));
                    const snap = await getDocs(qAll);
                    const term = tableSearch.value.toLowerCase();
                    listData.value = snap.docs.map(mapDoc)
                        .filter(d => (d.nama||'').toLowerCase().includes(term) || (d.nip||'').includes(term));
                    isLastPage.value = true;
                } else {
                    if (direction === 'first') { q = query(collRef, ...constraints, orderBy("created_at", "desc"), limit(itemsPerPage)); pageStack.value = []; currentPage.value = 1; }
                    else if (direction === 'next') { const last = pageStack.value[pageStack.value.length - 1]; q = query(collRef, ...constraints, orderBy("created_at", "desc"), startAfter(last), limit(itemsPerPage)); currentPage.value++; }
                    else if (direction === 'prev') { pageStack.value.pop(); const prev = pageStack.value[pageStack.value.length - 1]; q = query(collRef, ...constraints, orderBy("created_at", "desc"), startAfter(prev), limit(itemsPerPage)); currentPage.value--; }
                    const snap = await getDocs(q);
                    listData.value = snap.docs.map(mapDoc);
                    isLastPage.value = snap.docs.length < itemsPerPage;
                    if(direction !== 'prev' && snap.docs.length > 0) pageStack.value.push(snap.docs[snap.docs.length - 1]);
                }
            } catch (e) { console.error(e); } 
            finally { tableLoading.value = false; }
        };
        
        const nextPage = () => fetchTable('next');
        const prevPage = () => fetchTable('prev');
        watch(tableSearch, debounce(() => fetchTable('first'), 800));

        // --- UPDATE STATUS ---
        const statusColor = (status) => {
            if(status === 'TEKEN') return 'btn-warning text-dark';
            if(status === 'DISTRIBUSI') return 'btn-success';
            return 'btn-secondary'; 
        };

        const updateStatus = async (item, newStatus) => {
            if(!item.id) return showToast("Error: ID Dokumen tidak ditemukan", "error");
            try {
                const updateData = { status: newStatus };
                if (newStatus === 'TEKEN') updateData.tgl_teken = serverTimestamp();
                if (newStatus === 'DISTRIBUSI') updateData.tgl_distribusi = serverTimestamp();

                await updateDoc(doc(db, "usulan_kgb", item.id), updateData);
                showToast(`Status diubah: ${newStatus}`);
                
                const index = listData.value.findIndex(d => d.id === item.id);
                if (index !== -1) {
                    listData.value[index].status = newStatus;
                    const today = formatTanggal(new Date().toISOString().split('T')[0]);
                    if (newStatus === 'TEKEN') listData.value[index].tgl_teken_formatted = today;
                    if (newStatus === 'DISTRIBUSI') listData.value[index].tgl_distribusi_formatted = today;
                }
            } catch (e) {
                console.error(e);
                showToast("Gagal ubah status: " + e.message, "error");
            }
        };

        // --- LOAD REFERENSI ---
        const initRefs = async () => {
            const qGol = query(collection(db, "master_golongan"), orderBy("kode"));
            const snapGol = await getDocs(qGol);
            const setGol = new Set();
            listGolongan.value = [];
            snapGol.forEach(d => {
                const data = d.data();
                if(!setGol.has(data.kode + data.tipe)) {
                    setGol.add(data.kode + data.tipe);
                    listGolongan.value.push({ kode: data.kode, pangkat: data.pangkat, tipe: data.tipe, label_full: `${data.kode} - ${data.pangkat}` });
                }
            });

            const qPj = query(collection(db, "master_pejabat"), orderBy("nama"));
            const snapPj = await getDocs(qPj);
            listPejabat.value = snapPj.docs.map(d => d.data());

            const docVars = await getDoc(doc(db, "config_template", "GLOBAL_VARS"));
            if(docVars.exists()) {
                const data = docVars.data();
                if(data.dasar_hukum) listDasarHukum.value = data.dasar_hukum;
                if(data.kop_setda) configPejabat.setda = data.kop_setda.pejabat_nip;
                if(data.kop_bkpsdmd) configPejabat.bkpsdmd = data.kop_bkpsdmd.pejabat_nip;
            }
        };

        // --- GAJI & NIP ---
        const getGaji = async (gol, mk) => { if(!gol) return 0; try{const id=`${gol.replace(/[^a-zA-Z0-9]/g,'').toUpperCase()}_${mk||0}`;const s=await getDoc(doc(db,"master_gaji",id));return s.exists()?s.data().gaji:0;}catch{return 0;} };
        const cariGajiBaru = async () => { form.gaji_baru = await getGaji(form.golongan, form.mk_baru_tahun); if(form.gaji_baru===0) gajiMsg.value='Gaji not found'; else gajiMsg.value=''; };
        const cariGajiLama = async () => { form.dasar_gaji_lama = await getGaji(form.dasar_golongan, form.dasar_mk_tahun); };
        watch(() => [form.golongan, form.mk_baru_tahun], () => debounce(cariGajiBaru, 500)());
        watch(() => [form.dasar_golongan, form.dasar_mk_tahun], () => debounce(cariGajiLama, 500)());

        const extractTglLahir = (nip) => {
            const clean = nip.replace(/\s/g, '');
            if (clean.length < 8) return '';
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
                    
                    // 1. Masukkan data dasar dulu (KECUALI PANGKAT)
                    Object.assign(form, {
                        nama:d.nama, tempat_lahir:d.tempat_lahir||'', tgl_lahir: finalTgl, 
                        perangkat_daerah:d.perangkat_daerah||'', unit_kerja:d.unit_kerja||'', 
                        jabatan:d.jabatan||'', tipe_asn:d.tipe_asn||'PNS',
                        jenis_jabatan: d.jenis_jabatan || 'Pelaksana'
                    });
                    
                    // 2. Proses Golongan (Ini akan mengisi Pangkat secara Default/Standar)
                    if(d.golongan_kode) {
                         form.golongan = d.golongan_kode;
                         handleGolonganChange(d.golongan_kode); 
                    }

                    // 3. [PERBAIKAN] Timpa Pangkat dengan data Asli Pegawai (Prioritas Utama)
                    if (d.pangkat) {
                        form.pangkat = d.pangkat;
                    }

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
            
            // LOGIKA TMT SELANJUTNYA
            // Jika Manual Pensiun dicentang, jangan otomatis hitung TMT
            if (!form.is_pensiun_manual) {
                const next = new Date(tmt); next.setFullYear(next.getFullYear() + 2);
                form.tmt_selanjutnya = next.toISOString().split('T')[0];
            }

            // LOGIKA STATUS PENSIN MSG
            if (form.is_pensiun_manual) { 
                isPensiun.value = true; 
                pensiunMsg.value = "Status: Pensiun (Stop KGB)"; 
            } 
            else if (new Date(form.tmt_selanjutnya) >= pd) { 
                isPensiun.value = true; 
                pensiunMsg.value = `Peringatan: Masuk BUP (${formatTanggal(pd.toISOString())})`; 
            } 
            else { 
                isPensiun.value = false; 
                pensiunMsg.value = `BUP: ${formatTanggal(pd.toISOString())}`; 
            }
            form.tahun_pembuatan = tmt.getFullYear();
        };
        watch(()=>[form.tmt_sekarang,form.tgl_lahir,currentBup.value,form.is_pensiun_manual], checkBup);

        // --- FUNGSI BUTTON STOP ---
        const setTmtPensiun = () => {
            form.tmt_selanjutnya = ''; // Kosongkan tanggal
            form.is_pensiun_manual = true; // Auto centang switch manual
            showToast("TMT Selanjutnya dikosongkan (Pensiun).", "warning");
        };

        const handleJabatanSelect = (item) => {
            form.jabatan=item.nama_jabatan; form.jenis_jabatan = item.jenis_jabatan || 'Pelaksana'; currentBup.value=item.bup||58; checkBup();
        };

        const handleGolonganChange = (kode) => {
            const selected = listGolongan.value.find(g => g.kode === kode);
            if (selected) {
                form.pangkat = selected.pangkat;
                const isHighRank = selected.kode.startsWith('IV') || selected.kode.startsWith('4');
                form.pejabat_baru_nip = isHighRank ? configPejabat.setda : configPejabat.bkpsdmd;
            }
        };

        const openModal = (item=null) => {
            initRefs();
            if(item){ 
                if(!item.id) { showToast("Error: ID Data tidak terbaca", 'error'); return; }
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
                const safeForm = { ...form };
                if (safeForm.jenis_jabatan === undefined) safeForm.jenis_jabatan = 'Pelaksana';
                if (safeForm.golongan === undefined) safeForm.golongan = '';
                if (safeForm.masa_perjanjian === undefined) safeForm.masa_perjanjian = '';
                if (safeForm.perpanjangan_perjanjian === undefined) safeForm.perpanjangan_perjanjian = '';
                delete safeForm.eselon; 

                const payload = { 
                    ...safeForm, 
                    ...pjSnap, 
                    nama_snapshot: form.nama, 
                    jabatan_snapshot: form.jabatan, 
                    creator_email: auth.currentUser.email, 
                    updated_at: serverTimestamp() 
                };
                
                if(isEditMode.value) {
                    if(!formId.value) { showToast("ID hilang, refresh halaman.", 'error'); return; }
                    if (!payload.creator_email) payload.creator_email = auth.currentUser.email;
                    await updateDoc(doc(db,"usulan_kgb",formId.value), payload);
                } else { 
                    payload.created_at=serverTimestamp(); 
                    payload.created_by=auth.currentUser.uid; 
                    payload.creator_email = auth.currentUser.email;
                    payload.status='DRAFT'; 
                    await addDoc(collection(db,"usulan_kgb"), payload); 
                }
                
                await setDoc(doc(db,"master_pegawai",form.nip), {
                    nip:form.nip, nama:form.nama, tempat_lahir:form.tempat_lahir, tgl_lahir:form.tgl_lahir,
                    perangkat_daerah:form.perangkat_daerah, unit_kerja:form.unit_kerja, jabatan:form.jabatan,
                    tipe_asn:form.tipe_asn, jenis_jabatan: safeForm.jenis_jabatan, 
                    pangkat: safeForm.pangkat || '', // Simpan juga pangkat ke master
                    updated_at:serverTimestamp()
                }, {merge:true});
                
                if(form.jabatan) {
                    const jId = form.jabatan.replace(/[^a-zA-Z0-9]/g,'_').toUpperCase();
                    await setDoc(doc(db,"master_jabatan",jId), {kode_jabatan:jId, nama_jabatan:form.jabatan, bup:currentBup.value, updated_at:serverTimestamp()}, {merge:true});
                }
                showToast("Tersimpan!"); closeModal(); fetchTable();
            } catch(e){ console.error(e); showToast(e.message,'error');} finally{isSaving.value=false;}
        };

        // --- PROTEKSI HAPUS ---
        const hapusTransaksi = async(item)=>{ 
            if(!item || !item.id) return showToast("ID Data tidak valid! Refresh halaman.", 'error');
            
            // [NEW] Cek Nomor SK
            if (item.nomor_naskah) return showToast("Gagal! Data sudah memiliki Nomor SK, tidak bisa dihapus.", 'error');

            if(await showConfirm("Hapus?","Data hilang.")) { await deleteDoc(doc(db,"usulan_kgb",item.id)); fetchTable(); } 
        };

        // --- PREVIEW & CETAK (UPDATED: LOGIC COMPLETE + NEXTTICK) ---
        const generateDocBlob = async (item) => {
            if (!window.PizZip || !window.docxtemplater) throw new Error("Library Cetak Error");
            
            const tplId = item.tipe_asn === 'PPPK' ? "PPPK" : "PNS"; 
            const ts = await getDoc(doc(db, "config_template", tplId)); 
            if(!ts.exists()) throw new Error("Template Belum Diupload!");
            
            const url = ts.data().url || `./templates/${ts.data().nama_file}`;
            const gv = await getDoc(doc(db, "config_template", "GLOBAL_VARS")); 
            const gvd = gv.exists() ? gv.data() : {};

            // --- [BARU] AUTO-FIX PANGKAT BY SYSTEM ---
            // Kita cari nama pangkat resmi berdasarkan Golongan, abaikan inputan user yang mungkin salah.
            let pangkatFinal = item.pangkat || ""; 
            if (item.golongan) {
                try {
                    // Cari di Master Golongan: "Siapa yang kodenya III/a?"
                    const qPkt = query(collection(db, "master_golongan"), where("kode", "==", item.golongan));
                    const snapPkt = await getDocs(qPkt);
                    if (!snapPkt.empty) {
                        // Ketemu! Pakai nama pangkat resmi dari master
                        const dataMaster = snapPkt.docs[0].data();
                        if (dataMaster.pangkat) {
                            pangkatFinal = dataMaster.pangkat;
                        }
                    }
                } catch (e) {
                    console.log("Gagal auto-fetch pangkat, menggunakan data inputan.");
                }
            }
            // -----------------------------------------
            
            // 1. Logic Kop & Fallback Pejabat
            const golKode = item.golongan || "";
            const isSetda = item.tipe_asn === 'PNS' && (golKode.startsWith('IV') || golKode.startsWith('4'));

            let kopT='', kopA=''; 
            if (isSetda) { kopT = gvd.kop_setda?.judul; kopA = gvd.kop_setda?.alamat; } 
            else { kopT = gvd.kop_bkpsdmd?.judul; kopA = gvd.kop_bkpsdmd?.alamat; }

            // 2. Logic Target NIP
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
            
            // 3. Logic TTE vs BASAH
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

            // 4. Render
            const mapH = gvd.dasar_hukum || []; const foundH = mapH.find(h => h.judul === item.dasar_hukum); const textHukum = foundH ? foundH.isi : (item.dasar_hukum || "-");
            const toTitle = (s) => s ? s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
            const twoDigits = (val) => (val||0).toString().padStart(2, '0');

            const res = await fetch(url); const buf = await res.arrayBuffer();
            const zip = new window.PizZip(buf);
            const docRender = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: (p) => p.value.startsWith('$') ? `{${p.value}}` : "" });

            docRender.render({
                NAMA: item.nama || "", Nama: item.nama || "", nama: item.nama || "",
                NIP: item.nip || "", Nip: item.nip || "", nip: item.nip || "",
                
                // [PENTING] Menggunakan pangkatFinal hasil pencarian otomatis
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

        const previewSK = async (item) => {
            if (!window.docx) return showToast("Library Preview belum dimuat!", 'error');
            
            showPreviewModal.value = true;
            previewLoading.value = true;
            currentPreviewItem.value = item;
            previewTab.value = 'BASAH'; 
            
            await nextTick(); // [FIXED] Tunggu DOM
            
            await renderCurrentPreview();
        };

        const changePreviewTab = async (tabName) => {
            previewTab.value = tabName;
            previewLoading.value = true;

            await nextTick(); // [FIXED] Tunggu DOM

            await renderCurrentPreview();
        };

        const renderCurrentPreview = async () => {
            try {
                if(!currentPreviewItem.value) return;
                const blob = await generateDocBlob(currentPreviewItem.value);
                const container = document.getElementById('docx-preview-container');
                if(container) { 
                    container.innerHTML = ''; 
                    await window.docx.renderAsync(blob, container); 
                }
            } catch (e) { console.error(e); showToast("Gagal Preview: " + e.message, 'error'); } 
            finally { previewLoading.value = false; }
        };

        const closePreview = () => { showPreviewModal.value = false; currentPreviewItem.value = null; };

        const downloadFromPreview = async () => {
            if(currentPreviewItem.value) cetakSK(currentPreviewItem.value);
        };

        const cetakSK = async (item) => {
            try {
                showToast("Menyiapkan...", 'info');
                const blob = await generateDocBlob(item);
                const prefix = previewTab.value === 'TTE' ? 'DRAFT_TTE_' : 'SK_';
                const safeName = (item.nama || 'doc').replace(/[^a-zA-Z0-9]/g,'_');
                window.saveAs(blob, `${prefix}KGB_${safeName}.docx`);
            } catch(e) { console.error(e); showToast("Gagal: " + e.message, 'error'); }
        };

        onMounted(() => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) fetchTable('first'); else listData.value = [];
            });
        });
        
        return { 
            listData, tableLoading, tableSearch, currentPage, isLastPage, showModal, isEditMode, isSaving, isSearching, searchMsg, gajiMsg,
            form, listGolongan, listDasarHukum, listPejabat, filteredGolongan, currentAge, isPensiun, pensiunMsg,
            nextPage, prevPage, openModal, closeModal, simpanTransaksi, hapusTransaksi, cetakSK, 
            handleNipInput, cariGajiBaru, cariGajiLama, handleGolonganChange, handleJabatanSelect, formatRupiah, formatTanggal,
            showPreviewModal, previewLoading, previewSK, closePreview, downloadFromPreview,
            previewTab, changePreviewTab,
            statusColor, updateStatus,
            // [NEW]
            setTmtPensiun 
        };
    }
};