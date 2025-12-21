import { store } from '../store.js';

export default {
    template: `
    <div class="d-flex flex-column flex-shrink-0 p-3 bg-white shadow-sm" style="width: 280px; min-height: 100vh;">
        
        <a href="#" class="d-flex align-items-center mb-3 mb-md-0 me-md-auto link-dark text-decoration-none border-bottom pb-3 w-100">
            <i class="bi bi-person-workspace fs-3 text-primary me-2"></i>
            <span class="fs-4 fw-bold text-primary">MAS</span>
        </a>
        
        <ul class="nav nav-pills flex-column mb-auto pt-2">
            
            <li class="nav-item">
                <router-link to="/" class="nav-link link-dark" active-class="active bg-primary text-white">
                    <i class="bi bi-speedometer2 me-2"></i> Dashboard
                </router-link>
            </li>
            
            <li class="mt-3 text-muted small fw-bold text-uppercase ls-1 ps-2">Transaksi</li>
            <li>
                <router-link to="/transaksi" class="nav-link link-dark" active-class="active bg-primary text-white">
                    <i class="bi bi-file-earmark-text me-2"></i> Input KGB
                </router-link>

                <router-link to="/penomoran" class="nav-link link-dark" active-class="bg-primary text-white">
                    <i class="bi bi-file-earmark-text me-2"></i> Penomoran KGB
                </router-link>

                <router-link to="/laporan" class="nav-link link-dark" active-class="active bg-primary text-white">
                    <i class="bi bi-printer me-2"></i> Laporan Rekap
                </router-link>
            </li>

            <li v-if="store.isAdmin" class="mt-3 text-muted small fw-bold text-uppercase ls-1 ps-2">Administrator</li>
            
            
            <li v-if="store.isAdmin" class="mt-3 text-muted small fw-bold text-uppercase ls-1 ps-2">Master Data</li>
            
            <li v-if="store.isAdmin">
                <router-link to="/master/pegawai" class="nav-link link-dark" active-class="active bg-primary text-white">
                    <i class="bi bi-people me-2"></i> Data Pegawai
                </router-link>
            </li>
            <li v-if="store.isAdmin">
                <router-link to="/master/jabatan" class="nav-link link-dark" active-class="active bg-primary text-white">
                    <i class="bi bi-briefcase me-2"></i> Data Jabatan
                </router-link>
            </li>
            <li v-if="store.isAdmin">
                <router-link to="/master/golongan" class="nav-link link-dark" active-class="active bg-primary text-white">
                    <i class="bi bi-bar-chart-steps me-2"></i> Golongan & Pangkat
                </router-link>
            </li>
            <li v-if="store.isAdmin">
                <router-link to="/master/gaji" class="nav-link link-dark" active-class="active bg-primary text-white">
                    <i class="bi bi-cash-coin me-2"></i> Tabel Gaji Pokok
                </router-link>
            </li>
            <li v-if="store.isAdmin">
                <router-link to="/master/pejabat" class="nav-link link-dark" active-class="active bg-primary text-white">
                    <i class="bi bi-pen-fill me-2"></i> Pejabat TTD
                </router-link>
            </li>
            
            <li v-if="store.isAdmin" class="mt-3 text-muted small fw-bold text-uppercase ls-1 ps-2">Konfigurasi</li>
            
            <li v-if="store.isAdmin">
                <router-link to="/master/template" class="nav-link link-dark" active-class="active bg-primary text-white">
                    <i class="bi bi-file-earmark-word me-2"></i> Template & SK
                </router-link>
            </li>

        </ul>
        
        <hr>
        
        <div class="dropdown">
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
    `,
    setup() {
        return { store };
    }
};