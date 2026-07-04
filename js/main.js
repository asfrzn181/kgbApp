import { createApp, onMounted } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { auth, onAuthStateChanged, signOut, db, doc, getDoc } from './firebase.js';
import { store } from './store.js';
import { showConfirm } from './utils.js'; 

// --- IMPORT KOMPONEN ---
import Sidebar from './components/Sidebar.js';
import Auth from './components/Auth.js';
import Dashboard from './components/Dashboard.js';
import Laporan from './components/Laporan.js';

// --- IMPORT MODUL UTAMA ---
import TransaksiKgb from './components/TransaksiKgb.js'; 
import MasterPegawai from './components/MasterPegawai.js'; 
import MasterGaji from './components/MasterGaji.js';
import MasterPejabat from './components/MasterPejabat.js';
import MasterTemplate from './components/MasterTemplate.js';
import MasterGolongan from './components/MasterGolongan.js';
import MasterJabatan from './components/MasterJabatan.js';
import Penomoran from './components/Penomoran.js';
import PenomoranInpassing from './components/PenomoranInpassing.js';
import CekDuplikat from './components/CekDuplikat.js';
import SkFungsional from './components/SkFungsional.js';

// --- KONFIGURASI ROUTER ---
const routes = [
    { path: '/', component: Dashboard },
    { path: '/transaksi', component: TransaksiKgb },
    { path: '/penomoran', component: Penomoran },
    { path: '/penomoran-inpassing', component: PenomoranInpassing },
    { path: '/laporan', component: Laporan },
    { path: '/duplikat', component: CekDuplikat },
    { path: '/sk-fungsional', component: SkFungsional },
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

// ============================================================
// --- MANAJEMEN SESI (AUTO LOGOUT 1 JAM) ---
// ============================================================
const SESSION_KEY      = 'kgb_session_expiry';
const SESSION_DURATION = 60 * 60 * 1000; // 1 jam dalam milidetik
let sessionTimerId = null;

const startSessionTimer = () => {
    const expiry = Date.now() + SESSION_DURATION;
    localStorage.setItem(SESSION_KEY, expiry.toString());
    sessionTimerId = setInterval(async () => {
        const stored = localStorage.getItem(SESSION_KEY);
        if (!stored) return;
        if (parseInt(stored) - Date.now() <= 0) {
            clearInterval(sessionTimerId);
            localStorage.removeItem(SESSION_KEY);
            alert('⏱️ Sesi Anda telah berakhir (1 jam). Silakan login kembali.');
            await signOut(auth);
        }
    }, 60 * 1000);
};

const clearSessionTimer = () => {
    clearInterval(sessionTimerId);
    sessionTimerId = null;
    localStorage.removeItem(SESSION_KEY);
};

// --- APLIKASI UTAMA ---
const app = createApp({
    components: { Sidebar, Auth },
    template: `
        <div v-if="store.isLoading" class="position-fixed top-0 start-0 w-100 h-100 bg-white d-flex justify-content-center align-items-center" style="z-index: 9999;">
            <div class="text-center">
                <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;" role="status"></div>
                <h6 class="text-secondary fw-bold animate-pulse">Memuat Aplikasi...</h6>
            </div>
        </div>

        <div v-else-if="!store.user">
            <Auth />
        </div>

        <div v-else class="d-flex flex-column flex-md-row vh-100 w-100 overflow-hidden">
            <Sidebar @logout="handleLogout" class="flex-shrink-0 border-end" />
            <div class="flex-grow-1 bg-light position-relative overflow-auto h-100 w-100">
                <div style="min-height: 100%;">
                    <router-view></router-view>
                </div>
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
            if (confirmed) {
                store.setLoading(true);
                await signOut(auth);
            }
        };

        // Listener Auth & Role Check
        onMounted(() => {
            onAuthStateChanged(auth, async (user) => {
                store.setLoading(true);

                if (user) {
                    // Cek sesi expired
                    const stored = localStorage.getItem(SESSION_KEY);
                    if (stored && Date.now() > parseInt(stored)) {
                        clearSessionTimer();
                        await signOut(auth);
                        store.setLoading(false);
                        return;
                    }

                    // Cek 2FA verification
                    const verified2FA = sessionStorage.getItem('kgb_2fa_ok');
                    if (verified2FA === user.uid) {
                        // 2FA sudah diverifikasi sesi ini — lanjut normal
                        if (!sessionTimerId) startSessionTimer();
                        await store.fetchUserProfile(user);
                    } else {
                        // Belum verifikasi 2FA — cek status setup di Firestore
                        store.pendingUser = user;
                        try {
                            const docSnap = await getDoc(doc(db, 'user_2fa', user.uid));
                            if (docSnap.exists() && docSnap.data().enabled) {
                                store.authStep = 'verify_2fa';
                            } else {
                                store.authStep = 'setup_2fa';
                            }
                        } catch (e) {
                            store.authStep = 'setup_2fa';
                        }
                    }
                } else {
                    clearSessionTimer();
                    sessionStorage.removeItem('kgb_2fa_ok');
                    store.user    = null;
                    store.profile = null;
                    store.pendingUser = null;
                    store.authStep    = 'login';
                }

                store.setLoading(false);
            });
        });

        return { store, handleLogout };
    }
});

app.use(router);
app.mount('#app');