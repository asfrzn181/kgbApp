import { ref, onMounted, reactive } from 'vue';
import { 
    db, auth, collection, getDocs, query, orderBy, limit, where, 
    getCountFromServer, Timestamp 
} from '../firebase.js';
import { formatTanggal, formatRupiah, formatTmtPendek, hitungHariLagi } from '../utils.js'; // Pastikan helpers diimport
import { store } from '../store.js';

// Import Child Components
import FormKgb from './FormKgb.js';

export default {
    components: { FormKgb },
    template: `
    <div>
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
            <div>
                <h3 class="fw-bold text-primary mb-1">Dashboard</h3>
                <p class="text-muted small mb-0">Selamat datang, <strong>{{ store.user?.email }}</strong>.</p>
            </div>
            <div class="mt-3 mt-md-0 d-flex gap-2">
                <router-link to="/master/pegawai" class="btn btn-light border text-primary shadow-sm" v-if="store.isAdmin">
                    <i class="bi bi-database me-1"></i> Data Master
                </router-link>
                
                <button @click="showKgb = true" class="btn btn-primary shadow-sm">
                    <i class="bi bi-plus-lg me-1"></i> Input Usulan Baru
                </button>
            </div>
        </div>

        <div class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-white py-3">
                <h6 class="fw-bold mb-0 text-secondary"><i class="bi bi-graph-up-arrow me-2"></i>Statistik Usulan Tahun {{ currentYear }}</h6>
            </div>
            <div class="card-body">
                <div class="row g-4 text-center">
                    <div class="col-6 col-md-3">
                        <div class="p-3 rounded bg-primary bg-opacity-10">
                            <h2 class="fw-bold text-primary mb-0">{{ stats.q1 }}</h2>
                            <small class="text-uppercase fw-bold text-muted" style="font-size: 0.7rem;">Triwulan I (Jan-Mar)</small>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-3 rounded bg-success bg-opacity-10">
                            <h2 class="fw-bold text-success mb-0">{{ stats.q2 }}</h2>
                            <small class="text-uppercase fw-bold text-muted" style="font-size: 0.7rem;">Triwulan II (Apr-Jun)</small>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-3 rounded bg-warning bg-opacity-10">
                            <h2 class="fw-bold text-warning mb-0">{{ stats.q3 }}</h2>
                            <small class="text-uppercase fw-bold text-muted" style="font-size: 0.7rem;">Triwulan III (Jul-Sep)</small>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-3 rounded bg-info bg-opacity-10">
                            <h2 class="fw-bold text-info mb-0">{{ stats.q4 }}</h2>
                            <small class="text-uppercase fw-bold text-muted" style="font-size: 0.7rem;">Triwulan IV (Okt-Des)</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-lg-4">
                
                <div class="card border-0 shadow-sm mb-4 bg-gradient-primary text-white">
                    <div class="card-body p-4">
                        <div class="d-flex align-items-center">
                            <div class="bg-white bg-opacity-25 p-3 rounded-circle me-3">
                                <i class="bi bi-pencil-square fs-3"></i>
                            </div>
                            <div>
                                <h5 class="fw-bold mb-0">Inputan Saya</h5>
                                <div class="fs-1 fw-bold">{{ myInputCount }} <span class="fs-6 fw-normal opacity-75">Dokumen</span></div>
                            </div>
                        </div>
                        <hr class="border-white opacity-25">
                        <small class="opacity-75">Total usulan yang pernah Anda proses.</small>
                    </div>
                </div>

                <div class="card border-0 shadow-sm h-100">
                    <div class="card-header bg-danger bg-opacity-10 py-3 d-flex justify-content-between align-items-center">
                        <h6 class="fw-bold text-danger mb-0">
                            <i class="bi bi-alarm-fill me-2"></i>Reminder KGB
                        </h6>
                        <span class="badge bg-danger rounded-pill">{{ listReminder.length }}</span>
                    </div>
                    <div class="card-body p-0">
                        <div v-if="loadingReminder" class="text-center py-4 text-muted small">Cek jadwal...</div>
                        <div v-else-if="listReminder.length === 0" class="text-center py-4 text-muted small">
                            <i class="bi bi-check-circle-fill text-success fs-4 d-block mb-1"></i>
                            Tidak ada KGB jatuh tempo (2 bulan ke depan).
                        </div>
                        <ul v-else class="list-group list-group-flush small">
                            <li v-for="item in listReminder" :key="item.id" class="list-group-item d-flex justify-content-between align-items-start bg-transparent">
                                <div>
                                    <div class="fw-bold text-dark">{{ item.nama_snapshot || item.nama }}</div>
                                    <div class="text-muted" style="font-size: 0.75rem;">{{ item.nip }}</div>
                                </div>
                                <div class="text-end">
                                    <span class="badge bg-danger">TMT: {{ formatTmtPendek(item.tmt_selanjutnya) }}</span>
                                    <div class="text-muted" style="font-size: 0.7rem;">{{ hitungHariLagi(item.tmt_selanjutnya) }} hari lagi</div>
                                </div>
                            </li>
                        </ul>
                    </div>
                    <div class="card-footer bg-white text-center small text-muted">
                        Periode: {{ rangeStart }} s.d {{ rangeEnd }}
                    </div>
                </div>
            </div>

            <div class="col-lg-8">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <h6 class="mb-0 fw-bold text-secondary"><i class="bi bi-clock-history me-2"></i>Riwayat Usulan Terakhir</h6>
                        <button class="btn btn-sm btn-light border text-primary" @click="fetchRecent">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 small">
                            <thead class="table-light">
                                <tr>
                                    <th class="ps-4">Pegawai</th>
                                    <th>Jabatan</th>
                                    <th>Gaji Baru</th>
                                    <th>TMT</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="loadingData">
                                    <td colspan="4" class="text-center py-5 text-muted">
                                        <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                                    </td>
                                </tr>
                                <tr v-else-if="listData.length === 0">
                                    <td colspan="4" class="text-center py-5 text-muted">Belum ada data usulan.</td>
                                </tr>
                                <tr v-else v-for="item in listData" :key="item.id">
                                    <td class="ps-4">
                                        <div class="fw-bold text-dark">{{ item.nama_snapshot }}</div>
                                        <div class="text-muted">{{ item.nip }}</div>
                                    </td>
                                    <td>{{ item.jabatan_snapshot || '-' }}</td>
                                    <td class="fw-bold text-success">{{ formatRupiah(item.gaji_baru) }}</td>
                                    <td>{{ formatTanggal(item.tmt_sekarang) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <FormKgb v-if="showKgb" @close="showKgb = false" @saved="fetchRecent" />

    </div>
    `,
    setup() {
        // STATE
        const listData = ref([]);
        const listReminder = ref([]);
        const loadingData = ref(true);
        const loadingReminder = ref(true);
        const showKgb = ref(false); // Modal Transaksi
        const myInputCount = ref(0);
        const currentYear = new Date().getFullYear();
        
        // Stats Triwulan
        const stats = reactive({ q1: 0, q2: 0, q3: 0, q4: 0 });
        
        // Range Tanggal Reminder (Untuk Display)
        const rangeStart = ref('');
        const rangeEnd = ref('');

        // 1. FETCH RECENT DATA
        const fetchRecent = async () => {
            loadingData.value = true;
            try {
                // RULES: Admin lihat semua, User lihat sendiri (Konsisten dengan TransaksiKgb)
                const constraints = [ orderBy("created_at", "desc"), limit(10) ];
                if (!store.isAdmin && auth.currentUser) {
                    constraints.unshift(where("created_by", "==", auth.currentUser.uid));
                }

                const q = query(collection(db, "usulan_kgb"), ...constraints);
                const snap = await getDocs(q);
                listData.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) { console.error(e); } 
            finally { loadingData.value = false; }
        };

        // 2. FETCH INPUTAN SAYA (COUNT)
        const fetchMyInputs = async () => {
            if (!auth.currentUser) return;
            try {
                const q = query(collection(db, "usulan_kgb"), where("created_by", "==", auth.currentUser.uid));
                const snap = await getCountFromServer(q);
                myInputCount.value = snap.data().count;
            } catch(e) { console.error("Gagal hitung inputan saya", e); }
        };

        // 3. FETCH STATISTIK TRIWULAN
        const fetchTriwulan = async () => {
            try {
                const year = currentYear;
                const getRange = (startMonth, endMonth) => {
                    const start = new Date(year, startMonth, 1);
                    const end = new Date(year, endMonth + 1, 0, 23, 59, 59);
                    return [Timestamp.fromDate(start), Timestamp.fromDate(end)];
                };

                const ranges = [
                    getRange(0, 2),  // Q1
                    getRange(3, 5),  // Q2
                    getRange(6, 8),  // Q3
                    getRange(9, 11)  // Q4
                ];

                const coll = collection(db, "usulan_kgb");
                
                // Tambahkan filter owner jika bukan admin
                const ownerFilter = (!store.isAdmin && auth.currentUser) 
                    ? [where("created_by", "==", auth.currentUser.uid)] 
                    : [];

                const promises = ranges.map(([s, e]) => 
                    getCountFromServer(query(coll, ...ownerFilter, where("created_at", ">=", s), where("created_at", "<=", e)))
                );

                const results = await Promise.all(promises);
                stats.q1 = results[0].data().count;
                stats.q2 = results[1].data().count;
                stats.q3 = results[2].data().count;
                stats.q4 = results[3].data().count;

            } catch(e) { console.error("Gagal hitung triwulan", e); }
        };

        // 4. FETCH REMINDER
        const fetchReminder = async () => {
            loadingReminder.value = true;
            try {
                const today = new Date();
                const future = new Date();
                future.setDate(today.getDate() + 60);

                const todayStr = today.toISOString().split('T')[0];
                const futureStr = future.toISOString().split('T')[0];
                
                rangeStart.value = formatTanggal(todayStr);
                rangeEnd.value = formatTanggal(futureStr);

                // Query Reminder (Next KGB)
                // Filter user jika bukan admin
                const constraints = [
                    where("tmt_selanjutnya", ">=", todayStr),
                    where("tmt_selanjutnya", "<=", futureStr),
                    orderBy("tmt_selanjutnya", "asc"),
                    limit(20)
                ];
                
                // Note: Query kompleks (range + equality) butuh index. 
                // Jika user biasa kena error index, biarkan kosong dulu atau buat index.
                // Untuk amannya di dashboard user biasa, kita mungkin skip filter owner di reminder ini (biar ringan)
                // Atau user biasa hanya melihat reminder dirinya sendiri.
                
                if (!store.isAdmin && auth.currentUser) {
                     constraints.unshift(where("created_by", "==", auth.currentUser.uid));
                }

                const q = query(collection(db, "usulan_kgb"), ...constraints);
                const snap = await getDocs(q);

                const uniqueReminders = [];
                const seenNip = new Set();
                snap.docs.forEach(d => {
                    const data = d.data();
                    if(!seenNip.has(data.nip)) {
                        seenNip.add(data.nip);
                        uniqueReminders.push({ id: d.id, ...data });
                    }
                });
                listReminder.value = uniqueReminders;

            } catch(e) { console.error("Gagal load reminder", e); } 
            finally { loadingReminder.value = false; }
        };

        // Helpers
        const formatTmtPendek = (dateStr) => {
            if(!dateStr) return '-';
            const d = new Date(dateStr);
            return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
        };
        const hitungHariLagi = (targetDateStr) => {
            const target = new Date(targetDateStr);
            const today = new Date();
            const diffTime = Math.abs(target - today);
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        };

        onMounted(() => {
            fetchRecent();
            fetchMyInputs();
            fetchTriwulan();
            fetchReminder();
        });

        return { 
            listData, listReminder, loadingData, loadingReminder, 
            showKgb, store, stats, myInputCount, currentYear,
            fetchRecent, formatTanggal, formatRupiah, formatTmtPendek, hitungHariLagi,
            rangeStart, rangeEnd
        };
    }
};