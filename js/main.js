import { createApp, onMounted } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { auth, onAuthStateChanged, signOut } from './firebase.js';
import { store } from './store.js';
import { showConfirm } from './utils.js'; 

// --- IMPORT KOMPONEN ---
import Sidebar from './components/Sidebar.js';
import Auth from './components/Auth.js';
import Dashboard from './components/Dashboard.js';
import Laporan from './components/Laporan.js';
// --- IMPORT MODUL UTAMA ---
import TransaksiKgb from './components/TransaksiKgb.js'; // Module Transaksi
import MasterPegawai from './components/MasterPegawai.js'; 
import MasterGaji from './components/MasterGaji.js';
import MasterPejabat from './components/MasterPejabat.js';
import MasterTemplate from './components/MasterTemplate.js';
import MasterGolongan from './components/MasterGolongan.js';
import MasterJabatan from './components/MasterJabatan.js';
// --- KONFIGURASI ROUTER ---
const routes = [
    // 1. Dashboard
    { path: '/', component: Dashboard },
    
    // 2. Transaksi (Sudah Aktif)
    { path: '/transaksi', component: TransaksiKgb },

    // 3. Laporan
    { path: '/laporan', component: Laporan },
    // 4. Master Data CRUD
    { path: '/master/pegawai', component: MasterPegawai },
    { path: '/master/gaji', component: MasterGaji },
    { path: '/master/pejabat', component: MasterPejabat },
    { path: '/master/template', component: MasterTemplate },
    { path: '/master/golongan', component: MasterGolongan },
    { path: '/master/jabatan', component: MasterJabatan }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

// --- APLIKASI UTAMA ---
const app = createApp({
    components: { Sidebar, Auth },
    template: `
        <div v-if="store.isLoading" class="position-fixed top-0 start-0 w-100 h-100 bg-white d-flex justify-content-center align-items-center" style="z-index: 9999;">
            <div class="text-center">
                <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;" role="status"></div>
                <h6 class="text-muted fw-bold animate-pulse">Memuat Aplikasi...</h6>
            </div>
        </div>

        <div v-else-if="!store.user">
            <Auth />
        </div>

        <div v-else class="d-flex">
            <Sidebar @logout="handleLogout" />
            
            <div class="flex-grow-1 bg-light" style="height: 100vh; overflow-y: auto;">
                <router-view></router-view>
            </div>
        </div>
    `,
    setup() {
        const handleLogout = async () => {
            const confirmed = await showConfirm(
                'Keluar Aplikasi',
                'Apakah Anda yakin ingin mengakhiri sesi ini?',
                'Ya, Keluar'
            );

            if(confirmed) {
                store.setLoading(true);
                await signOut(auth);
                // Loading stop otomatis via listener
            }
        };
        
        // Listener Auth & Role Check
        onMounted(() => {
            onAuthStateChanged(auth, async (user) => {
                store.setLoading(true);
                
                if (user) {
                    console.log("User Login:", user.email);
                    // Ambil Role Admin dari Firestore
                    await store.fetchUserProfile(user); 
                } else {
                    console.log("User Logout");
                    store.user = null;
                    store.profile = null;
                }
                
                store.setLoading(false);
            });
        });

        return { store, handleLogout };
    }
});

app.use(router);
app.mount('#app');