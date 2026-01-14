import { ref, onMounted, nextTick } from 'vue';
import { db, auth, collection, getDocs, query, where, orderBy, Timestamp } from '../firebase.js';
import { showToast, formatTanggal, formatRupiah } from '../utils.js';
import { store } from '../store.js';

// --- IMPORT VIEW HTML ---
import { TplLaporan } from '../views/LaporanView.js';

// --- FORMATTER HELPERS (Consistent with other modules) ---
const LIST_SINGKATAN = ['UPTD', 'SMP', 'SD', 'RSUD', 'TK', 'PAUD', 'BLUD', 'PNS', 'PPPK', 'ASN', 'SDN', 'SMPN', 'SMAN', 'SMKN', 'DPRD'];
const LIST_KECIL = ['dan', 'di', 'ke', 'dari', 'yang', 'pada', 'untuk', 'atau', 'dengan', 'atas', 'oleh'];

const formatTitleCase = (text) => {
    if (!text) return '';
    return text.replace(/\w+/g, (word, index) => {
        const upper = word.toUpperCase();
        const lower = word.toLowerCase();
        if (LIST_SINGKATAN.includes(upper)) return upper;
        if (index > 0 && LIST_KECIL.includes(lower)) return lower;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
};

export default {
    template: TplLaporan, 
    setup() {
        // STATE
        const startDate = ref('');
        const endDate = ref('');
        const filterType = ref('TMT');
        const loading = ref(false);
        const hasSearched = ref(false);
        const selectedUser = ref('ALL');
        
        const listUsers = ref([]);
        const previewData = ref([]);

        // Chart Instances
        let chartTipeAsn = null;
        let chartJabatan = null;
        let chartGolongan = null;
        let chartUnit = null;

        // --- FETCH USERS ---
        const fetchUsers = async () => {
            if (store.isAdmin) {
                try {
                    // [TIPS] Kalau user sistem sedikit, query ini oke. 
                    // Kalau banyak, bisa di-cache di store.js agar tidak fetch tiap buka menu laporan.
                    const q = query(collection(db, "users"));
                    const snap = await getDocs(q);
                    listUsers.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                } catch (e) { console.log("Users access denied"); }
            }
        };

        // --- RENDER CHART LOGIC ---
        const renderCharts = () => {
            nextTick(() => {
                if (!window.Chart) return; 

                const data = previewData.value;

                // 1. DATA TIPE ASN (PNS/PPPK)
                const countPNS = data.filter(d => d.tipe_asn === 'PNS').length;
                const countPPPK = data.filter(d => d.tipe_asn === 'PPPK').length;

                // 2. DATA JABATAN
                let countStruktural = 0;
                let countFungsional = 0;
                data.forEach(d => {
                    const j = (d.jenis_jabatan || '').toLowerCase();
                    if (j.includes('fungsional')) countFungsional++;
                    else countStruktural++;
                });

                // 3. DATA GOLONGAN
                const golMap = {};
                data.filter(d => d.tipe_asn === 'PNS').forEach(d => {
                    const g = d.golongan || 'Lainnya';
                    golMap[g] = (golMap[g] || 0) + 1;
                });
                const golLabels = Object.keys(golMap).sort();
                const golValues = golLabels.map(k => golMap[k]);

                // 4. DATA UNIT KERJA (Top 10)
                const unitMap = {};
                data.forEach(d => {
                    // Gunakan formatTitleCase agar "Dinas A" dan "DINAS A" dianggap sama
                    const rawU = d.unit_kerja || 'Tidak Diketahui';
                    const u = formatTitleCase(rawU); 
                    unitMap[u] = (unitMap[u] || 0) + 1;
                });
                const sortedUnit = Object.entries(unitMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
                const unitLabels = sortedUnit.map(i => i[0]);
                const unitValues = sortedUnit.map(i => i[1]);

                // DESTROY OLD CHARTS
                if (chartTipeAsn) chartTipeAsn.destroy();
                if (chartJabatan) chartJabatan.destroy();
                if (chartGolongan) chartGolongan.destroy();
                if (chartUnit) chartUnit.destroy();

                // CREATE NEW CHARTS
                const ctx1 = document.getElementById('chartTipeAsn');
                if (ctx1) {
                    chartTipeAsn = new Chart(ctx1, {
                        type: 'doughnut',
                        data: { labels: ['PNS', 'PPPK'], datasets: [{ data: [countPNS, countPPPK], backgroundColor: ['#36a2eb', '#ffcd56'] }] },
                        options: { responsive: true, maintainAspectRatio: false }
                    });
                }

                const ctx2 = document.getElementById('chartJabatan');
                if (ctx2) {
                    chartJabatan = new Chart(ctx2, {
                        type: 'pie',
                        data: { labels: ['Struktural/Pelaksana', 'Fungsional'], datasets: [{ data: [countStruktural, countFungsional], backgroundColor: ['#4bc0c0', '#ff6384'] }] },
                        options: { responsive: true, maintainAspectRatio: false }
                    });
                }

                const ctx3 = document.getElementById('chartGolongan');
                if (ctx3) {
                    chartGolongan = new Chart(ctx3, {
                        type: 'bar',
                        data: { labels: golLabels, datasets: [{ label: 'Jumlah PNS', data: golValues, backgroundColor: '#9966ff' }] },
                        options: { responsive: true, maintainAspectRatio: false }
                    });
                }

                const ctx4 = document.getElementById('chartUnitKerja');
                if (ctx4) {
                    chartUnit = new Chart(ctx4, {
                        type: 'bar',
                        data: { labels: unitLabels, datasets: [{ label: 'Jumlah Usulan', data: unitValues, backgroundColor: '#ff9f40' }] },
                        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
                    });
                }
            });
        };

        // --- FETCH PREVIEW DATA ---
        const fetchPreview = async () => {
            if(!startDate.value || !endDate.value) return showToast("Isi rentang tanggal dulu!", 'warning');
            
            loading.value = true;
            hasSearched.value = true;
            previewData.value = [];

            try {
                const collRef = collection(db, "usulan_kgb");
                let qConstraints = [];

                if (filterType.value === 'TMT') {
                    qConstraints.push(where("tmt_sekarang", ">=", startDate.value));
                    qConstraints.push(where("tmt_sekarang", "<=", endDate.value));
                    qConstraints.push(orderBy("tmt_sekarang", "asc"));
                } else {
                    const startTs = Timestamp.fromDate(new Date(startDate.value + "T00:00:00"));
                    const endTs = Timestamp.fromDate(new Date(endDate.value + "T23:59:59"));
                    qConstraints.push(where("created_at", ">=", startTs));
                    qConstraints.push(where("created_at", "<=", endTs));
                    qConstraints.push(orderBy("created_at", "asc"));
                }

                if (store.isAdmin) {
                    if (selectedUser.value !== 'ALL') qConstraints.push(where("created_by", "==", selectedUser.value));
                } else {
                    if (auth.currentUser) qConstraints.push(where("created_by", "==", auth.currentUser.uid));
                    else throw new Error("Sesi habis.");
                }

                const q = query(collRef, ...qConstraints);
                const snap = await getDocs(q);

                // [SAFETY WARNING]
                if (snap.size > 500) showToast(`Memuat ${snap.size} data. Mohon tunggu proses render...`, 'info');

                previewData.value = snap.docs.map(d => {
                    const data = d.data();
                    let createdAtStr = '-';
                    if (data.created_at && data.created_at.toDate) {
                        createdAtStr = formatTanggal(data.created_at.toDate().toISOString().split('T')[0]);
                    }
                    const finalEmail = data.creator_email || data.created_by || 'Legacy Data';

                    return {
                        id: d.id, ...data,
                        created_at_formatted: createdAtStr,
                        creator_email: finalEmail
                    };
                });

                renderCharts();

            } catch (e) {
                console.error(e);
                if(e.message.includes('index')) showToast("Index database sedang dibuat. Coba 2 menit lagi.", 'info');
                else showToast("Gagal memuat data: " + e.message, 'error');
            } finally {
                loading.value = false;
            }
        };

        // --- DOWNLOAD EXCEL (UPDATED WITH SAFE FORMATTER) ---
        const downloadExcel = () => {
            if (previewData.value.length === 0) return;
            const XLSX = window.XLSX;
            if(!XLSX) return showToast("Library Excel error", 'error');

            const safeDate = (val) => {
                if(!val) return '-';
                if(val.toDate) return formatTanggal(val.toDate());
                return formatTanggal(new Date(val));
            };

            // 1. FORMAT DATA KGB NORMAL
            const excelRows = previewData.value.map(data => ({
                NIP: "'" + data.nip,
                NAMA: data.nama,
                GOLONGAN: data.golongan,
                NOMOR_SK: data.nomor_naskah || '-',
                JABATAN: formatTitleCase(data.jabatan_snapshot), // SAFE FORMAT
                "UNIT KERJA": formatTitleCase(data.unit_kerja || '-'), // SAFE FORMAT
                "UNIT KERJA INDUK": formatTitleCase(data.perangkat_daerah || '-'), // SAFE FORMAT
                TMT_BARU: formatTanggal(data.tmt_sekarang),
                GAJI_LAMA: data.dasar_gaji_lama || 0,
                GAJI_BARU: data.gaji_baru,
                MK_TAHUN: data.mk_baru_tahun,
                TGL_INPUT: data.created_at_formatted,
                PENINPUT: data.creator_email, 
                TIPE: data.tipe_asn || 'PNS'
            }));

            // 2. FORMAT DATA INPASSING
            const inpassingData = previewData.value.filter(d => d.nomor_inpassing);
            const inpassingRows = inpassingData.map(data => ({
                NIP: "'" + data.nip,
                NAMA: data.nama,
                JABATAN: formatTitleCase(data.jenis_jabatan),
                GOL_INPASSING: data.inpassing_golongan || data.golongan,
                NOMOR_SK_INPASSING: data.nomor_inpassing,
                
                TMT_INPASSING: safeDate(data.tmt_inpassing),
                TGL_SK_MANUAL: safeDate(data.tanggal_inpassing_manual),
                GAJI_INPASSING: data.inpassing_gaji || 0,
                MK_TAHUN: data.mk_inpassing_tahun || 0,
                MK_BULAN: data.mk_inpassing_bulan || 0,
                
                "UNIT KERJA": formatTitleCase(data.unit_kerja || '-'), // SAFE FORMAT
                KETERANGAN: data.keterangan_inpassing || ''
            }));

            // 3. SEGREGASI DATA
            const pnsGol3 = excelRows.filter(d => d.TIPE === 'PNS' && (String(d.GOLONGAN).startsWith('III') || String(d.GOLONGAN).startsWith('3')));
            const pnsGol4 = excelRows.filter(d => d.TIPE === 'PNS' && (String(d.GOLONGAN).startsWith('IV') || String(d.GOLONGAN).startsWith('4')));
            const pppp = excelRows.filter(d => d.TIPE === 'PPPK');

            const wb = XLSX.utils.book_new();
            
            const appendSheet = (data, name, isKGB = true) => {
                let cleanData = data;
                if(isKGB) {
                     cleanData = data.map(({ TIPE, ...rest }) => rest);
                }
                
                const ws = cleanData.length > 0 ? XLSX.utils.json_to_sheet(cleanData) : XLSX.utils.json_to_sheet([{Info: "Nihil"}]);
                
                if(cleanData.length > 0) {
                    const keys = Object.keys(cleanData[0]);
                    ws['!cols'] = keys.map(() => ({ wch: 20 }));
                }

                XLSX.utils.book_append_sheet(wb, ws, name);
            };

            appendSheet(pnsGol3, "PNS GOL III");
            appendSheet(pnsGol4, "PNS GOL IV");
            appendSheet(pppp, "PPPK");
            appendSheet(inpassingRows, "REKAP INPASSING", false);

            const labelFilter = filterType.value === 'TMT' ? 'TMT' : 'Input';
            XLSX.writeFile(wb, `Rekap_Data_${labelFilter}_${startDate.value}_sd_${endDate.value}.xlsx`);
            showToast("File Excel diunduh", 'success');
        };

        onMounted(() => {
            fetchUsers();
        });

        return { 
            startDate, endDate, filterType, loading, hasSearched,
            selectedUser, listUsers, previewData,
            auth, store,
            fetchPreview, downloadExcel, formatRupiah, formatTanggal
        };
    }
};