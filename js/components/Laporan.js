import { ref, onMounted, computed } from 'vue';
import { db, auth, collection, getDocs, query, where, orderBy, Timestamp } from '../firebase.js';
import { showToast, formatTanggal, formatRupiah } from '../utils.js';
import { store } from '../store.js';

export default {
    template: `
    <div class="p-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h3 class="fw-bold text-primary mb-1">Laporan Rekapitulasi</h3>
                <p class="text-muted small mb-0">Preview dan Export data usulan KGB.</p>
            </div>
        </div>

        <div class="card shadow-sm border-0 mb-4">
            <div class="card-header bg-white py-3">
                <h6 class="fw-bold mb-0"><i class="bi bi-filter-square me-2"></i>Parameter Laporan</h6>
            </div>
            <div class="card-body p-4">
                <form @submit.prevent="fetchPreview">
                    <div class="row g-3 align-items-end">
                        
                        <div class="col-md-3">
                            <label class="form-label fw-bold small text-primary">Dasar Tanggal</label>
                            <select v-model="filterType" class="form-select border-primary">
                                <option value="TMT">Berdasarkan TMT (SK)</option>
                                <option value="CREATED">Berdasarkan Tanggal Input</option>
                            </select>
                        </div>

                        <div class="col-md-3">
                            <label class="form-label fw-bold small">Dari Tanggal</label>
                            <input v-model="startDate" type="date" class="form-control" required>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-bold small">Sampai Tanggal</label>
                            <input v-model="endDate" type="date" class="form-control" required>
                        </div>

                        <div class="col-md-3" v-if="store.isAdmin">
                            <label class="form-label fw-bold small text-danger">Filter Peninput (Admin)</label>
                            <select v-model="selectedUser" class="form-select">
                                <option value="ALL">-- Tampilkan Semua --</option>
                                <option :value="auth.currentUser?.uid">Inputan Saya Sendiri</option>
                                <option disabled>----------------</option>
                                <option v-for="u in listUsers" :key="u.id" :value="u.id">
                                    {{ u.email }}
                                </option>
                            </select>
                        </div>

                        <div class="col-12 text-end border-top pt-3 mt-3">
                            <button type="submit" class="btn btn-primary px-4 shadow-sm" :disabled="loading">
                                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                                <i v-else class="bi bi-search me-2"></i> Tampilkan Data
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <div v-if="previewData.length > 0" class="card shadow-sm border-0 animate__animated animate__fadeIn">
            <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="fw-bold mb-0 text-success"><i class="bi bi-table me-2"></i>Preview Data</h6>
                    <small class="text-muted">Ditemukan {{ previewData.length }} data.</small>
                </div>
                <button @click="downloadExcel" class="btn btn-success btn-sm shadow-sm">
                    <i class="bi bi-file-earmark-excel-fill me-2"></i>Download Excel
                </button>
            </div>
            <div class="table-responsive">
                <table class="table table-hover table-striped mb-0 align-middle small">
                    <thead class="table-success">
                        <tr>
                            <th class="ps-3">No</th>
                            <th>NIP / Nama</th>
                            <th>Jabatan</th>
                            <th>Gol</th>
                            <th>Gaji Baru</th>
                            <th>TMT</th>
                            <th>Peninput</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, index) in previewData" :key="item.id">
                            <td class="ps-3">{{ index + 1 }}</td>
                            <td>
                                <div class="fw-bold text-dark">{{ item.nama }}</div>
                                <div class="text-muted font-monospace" style="font-size: 0.8em;">{{ item.nip }}</div>
                            </td>
                            <td>{{ item.jabatan_snapshot }}</td>
                            <td><span class="badge bg-light text-dark border">{{ item.golongan }}</span></td>
                            <td class="fw-bold text-end">{{ formatRupiah(item.gaji_baru) }}</td>
                            <td>{{ formatTanggal(item.tmt_sekarang) }}</td>
                            <td>
                                <div class="fw-bold text-primary" style="font-size: 0.75em;">
                                    <i class="bi bi-person-circle me-1"></i>{{ item.creator_email }}
                                </div>
                                <div class="text-muted fst-italic" style="font-size: 0.7em;">
                                    {{ item.created_at_formatted }}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div v-else-if="hasSearched && !loading" class="alert alert-warning text-center shadow-sm">
            <i class="bi bi-emoji-frown fs-4 d-block mb-2"></i>
            Tidak ada data ditemukan untuk kriteria tersebut.
        </div>

    </div>
    `,
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

        // --- FETCH USERS (HANYA UNTUK DROPDOWN ADMIN) ---
        const fetchUsers = async () => {
            if (store.isAdmin) {
                try {
                    const q = query(collection(db, "users"));
                    const snap = await getDocs(q);
                    listUsers.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                } catch (e) { 
                    console.log("Collection 'users' tidak dapat diakses."); 
                }
            }
        };

        // --- 1. PROSES PREVIEW DATA ---
        const fetchPreview = async () => {
            if(!startDate.value || !endDate.value) return showToast("Isi rentang tanggal dulu!", 'warning');
            
            loading.value = true;
            hasSearched.value = true;
            previewData.value = [];

            try {
                const collRef = collection(db, "usulan_kgb");
                let qConstraints = [];

                // A. LOGIKA TANGGAL
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

                // B. LOGIKA USER OWNER
                if (store.isAdmin) {
                    if (selectedUser.value !== 'ALL') {
                        qConstraints.push(where("created_by", "==", selectedUser.value));
                    }
                } else {
                    if (auth.currentUser) {
                        qConstraints.push(where("created_by", "==", auth.currentUser.uid));
                    } else {
                        throw new Error("Sesi habis.");
                    }
                }

                // C. EKSEKUSI QUERY
                const q = query(collRef, ...qConstraints);
                const snap = await getDocs(q);

                // D. MAPPING (TANPA CACHE/MAP USER LAGI)
                // Langsung baca apa adanya dari dokumen
                previewData.value = snap.docs.map(d => {
                    const data = d.data();
                    
                    let createdAtStr = '-';
                    if (data.created_at && data.created_at.toDate) {
                        createdAtStr = formatTanggal(data.created_at.toDate().toISOString().split('T')[0]);
                    }

                    // LANGSUNG AMBIL EMAIL DARI DATA
                    // Jika data lama tidak punya creator_email, tampilkan created_by (UID)
                    const finalEmail = data.creator_email || data.created_by || 'Legacy Data';

                    return {
                        id: d.id,
                        ...data,
                        created_at_formatted: createdAtStr,
                        creator_email: finalEmail
                    };
                });

            } catch (e) {
                console.error(e);
                if(e.message.includes('index')) showToast("Index database sedang dibuat. Coba 2 menit lagi.", 'info');
                else showToast("Gagal memuat data: " + e.message, 'error');
            } finally {
                loading.value = false;
            }
        };

        // --- 2. DOWNLOAD EXCEL ---
        const downloadExcel = () => {
            if (previewData.value.length === 0) return;
            
            const XLSX = window.XLSX;
            if(!XLSX) return showToast("Library Excel error", 'error');

            const toTitleCase = (str) => {
                if (!str) return '';
                return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            };

            const excelRows = previewData.value.map(data => ({
                NIP: "'" + data.nip,
                NAMA: data.nama,
                GOLONGAN: data.golongan,
                JABATAN: data.jabatan_snapshot,
                "UNIT KERJA": toTitleCase(data.unit_kerja || '-'),
                "UNIT KERJA INDUK": toTitleCase(data.perangkat_daerah || '-'),
                TMT_BARU: formatTanggal(data.tmt_sekarang),
                GAJI_BARU: data.gaji_baru,
                MK_TAHUN: data.mk_baru_tahun,
                TGL_INPUT: data.created_at_formatted,
                PENINPUT: data.creator_email, 
                TIPE: data.tipe_asn || 'PNS'
            }));

            const pnsGol3 = excelRows.filter(d => d.TIPE === 'PNS' && (String(d.GOLONGAN).startsWith('III') || String(d.GOLONGAN).startsWith('3')));
            const pnsGol4 = excelRows.filter(d => d.TIPE === 'PNS' && (String(d.GOLONGAN).startsWith('IV') || String(d.GOLONGAN).startsWith('4')));
            const pppp = excelRows.filter(d => d.TIPE === 'PPPK');

            const wb = XLSX.utils.book_new();
            
            const appendSheet = (data, name) => {
                const cleanData = data.map(({ TIPE, ...rest }) => rest);
                const ws = cleanData.length > 0 ? XLSX.utils.json_to_sheet(cleanData) : XLSX.utils.json_to_sheet([{Info: "Nihil"}]);
                ws['!cols'] = [
                    {wch:20}, {wch:30}, {wch:10}, {wch:30}, {wch:25}, {wch:25}, 
                    {wch:15}, {wch:15}, {wch:10}, {wch:15}, {wch:25}
                ];
                XLSX.utils.book_append_sheet(wb, ws, name);
            };

            appendSheet(pnsGol3, "PNS GOL III");
            appendSheet(pnsGol4, "PNS GOL IV");
            appendSheet(pppp, "PPPK");

            const labelFilter = filterType.value === 'TMT' ? 'TMT' : 'Input';
            XLSX.writeFile(wb, `Rekap_KGB_${labelFilter}_${startDate.value}_sd_${endDate.value}.xlsx`);
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