import { formatTanggal, formatRupiah, formatTmtPendek, hitungHariLagi } from '../utils.js';

export const TplDashboard = `
<div class="p-3 p-md-4">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
            <h3 class="fw-bold text-primary mb-1">Dashboard</h3>
            <p class="text-muted small mb-0">Selamat datang, <strong>{{ store.user?.email }}</strong>.</p>
        </div>
    </div>

    <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-white py-3">
            <h6 class="fw-bold mb-0 text-secondary"><i class="bi bi-graph-up-arrow me-2"></i>Statistik Usulan Tahun {{ currentYear }}</h6>
        </div>
        <div class="card-body">
            <div class="row g-3 g-md-4 text-center">
                <div class="col-6 col-md-3">
                    <div class="p-3 rounded bg-primary bg-opacity-10 h-100 d-flex flex-column justify-content-center">
                        <h2 class="fw-bold text-primary mb-0">{{ stats.q1 }}</h2>
                        <small class="text-uppercase fw-bold text-muted" style="font-size: 0.7rem;">Triwulan I (Jan-Mar)</small>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="p-3 rounded bg-success bg-opacity-10 h-100 d-flex flex-column justify-content-center">
                        <h2 class="fw-bold text-success mb-0">{{ stats.q2 }}</h2>
                        <small class="text-uppercase fw-bold text-muted" style="font-size: 0.7rem;">Triwulan II (Apr-Jun)</small>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="p-3 rounded bg-warning bg-opacity-10 h-100 d-flex flex-column justify-content-center">
                        <h2 class="fw-bold text-warning mb-0">{{ stats.q3 }}</h2>
                        <small class="text-uppercase fw-bold text-muted" style="font-size: 0.7rem;">Triwulan III (Jul-Sep)</small>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="p-3 rounded bg-info bg-opacity-10 h-100 d-flex flex-column justify-content-center">
                        <h2 class="fw-bold text-info mb-0">{{ stats.q4 }}</h2>
                        <small class="text-uppercase fw-bold text-muted" style="font-size: 0.7rem;">Triwulan IV (Okt-Des)</small>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-4">
        <div class="col-12 col-lg-4">
            
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
                    <ul v-else class="list-group list-group-flush small" style="max-height: 300px; overflow-y: auto;">
                        <li v-for="item in listReminder" :key="item.id" class="list-group-item d-flex justify-content-between align-items-start bg-transparent">
                            <div class="me-2">
                                <div class="fw-bold text-dark text-truncate" style="max-width: 150px;">{{ item.nama_snapshot || item.nama }}</div>
                                <div class="text-muted text-truncate" style="max-width: 150px; font-size: 0.75rem;">{{ item.nip }}</div>
                            </div>
                            <div class="text-end flex-shrink-0">
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

        <div class="col-12 col-lg-8">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                    <h6 class="mb-0 fw-bold text-secondary"><i class="bi bi-clock-history me-2"></i>Riwayat Usulan Terakhir</h6>
                    <button class="btn btn-sm btn-light border text-primary" @click="fetchRecent">
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0 small" style="min-width: 600px;">
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
</div>
`;