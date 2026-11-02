import { ref, computed, onMounted, nextTick } from 'vue';
import { db, auth, collection, getDocs, query, where, orderBy, Timestamp } from '../firebase.js';
import { showToast, formatTanggal } from '../utils.js';
import { store } from '../store.js';
import { TplLaporanJabfung } from '../views/LaporanJabfungView.js';

// ─── HELPERS ────────────────────────────────────────────────────────────────
const LIST_SINGKATAN = ['UPTD','SMP','SD','RSUD','TK','PAUD','BLUD','PNS','PPPK','ASN','SDN','SMPN','SMAN','SMKN','DPRD'];
const LIST_KECIL     = ['dan','di','ke','dari','yang','pada','untuk','atau','dengan','atas','oleh'];

const toTitleCase = (text) => {
    if (!text) return '';
    return text.replace(/\w+/g, (word, index) => {
        const upper = word.toUpperCase();
        const lower = word.toLowerCase();
        if (LIST_SINGKATAN.includes(upper)) return upper;
        if (index > 0 && LIST_KECIL.includes(lower)) return lower;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
};

// Ambil golongan singkat dari string pangkat_golongan (misal "III/a", "IV/b")
const parseGolongan = (pangkat) => {
    if (!pangkat) return 'Lainnya';
    const m = pangkat.match(/[IVX]+\/[a-eA-E]/);
    return m ? m[0].toUpperCase() : pangkat;
};

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default {
    template: TplLaporanJabfung,
    setup() {
        // STATE
        const startDate    = ref('');
        const endDate      = ref('');
        const filterType   = ref('TMT');
        const filterStatus = ref('ALL');
        const loading      = ref(false);
        const hasSearched  = ref(false);
        const previewData  = ref([]);
        const activeChartFilter = ref(null);  // { key, label }

        // Chart instances
        let chartKategori = null;
        let chartGolongan = null;
        let chartStatus   = null;
        let chartUnit     = null;

        // ── COMPUTED ──────────────────────────────────────────────────────
        const filteredData = computed(() => {
            if (!activeChartFilter.value) return previewData.value;
            const { key, value } = activeChartFilter.value;
            return previewData.value.filter(d => {
                if (key === 'KATEGORI') return (d.kategori_jabatan || '-') === value;
                if (key === 'GOLONGAN') return parseGolongan(d.pangkat_golongan) === value;
                if (key === 'STATUS')   return (d.status || 'DRAFT') === value;
                if (key === 'UNIT')     return toTitleCase(d.unit_kerja || '') === value;
                return true;
            });
        });

        const clearChartFilter = () => { activeChartFilter.value = null; };

        // ── CHARTS ────────────────────────────────────────────────────────
        const renderCharts = () => {
            nextTick(() => {
                if (!window.Chart) return;
                const data = previewData.value;

                // 1. Kategori Jabatan
                const kategoriMap = {};
                data.forEach(d => {
                    const k = d.kategori_jabatan || 'Tidak Diketahui';
                    kategoriMap[k] = (kategoriMap[k] || 0) + 1;
                });
                const kLabels = Object.keys(kategoriMap);
                const kValues = kLabels.map(k => kategoriMap[k]);

                // 2. Golongan
                const golMap = {};
                data.forEach(d => {
                    const g = parseGolongan(d.pangkat_golongan);
                    golMap[g] = (golMap[g] || 0) + 1;
                });
                const gLabels = Object.keys(golMap).sort();
                const gValues = gLabels.map(k => golMap[k]);

                // 3. Status
                const selesai = data.filter(d => (d.status || 'DRAFT') === 'SELESAI').length;
                const draft   = data.length - selesai;

                // 4. Unit Kerja Top 10
                const unitMap = {};
                data.forEach(d => {
                    const u = toTitleCase(d.unit_kerja || 'Tidak Diketahui');
                    unitMap[u] = (unitMap[u] || 0) + 1;
                });
                const sortedUnit = Object.entries(unitMap).sort((a,b) => b[1]-a[1]).slice(0,10);
                const uLabels = sortedUnit.map(i => i[0]);
                const uValues = sortedUnit.map(i => i[1]);

                // Destroy lama
                if (chartKategori) chartKategori.destroy();
                if (chartGolongan) chartGolongan.destroy();
                if (chartStatus)   chartStatus.destroy();
                if (chartUnit)     chartUnit.destroy();

                const onClick = (key, chart, elements) => {
                    if (!elements || !elements.length) return;
                    const label = chart.data.labels[elements[0].index];
                    if (activeChartFilter.value?.key === key && activeChartFilter.value?.value === label) {
                        activeChartFilter.value = null;
                        showToast('Filter grafik dilepas.', 'info');
                    } else {
                        activeChartFilter.value = { key, value: label, label: `${key.replace('_',' ')}: ${label}` };
                        showToast(`Difilter: ${label}`, 'success');
                    }
                };

                const COLORS = ['#5c35a5','#7b5ea7','#9b80cc','#c4b0e8','#36a2eb','#ff9f40','#ff6384','#4bc0c0','#ffcd56','#9966ff'];

                const c1 = document.getElementById('chartKategori');
                if (c1) chartKategori = new Chart(c1, {
                    type: 'doughnut',
                    data: { labels: kLabels, datasets: [{ data: kValues, backgroundColor: COLORS }] },
                    options: { responsive: true, maintainAspectRatio: false,
                        onClick: (e, els, c) => onClick('KATEGORI', c, els) }
                });

                const c2 = document.getElementById('chartGolongan');
                if (c2) chartGolongan = new Chart(c2, {
                    type: 'bar',
                    data: { labels: gLabels, datasets: [{ label: 'Jumlah', data: gValues, backgroundColor: '#5c35a5' }] },
                    options: { responsive: true, maintainAspectRatio: false,
                        onClick: (e, els, c) => onClick('GOLONGAN', c, els) }
                });

                const c3 = document.getElementById('chartStatus');
                if (c3) chartStatus = new Chart(c3, {
                    type: 'pie',
                    data: { labels: ['Selesai','Draft'], datasets: [{ data: [selesai, draft], backgroundColor: ['#4bc0c0','#ffcd56'] }] },
                    options: { responsive: true, maintainAspectRatio: false,
                        onClick: (e, els, c) => onClick('STATUS', c, els) }
                });

                const c4 = document.getElementById('chartUnitKerja');
                if (c4) chartUnit = new Chart(c4, {
                    type: 'bar',
                    data: { labels: uLabels, datasets: [{ label: 'Jumlah Usulan', data: uValues, backgroundColor: '#9966ff' }] },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                        onClick: (e, els, c) => onClick('UNIT', c, els) }
                });
            });
        };

        // ── FETCH DATA ────────────────────────────────────────────────────
        const fetchPreview = async () => {
            if (!startDate.value || !endDate.value) return showToast('Isi rentang tanggal dulu!', 'warning');

            loading.value    = true;
            hasSearched.value = true;
            previewData.value = [];
            clearChartFilter();

            try {
                const collRef = collection(db, 'usulan_sk_fungsional');
                const constraints = [];

                if (filterType.value === 'TMT') {
                    constraints.push(where('tmt_jabatan', '>=', startDate.value));
                    constraints.push(where('tmt_jabatan', '<=', endDate.value));
                    constraints.push(orderBy('tmt_jabatan', 'asc'));
                } else {
                    const startTs = Timestamp.fromDate(new Date(startDate.value + 'T00:00:00'));
                    const endTs   = Timestamp.fromDate(new Date(endDate.value   + 'T23:59:59'));
                    constraints.push(where('created_at', '>=', startTs));
                    constraints.push(where('created_at', '<=', endTs));
                    constraints.push(orderBy('created_at', 'asc'));
                }

                // Non-admin hanya lihat data miliknya
                if (!store.isAdmin && auth.currentUser) {
                    constraints.push(where('created_by', '==', auth.currentUser.uid));
                }

                const snap = await getDocs(query(collRef, ...constraints));

                if (snap.size > 500) showToast(`Memuat ${snap.size} data. Mohon tunggu...`, 'info');

                let docs = snap.docs;

                // Filter status (client-side karena tidak bisa gabung compound query)
                if (filterStatus.value !== 'ALL') {
                    docs = docs.filter(d => (d.data().status || 'DRAFT') === filterStatus.value);
                }

                previewData.value = docs.map(d => {
                    const data = d.data();
                    let created_at_str = '-';
                    if (data.created_at?.toDate) {
                        created_at_str = formatTanggal(data.created_at.toDate().toISOString().split('T')[0]);
                    }
                    return { id: d.id, ...data, created_at_str };
                });

                renderCharts();

            } catch (e) {
                console.error('Laporan Jabfung Error:', e);
                if (e.message?.includes('index')) {
                    showToast('Index database sedang dibuat. Coba 2 menit lagi.', 'info');
                } else {
                    showToast('Gagal memuat data: ' + e.message, 'error');
                }
            } finally {
                loading.value = false;
            }
        };

        // ── DOWNLOAD EXCEL ─────────────────────────────────────────────────
        const downloadExcel = () => {
            const XLSX = window.XLSX;
            if (!XLSX) return showToast('Library Excel tidak tersedia', 'error');
            if (filteredData.value.length === 0) return showToast('Tidak ada data', 'warning');

            const data = filteredData.value;

            // Sheet 1: Data lengkap
            const mainRows = data.map(d => ({
                NIP:                    String(d.nip || ''),
                NAMA:                   d.nama || '',
                'UNIT KERJA':           toTitleCase(d.unit_kerja || ''),
                'PERANGKAT DAERAH':     toTitleCase(d.perangkat_daerah || ''),
                PANGKAT_GOLONGAN:       d.pangkat_golongan || '',
                TMT_PANGKAT:            d.tmt_pangkat_golongan || '-',
                JABATAN_LAMA:           d.jabatan_lama || '-',
                JABATAN_BARU:           d.jabatan_baru || '',
                KATEGORI_JABATAN:       d.kategori_jabatan || '-',
                TMT_JABATAN:            d.tmt_jabatan || '-',
                ANGKA_KREDIT:           d.angka_kredit || '-',
                TUNJANGAN:              d.tunjangan || 0,
                'NO PERTEK BKN':        d.no_pertek_bkn || '-',
                'TGL PERTEK BKN':       d.tgl_pertek_bkn || '-',
                'NO SERTIFIKAT KOMPETENSI': d.no_ser_kom || '-',
                'TGL SERTIFIKAT KOMPETENSI': d.tgl_ser_kom || '-',
                'NAMA PEJABAT':         d.pejabat_nama || '-',
                'JABATAN PEJABAT':      d.pejabat_jabatan || '-',
                NOMOR_SK:               d.nomor_naskah || '-',
                STATUS:                 d.status || 'DRAFT',
                TGL_INPUT:              d.created_at_str || '-',
            }));

            // Sheet 2: Rekap per Kategori Jabatan
            const kategoriMap = {};
            data.forEach(d => {
                const k = d.kategori_jabatan || 'Tidak Diketahui';
                kategoriMap[k] = (kategoriMap[k] || 0) + 1;
            });
            const rekapKategori = Object.entries(kategoriMap)
                .sort((a,b) => b[1]-a[1])
                .map(([KATEGORI_JABATAN, JUMLAH]) => ({ KATEGORI_JABATAN, JUMLAH }));

            // Sheet 3: Rekap per Golongan
            const golMap = {};
            data.forEach(d => {
                const g = parseGolongan(d.pangkat_golongan);
                golMap[g] = (golMap[g] || 0) + 1;
            });
            const rekapGolongan = Object.entries(golMap)
                .sort((a,b) => a[0].localeCompare(b[0]))
                .map(([PANGKAT_GOLONGAN, JUMLAH]) => ({ PANGKAT_GOLONGAN, JUMLAH }));

            // Sheet 4: Rekap per Unit Kerja
            const unitMap = {};
            data.forEach(d => {
                const u = toTitleCase(d.unit_kerja || 'Tidak Diketahui');
                unitMap[u] = (unitMap[u] || 0) + 1;
            });
            const rekapUnit = Object.entries(unitMap)
                .sort((a,b) => b[1]-a[1])
                .map(([UNIT_KERJA, JUMLAH]) => ({ UNIT_KERJA, JUMLAH }));

            // Build workbook
            const wb = XLSX.utils.book_new();

            const addSheet = (rows, name) => {
                const ws = rows.length > 0
                    ? XLSX.utils.json_to_sheet(rows)
                    : XLSX.utils.json_to_sheet([{ Info: 'Nihil' }]);
                if (rows.length > 0) {
                    ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 22 }));
                }
                XLSX.utils.book_append_sheet(wb, ws, name);
            };

            addSheet(mainRows,       'Data Jabfung');
            addSheet(rekapKategori,  'Rekap Kategori');
            addSheet(rekapGolongan,  'Rekap Golongan');
            addSheet(rekapUnit,      'Rekap Unit Kerja');

            const label  = filterType.value === 'TMT' ? 'TMT' : 'Input';
            const suffix = `${label}_${startDate.value}_sd_${endDate.value}`;
            XLSX.writeFile(wb, `Rekap_SKJabfung_${suffix}.xlsx`);
            showToast('File Excel berhasil diunduh!', 'success');
        };

        onMounted(() => {
            // tidak ada fetch awal — tunggu user isi filter
        });

        return {
            startDate, endDate, filterType, filterStatus,
            loading, hasSearched, previewData, filteredData,
            activeChartFilter, clearChartFilter,
            fetchPreview, downloadExcel, formatTanggal, store
        };
    }
};

