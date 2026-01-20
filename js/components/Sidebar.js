import { ref, onMounted, onUnmounted, computed } from 'vue';
import { store } from '../store.js';
import { showConfirm } from '../utils.js'; // Pastikan import showConfirm

export default {
    template: `
    <div class="d-flex flex-column flex-shrink-0 p-3 bg-white shadow-sm border-end" 
         :style="containerStyle">
        
        <div class="d-flex align-items-center justify-content-between mb-md-0 me-md-auto w-100" 
             :class="{'mb-3': (isOpen && !isDesktop) || isDesktop}">
            
            <a href="#" class="d-flex align-items-center link-dark text-decoration-none">
                <i class="bi bi-person-workspace fs-3 text-primary me-2"></i>
                <span class="fs-4 fw-bold text-primary">MAS PRI</span>
            </a>
            
            <button class="btn btn-light border d-md-none" type="button" @click.stop="toggleMenu">
                <i class="bi" :class="isOpen ? 'bi-x-lg text-danger' : 'bi-list'"></i>
            </button>
        </div>
        
        <div v-if="isDesktop || isOpen" class="d-flex flex-column flex-grow-1 overflow-hidden animate-fade">
            
            <hr class="text-secondary opacity-25 my-2">

            <ul class="nav nav-pills flex-column mb-auto pt-2 overflow-auto" style="scrollbar-width: thin;">
                
                <li class="nav-item">
                    <router-link to="/" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                        <i class="bi bi-speedometer2 me-2"></i> Dashboard
                    </router-link>
                </li>
                
                <li class="mt-3 text-muted small fw-bold text-uppercase ls-1 ps-2">Transaksi</li>
                <li>
                    <router-link to="/transaksi" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                        <i class="bi bi-pencil-square me-2"></i> Input KGB
                    </router-link>

                    <router-link to="/penomoran" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                        <i class="bi bi-123 me-2"></i> Penomoran SPT KGB
                    </router-link>

                    <router-link to="/penomoran-inpassing" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                        <i class="bi bi-stars me-2"></i> Inpassing KGB
                    </router-link>

                    <router-link to="/laporan" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                        <i class="bi bi-printer me-2"></i> Laporan Rekap
                    </router-link>
                </li>

                <div v-if="store.isAdmin">

                               
                    <li class="nav-item">
                        <router-link to="/duplikat" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                            <i class="bi bi-speedometer2 me-2"></i> Cek Duplikat
                        </router-link>
                    </li>
                    <li class="mt-3 text-muted small fw-bold text-uppercase ls-1 ps-2">Master Data</li>
                    
                    <li>
                        <router-link to="/master/pegawai" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                            <i class="bi bi-people me-2"></i> Data Pegawai
                        </router-link>
                    </li>
                    <li>
                        <router-link to="/master/jabatan" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                            <i class="bi bi-briefcase me-2"></i> Data Jabatan
                        </router-link>
                    </li>
                    <li>
                        <router-link to="/master/golongan" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                            <i class="bi bi-bar-chart-steps me-2"></i> Golongan
                        </router-link>
                    </li>
                    <li>
                        <router-link to="/master/gaji" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                            <i class="bi bi-cash-coin me-2"></i> Tabel Gaji
                        </router-link>
                    </li>
                    <li>
                        <router-link to="/master/pejabat" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                            <i class="bi bi-pen-fill me-2"></i> Pejabat TTD
                        </router-link>
                    </li>
                    
                    <li class="mt-3 text-muted small fw-bold text-uppercase ls-1 ps-2">Konfigurasi</li>
                    
                    <li>
                        <router-link to="/master/template" class="nav-link link-dark" active-class="active bg-primary text-white" @click="handleMobileClick">
                            <i class="bi bi-file-earmark-word me-2"></i> Template & SK
                        </router-link>
                    </li>
                </div>
            </ul>
            
            <hr class="text-secondary opacity-25 mt-2">
            
            <button @click="hardReset" class="btn btn-outline-warning btn-sm w-100 mb-3 d-flex align-items-center justify-content-center" title="Klik jika aplikasi error atau ada update baru">
                <i class="bi bi-arrow-clockwise me-2"></i> Update / Refresh
            </button>

            <div class="dropdown pb-2">
                <a href="#" class="d-flex align-items-center link-dark text-decoration-none dropdown-toggle p-2 rounded hover-bg-light" id="dropdownUser2" data-bs-toggle="dropdown" aria-expanded="false">
                    <div class="bg-primary bg-opacity-10 text-primary rounded-circle p-2 me-2 d-flex justify-content-center align-items-center" style="width: 32px; height: 32px;">
                        <i class="bi bi-person-fill"></i>
                    </div>
                    <div class="small text-truncate" style="max-width: 160px;">
                        <div class="fw-bold">{{ store.isAdmin ? 'Administrator' : 'Staff User' }}</div>
                        <div class="text-muted" style="font-size: 0.75rem;">{{ store.user?.email }}</div>
                    </div>
                </a>
                <ul class="dropdown-menu text-small shadow border-0" aria-labelledby="dropdownUser2">
                    <li><a class="dropdown-item text-danger" href="#" @click.prevent="$emit('logout')"><i class="bi bi-box-arrow-right me-2"></i> Keluar</a></li>
                </ul>
            </div>
        </div>
    </div>
    `,
    setup() {
        const isOpen = ref(false);
        const windowWidth = ref(window.innerWidth);

        // Computed Property untuk Cek Desktop/Mobile
        const isDesktop = computed(() => windowWidth.value >= 768);

        // Style Container Dinamis
        const containerStyle = computed(() => {
            if (isDesktop.value) {
                // Desktop: Lebar tetap, Tinggi full
                return { width: '280px', height: '100%', minHeight: '100vh' };
            } else {
                // Mobile: Lebar full, Tinggi otomatis sesuai isi
                return { width: '100%', height: 'auto' };
            }
        });

        // Toggle Menu (Buka/Tutup)
        const toggleMenu = () => {
            isOpen.value = !isOpen.value;
        };

        // Tutup otomatis saat link diklik (khusus mobile)
        const handleMobileClick = () => {
            if (!isDesktop.value) {
                isOpen.value = false;
            }
        };

        // Listener Resize Layar
        const handleResize = () => {
            windowWidth.value = window.innerWidth;
            if (isDesktop.value) {
                isOpen.value = false; // Reset saat kembali ke mode desktop
            }
        };

        // --- FITUR HARD RESET (PENYELAMAT CACHE GITHUB PAGES) ---
        const hardReset = async () => {
            const confirmed = await showConfirm(
                'Update Aplikasi?', 
                'Ini akan menghapus cache browser dan memuat ulang kode terbaru dari server. Gunakan ini jika ada fitur baru yang belum muncul.',
                'Ya, Update Sekarang'
            );

            if (confirmed) {
                store.setLoading(true); // Tampilkan Loading Spinner "MAS PRI"

                // 1. Hapus Service Worker (Penting untuk PWA)
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                        console.log('SW Unregistered');
                    }
                }

                // 2. Hapus Cache Storage (Cache API)
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(key => caches.delete(key)));
                    console.log('Cache Storage Cleared');
                }

                // 3. Force Reload dengan Timestamp (Cache Busting)
                // Ini memaksa browser menganggap index.html adalah halaman baru
                const url = new URL(window.location.href);
                url.searchParams.set('force_update', Date.now());
                window.location.href = url.toString();
            }
        };

        onMounted(() => {
            window.addEventListener('resize', handleResize);
        });

        onUnmounted(() => {
            window.removeEventListener('resize', handleResize);
        });

        return { 
            store, 
            isOpen, isDesktop, containerStyle, 
            toggleMenu, handleMobileClick, hardReset 
        };
    }
};