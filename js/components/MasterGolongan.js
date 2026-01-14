import { ref, reactive, onMounted, computed } from 'vue';
import { 
    db, collection, getDocs, setDoc, deleteDoc, doc, 
    writeBatch, serverTimestamp, query, orderBy 
} from '../firebase.js';
import { showToast, showConfirm } from '../utils.js';

// --- IMPORT VIEW HTML ---
import { TplMasterGolongan } from '../views/MasterGolonganView.js';

export default {
    template: TplMasterGolongan, 
    setup() {
        const listData = ref([]);
        const loading = ref(true);
        const filterTipe = ref('PNS');
        const showModal = ref(false);
        const isEdit = ref(false);
        const isSaving = ref(false);
        const isImporting = ref(false);
        const fileInput = ref(null);

        const form = reactive({ tipe: 'PNS', group: '', kode: '', pangkat: '' });

        // DATA JSON DEFAULT (STANDAR BKN)
        const RAW_DATA = {
          "PNS": {
            "I": { "I/a": "Juru Muda", "I/b": "Juru Muda Tk. I", "I/c": "Juru", "I/d": "Juru Tk. I" },
            "II": { "II/a": "Pengatur Muda", "II/b": "Pengatur Muda Tk. I", "II/c": "Pengatur", "II/d": "Pengatur Tk. I" },
            "III": { "III/a": "Penata Muda", "III/b": "Penata Muda Tk. I", "III/c": "Penata", "III/d": "Penata Tk. I" },
            "IV": { "IV/a": "Pembina", "IV/b": "Pembina Tk. I", "IV/c": "Pembina Utama Muda", "IV/d": "Pembina Utama Madya", "IV/e": "Pembina Utama" }
          },
          "PPPK": {
            "I": { "I": "PPPK Golongan I" }, "II": { "II": "PPPK Golongan II" }, "III": { "III": "PPPK Golongan III" },
            "IV": { "IV": "PPPK Golongan IV" }, "V": { "V": "PPPK Golongan V" }, "VI": { "VI": "PPPK Golongan VI" },
            "VII": { "VII": "PPPK Golongan VII" }, "VIII": { "VIII": "PPPK Golongan VIII" }, "IX": { "IX": "PPPK Golongan IX" },
            "X": { "X": "PPPK Golongan X" }, "XI": { "XI": "PPPK Golongan XI" }, "XII": { "XII": "PPPK Golongan XII" },
            "XIII": { "XIII": "PPPK Golongan XIII" }, "XIV": { "XIV": "PPPK Golongan XIV" }, "XV": { "XV": "PPPK Golongan XV" },
            "XVI": { "XVI": "PPPK Golongan XVI" }, "XVII": { "XVII": "PPPK Golongan XVII" }
          }
        };

        const fetchData = async () => {
            loading.value = true;
            try {
                // Master Golongan biasanya sedikit (< 100), jadi tarik semua masih aman.
                const q = query(collection(db, "master_golongan"), orderBy("kode"));
                const snap = await getDocs(q);
                listData.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) { 
                console.error(e); 
                showToast("Gagal memuat data", 'error');
            } 
            finally { loading.value = false; }
        };

        const filteredList = computed(() => listData.value.filter(item => item.tipe === filterTipe.value));

        // --- 1. FITUR IMPORT EXCEL (CUSTOM DATA) ---
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

                    // HEADER EXCEL: TIPE, KELOMPOK, KODE, PANGKAT
                    const CHUNK = 300;
                    let count = 0;
                    for (let i = 0; i < json.length; i += CHUNK) {
                        const batch = writeBatch(db);
                        json.slice(i, i + CHUNK).forEach(row => {
                            const tipe = row['TIPE'] || row['tipe']; // PNS / PPPK
                            const group = row['KELOMPOK'] || row['kelompok']; // I, II, III
                            const kode = row['KODE'] || row['kode']; // III/a
                            const pangkat = row['PANGKAT'] || row['pangkat']; // Penata Muda

                            if (tipe && kode) {
                                // ID Unik: PNS_IIIA
                                const cleanKode = String(kode).trim();
                                const cleanTipe = String(tipe).toUpperCase().trim();
                                const docId = `${cleanTipe}_${cleanKode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
                                
                                batch.set(doc(db, "master_golongan", docId), {
                                    tipe: cleanTipe,
                                    group: String(group || '').trim(),
                                    kode: cleanKode,
                                    pangkat: String(pangkat || '').trim(),
                                    updated_at: serverTimestamp()
                                }, { merge: true });
                                count++;
                            }
                        });
                        await batch.commit();
                    }
                    showToast(`Import ${count} data sukses!`);
                    fetchData();
                } catch (err) {
                    showToast("Gagal: " + err.message, 'error');
                } finally {
                    isImporting.value = false;
                    event.target.value = '';
                }
            };
            reader.readAsArrayBuffer(file);
        };

        // --- 2. RESET DEFAULT (STANDAR BKN) ---
        const resetDefault = async () => {
            if (!await showConfirm('Reset Data?', 'Database Golongan akan diisi ulang dengan standar BKN. Data lama akan tertimpa/ditambah.')) return;
            isSaving.value = true;
            try {
                const batch = writeBatch(db);
                let count = 0;
                
                for (const [tipe, groups] of Object.entries(RAW_DATA)) {
                    for (const [groupName, codes] of Object.entries(groups)) {
                        for (const [kode, pangkatName] of Object.entries(codes)) {
                            const docId = `${tipe}_${kode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
                            batch.set(doc(db, "master_golongan", docId), {
                                tipe: tipe, 
                                group: groupName, 
                                kode: kode, 
                                pangkat: pangkatName,
                                updated_at: serverTimestamp()
                            });
                            count++;
                        }
                    }
                }
                
                await batch.commit();
                showToast(`Data berhasil di-reset (${count} item)!`);
                fetchData();
            } catch (e) { showToast(e.message, 'error'); } 
            finally { isSaving.value = false; }
        };

        // --- 3. CRUD MANUAL ---
        const simpanData = async () => {
            if(!form.kode || !form.pangkat) return showToast("Kode & Pangkat wajib diisi", 'warning');
            isSaving.value = true;
            try {
                const cleanKode = form.kode.trim();
                const cleanTipe = form.tipe.toUpperCase().trim();
                const docId = `${cleanTipe}_${cleanKode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;
                
                await setDoc(doc(db, "master_golongan", docId), { 
                    ...form, 
                    tipe: cleanTipe,
                    kode: cleanKode,
                    updated_at: serverTimestamp() 
                });
                
                showToast("Tersimpan!"); closeModal(); fetchData();
            } catch (e) { showToast(e.message, 'error'); } 
            finally { isSaving.value = false; }
        };

        const hapusData = async (item) => {
            if (await showConfirm('Hapus?', `Hapus ${item.kode} - ${item.pangkat}?`)) {
                try {
                    await deleteDoc(doc(db, "master_golongan", item.id));
                    showToast("Terhapus");
                    fetchData();
                } catch(e) { showToast(e.message, 'error'); }
            }
        };

        const openModal = (item) => {
            isEdit.value = !!item;
            if (item) Object.assign(form, item);
            else { form.tipe = filterTipe.value; form.group = ''; form.kode = ''; form.pangkat = ''; }
            showModal.value = true;
        };
        const closeModal = () => showModal.value = false;

        onMounted(fetchData);

        return { 
            listData, filteredList, loading, filterTipe,
            showModal, isEdit, isSaving, isImporting, form, fileInput,
            resetDefault, handleImportExcel, 
            simpanData, hapusData, openModal, closeModal 
        };
    }
};