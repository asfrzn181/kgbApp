import { ref, onMounted, reactive } from 'vue';
import { 
    db, auth, collection, getDocs, query, orderBy, limit, where, 
    getCountFromServer, Timestamp 
} from '../firebase.js';
import { formatTanggal, formatRupiah, formatTmtPendek, hitungHariLagi, showToast } from '../utils.js';
import { store } from '../store.js';

// --- IMPORT VIEW HTML ---
import { TplDashboard } from '../views/DashboardView.js';

export default {
    template: TplDashboard, 
    setup() {
        // STATE
        const listData = ref([]);
        const listReminder = ref([]);
        const loadingData = ref(true);
        const loadingReminder = ref(true);
        
        const myInputCount = ref(0);
        const currentYear = new Date().getFullYear();
        
        // Stats Triwulan
        const stats = reactive({ q1: 0, q2: 0, q3: 0, q4: 0 });
        
        // Range Tanggal Reminder
        const rangeStart = ref('');
        const rangeEnd = ref('');

        // 1. FETCH RECENT DATA (Exclude Inpassing jika memungkinkan)
        const fetchRecent = async () => {
            loadingData.value = true;
            try {
                // Filter Inpassing di Client Side (karena where != butuh index)
                const constraints = [ orderBy("created_at", "desc"), limit(10) ]; // Ambil lebih banyak untuk buffer filter
                // if (!store.isAdmin && auth.currentUser) {
                //     constraints.unshift(where("created_by", "==", auth.currentUser.uid));
                // }
                constraints.unshift(where("created_by", "==", auth.currentUser.uid));
                const q = query(collection(db, "usulan_kgb"), ...constraints);
                const snap = await getDocs(q);
                
                // Filter Data
                listData.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(d => !d.nomor_inpassing) // Sembunyikan Inpassing dari Recent Activity
                    .slice(0, 10); // Ambil 10 teratas setelah filter

            } catch (e) { console.error(e); } 
            finally { loadingData.value = false; }
        };

        // 2. FETCH INPUTAN SAYA (COUNT)
        const fetchMyInputs = async () => {
            if (!auth.currentUser) return;
            try {
                // Count semua (termasuk inpassing tidak apa-apa untuk total kerjaan)
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

                // Jalankan paralel
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

        // 4. FETCH REMINDER (Optimized & Error Handling)
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
                const constraints = [
                    where("tmt_selanjutnya", ">=", todayStr),
                    where("tmt_selanjutnya", "<=", futureStr),
                    orderBy("tmt_selanjutnya", "asc"),
                    limit(20)
                ];
                
                if (!store.isAdmin && auth.currentUser) {
                     constraints.unshift(where("created_by", "==", auth.currentUser.uid));
                }

                const q = query(collection(db, "usulan_kgb"), ...constraints);
                const snap = await getDocs(q);

                const uniqueReminders = [];
                const seenNip = new Set();
                snap.docs.forEach(d => {
                    const data = d.data();
                    // Filter Inpassing (Jangan tampilkan reminder inpassing di dashboard reguler)
                    if(!data.nomor_inpassing && !seenNip.has(data.nip)) {
                        seenNip.add(data.nip);
                        uniqueReminders.push({ id: d.id, ...data });
                    }
                });
                listReminder.value = uniqueReminders;

            } catch(e) { 
                console.error("Gagal load reminder", e); 
                if(e.message.includes("index")) {
                    // Jika error index, berikan link di console tapi jangan ganggu UI user
                    console.warn("Butuh Index Composite: (created_by + tmt_selanjutnya)");
                }
            } 
            finally { loadingReminder.value = false; }
        };

        onMounted(() => {
            fetchRecent();
            fetchMyInputs();
            fetchTriwulan();
            fetchReminder();
        });

        return { 
            listData, listReminder, loadingData, loadingReminder, 
            store, stats, myInputCount, currentYear,
            fetchRecent, formatTanggal, formatRupiah, formatTmtPendek, hitungHariLagi,
            rangeStart, rangeEnd
        };
    }
};