import { store } from '../store.js';

export const TplLaporanJabfung = `
<div class="p-3 p-md-4">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
            <h3 class="fw-bold mb-1" style="color:#5c35a5;">
                <i class="bi bi-file-earmark-person me-2"></i>Laporan Rekap SK Jabatan Fungsional
            </h3>
            <p class="text-muted small mb-0">Analisis & export data SK Jabfung berdasarkan rentang tanggal.</p>
        </div>
    </div>

    <!-- FILTER FORM -->
    <div class="card shadow-sm border-0 mb-4">
        <div class="card-body bg-light p-3 p-md-4">
            <form @submit.prevent="fetchPreview">
                <div class="row g-3 align-items-end">

                    <div class="col-12 col-md-2">
                        <label class="form-label small fw-bold text-muted">Jenis Tanggal</label>
                        <select v-model="filterType" class="form-select shadow-sm">
                            <option value="TMT">Berdasarkan TMT Jabatan</option>
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

                    <div class="col-12 col-md-2">
                        <label class="form-label small fw-bold text-muted">Status</label>
                        <select v-model="filterStatus" class="form-select shadow-sm">
                            <option value="ALL">Semua Status</option>
                            <option value="SELESAI">SK Selesai</option>
                            <option value="DRAFT">Draft Belum Selesai</option>
                        </select>
                    </div>

                    <div class="col-12 col-md-2">
                        <button type="submit" class="btn w-100 shadow-sm text-white" style="background:#5c35a5;" :disabled="loading">
                            <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                            {{ loading ? 'Memuat...' : 'Analisis Data' }}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- GRAFIK -->
    <div v-if="hasSearched && previewData.length > 0" class="row g-4 mb-5 fade-in">

        <div class="col-12 col-md-4">
            <div class="card shadow-sm h-100 border-0">
                <div class="card-header bg-white fw-bold small text-center">Sebaran Kategori Jabatan</div>
                <div class="card-body d-flex align-items-center justify-content-center" style="height: 250px;">
                    <canvas id="chartKategori"></canvas>
                </div>
            </div>
        </div>

        <div class="col-12 col-md-4">
            <div class="card shadow-sm h-100 border-0">
                <div class="card-header bg-white fw-bold small text-center">Sebaran Pangkat/Golongan</div>
                <div class="card-body d-flex align-items-center justify-content-center" style="height: 250px;">
                    <canvas id="chartGolongan"></canvas>
                </div>
            </div>
        </div>

        <div class="col-12 col-md-4">
            <div class="card shadow-sm h-100 border-0">
                <div class="card-header bg-white fw-bold small text-center">Status SK</div>
                <div class="card-body d-flex align-items-center justify-content-center" style="height: 250px;">
                    <canvas id="chartStatus"></canvas>
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

    <!-- TABEL PREVIEW -->
    <div v-if="hasSearched" class="fade-in">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 gap-2">
            <div>
                <h5 class="fw-bold text-secondary mb-0">
                    Rincian Data
                    <span class="badge bg-secondary ms-2">{{ filteredData.length }} Data</span>
                </h5>
                <div v-if="activeChartFilter" class="mt-2">
                    <span class="badge text-white p-2" style="background:#5c35a5;">
                        <i class="bi bi-funnel-fill me-1"></i> Filter: {{ activeChartFilter.label }}
                    </span>
                    <button @click="clearChartFilter" class="btn btn-sm btn-outline-danger ms-2" style="padding: 2px 8px; font-size: 0.8rem;">
                        <i class="bi bi-x-lg"></i> Hapus Filter
                    </button>
                </div>
            </div>
            <button v-if="filteredData.length > 0" @click="downloadExcel"
                class="btn shadow-sm w-100 w-md-auto mt-2 mt-md-0 align-self-md-start text-white"
                style="background:#5c35a5;">
                <i class="bi bi-file-earmark-excel me-2"></i>Download Excel
            </button>
        </div>

        <div v-if="filteredData.length === 0 && hasSearched" class="card border-0 shadow-sm">
            <div class="card-body text-center py-5 text-muted">
                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                Tidak ada data pada rentang tanggal / filter yang dipilih.
            </div>
        </div>

        <div v-else class="card shadow-sm border-0">
            <div class="card-body p-0">
                <div class="table-responsive" style="max-height: 500px;">
                    <table class="table table-hover table-striped mb-0 small" style="min-width: 1100px;">
                        <thead class="sticky-top text-white" style="background:#5c35a5;">
                            <tr>
                                <th class="ps-3">Nama</th>
                                <th>NIP</th>
                                <th>Pangkat/Gol</th>
                                <th>Jabatan Baru</th>
                                <th>Kategori</th>
                                <th>TMT Jabatan</th>
                                <th>Nomor SK</th>
                                <th>Unit Kerja</th>
                                <th>Status</th>
                                <th>Tgl Input</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in filteredData" :key="item.id">
                                <td class="ps-3 fw-bold">{{ item.nama }}</td>
                                <td class="font-monospace">{{ item.nip }}</td>
                                <td>{{ item.pangkat_golongan }}</td>
                                <td class="text-truncate" style="max-width: 160px;" :title="item.jabatan_baru">{{ item.jabatan_baru }}</td>
                                <td>
                                    <span class="badge bg-primary bg-opacity-10 text-primary border border-primary">{{ item.kategori_jabatan || '-' }}</span>
                                </td>
                                <td>{{ formatTanggal(item.tmt_jabatan) }}</td>
                                <td>
                                    <span v-if="item.nomor_naskah" class="text-success fw-bold">{{ item.nomor_naskah }}</span>
                                    <span v-else class="text-muted fst-italic">-</span>
                                </td>
                                <td class="text-truncate" style="max-width: 140px;" :title="item.unit_kerja">{{ item.unit_kerja }}</td>
                                <td>
                                    <span v-if="(item.status || 'DRAFT') === 'SELESAI'" class="badge bg-success bg-opacity-10 text-success border border-success">Selesai</span>
                                    <span v-else class="badge bg-warning bg-opacity-10 text-warning border border-warning">Draft</span>
                                </td>
                                <td class="text-muted">{{ item.created_at_str }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>
`;

