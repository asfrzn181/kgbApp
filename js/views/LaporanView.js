import { store } from '../store.js';

export const TplLaporan = `
<div class="p-3 p-md-4">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
            <h3 class="fw-bold text-primary mb-1">Laporan & Analisis</h3>
            <p class="text-muted small mb-0">Export data KGB & Visualisasi Statistik Pegawai.</p>
        </div>
    </div>

    <div class="card shadow-sm border-0 mb-4">
        <div class="card-body bg-light p-3 p-md-4">
            <form @submit.prevent="fetchPreview">
                <div class="row g-3 align-items-end">
                    
                    <div class="col-12 col-md-2">
                        <label class="form-label small fw-bold text-muted">Jenis Tanggal</label>
                        <select v-model="filterType" class="form-select shadow-sm">
                            <option value="TMT">Berdasarkan TMT</option>
                            <option value="INPUT">Tanggal Input</option>
                        </select>
                    </div>

                    <div class="col-6 col-md-3">
                        <label class="form-label small fw-bold text-muted">Mulai Tanggal</label>
                        <input v-model="startDate" type="date" class="form-control shadow-sm" required>
                    </div>

                    <div class="col-6 col-md-3">
                        <label class="form-label small fw-bold text-muted">Sampai Tanggal</label>
                        <input v-model="endDate" type="date" class="form-control shadow-sm" required>
                    </div>

                    <div class="col-12 col-md-2" v-if="store.isAdmin">
                        <label class="form-label small fw-bold text-muted">Filter User</label>
                        <select v-model="selectedUser" class="form-select shadow-sm">
                            <option value="ALL">Semua User</option>
                            <option v-for="u in listUsers" :key="u.id" :value="u.id">{{ u.email }}</option>
                        </select>
                    </div>

                    <div class="col-12 col-md-2">
                        <button type="submit" class="btn btn-primary w-100 shadow-sm" :disabled="loading">
                            <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                            {{ loading ? 'Memuat...' : 'Analisis Data' }}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <div v-if="hasSearched && previewData.length > 0" class="row g-4 mb-5 fade-in">
        
        <div class="col-12 col-md-4">
            <div class="card shadow-sm h-100 border-0">
                <div class="card-header bg-white fw-bold small text-center">Komposisi Pegawai</div>
                <div class="card-body d-flex align-items-center justify-content-center" style="height: 250px;">
                    <canvas id="chartTipeAsn"></canvas>
                </div>
            </div>
        </div>

        <div class="col-12 col-md-4">
            <div class="card shadow-sm h-100 border-0">
                <div class="card-header bg-white fw-bold small text-center">Struktural (Inc. Pelaksana) vs Fungsional</div>
                <div class="card-body d-flex align-items-center justify-content-center" style="height: 250px;">
                    <canvas id="chartJabatan"></canvas>
                </div>
            </div>
        </div>

        <div class="col-12 col-md-4">
            <div class="card shadow-sm h-100 border-0">
                <div class="card-header bg-white fw-bold small text-center">Sebaran Golongan (Khusus PNS)</div>
                <div class="card-body d-flex align-items-center justify-content-center" style="height: 250px;">
                    <canvas id="chartGolongan"></canvas>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card shadow-sm border-0">
                <div class="card-header bg-white fw-bold small">Top 10 Unit Kerja Terbanyak</div>
                <div class="card-body">
                    <div style="height: 300px;">
                        <canvas id="chartUnitKerja"></canvas>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div v-if="hasSearched" class="fade-in">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 gap-2">
            <h5 class="fw-bold text-secondary mb-0">
                Rincian Data 
                <span class="badge bg-secondary ms-2">{{ previewData.length }} Data</span>
            </h5>
            <button v-if="previewData.length > 0" @click="downloadExcel" class="btn btn-success shadow-sm w-100 w-md-auto">
                <i class="bi bi-file-earmark-excel me-2"></i>Download Excel
            </button>
        </div>

        <div class="card shadow-sm border-0">
            <div class="card-body p-0">
                <div class="table-responsive" style="max-height: 500px;">
                    <table class="table table-hover table-striped mb-0 small" style="min-width: 1000px;">
                        <thead class="table-dark sticky-top">
                            <tr>
                                <th class="ps-3">Nama Pegawai</th>
                                <th>NIP</th>
                                <th>Golongan</th>
                                <th>Nomor SK</th>
                                <th>TMT Baru</th>
                                <th class="text-end">Gaji Lama</th>
                                <th class="text-end">Gaji Baru</th>
                                <th>Unit Kerja</th>
                                <th v-if="store.isAdmin">Input Oleh</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="previewData.length === 0">
                                <td colspan="9" class="text-center py-5 text-muted">Tidak ada data pada periode ini.</td>
                            </tr>
                            <tr v-else v-for="item in previewData" :key="item.id">
                                <td class="ps-3 fw-bold">{{ item.nama_snapshot }}</td>
                                <td class="font-monospace">{{ item.nip }}</td>
                                <td>{{ item.golongan }}</td>
                                <td>
                                    <span v-if="item.nomor_naskah" class="text-success fw-bold">{{ item.nomor_naskah }}</span>
                                    <span v-else class="text-muted fst-italic">-</span>
                                </td>
                                <td>{{ formatTanggal(item.tmt_sekarang) }}</td>
                                <td class="text-end text-muted">{{ formatRupiah(item.dasar_gaji_lama) }}</td>
                                <td class="text-end pe-4 fw-bold text-success">{{ formatRupiah(item.gaji_baru) }}</td>
                                <td class="text-truncate" style="max-width: 150px;" :title="item.unit_kerja">{{ item.unit_kerja }}</td>
                                <td v-if="store.isAdmin" class="text-muted fst-italic">{{ item.creator_email }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>
`;