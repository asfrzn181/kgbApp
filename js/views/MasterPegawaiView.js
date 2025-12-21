export const TplMasterPegawai = `
<div class="p-4">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
        <div>
            <h3 class="fw-bold text-primary mb-1">Master Pegawai</h3>
            <p class="text-muted small mb-0">Total Data: {{ totalEstimasi > 0 ? totalEstimasi + '+' : '...' }} Pegawai</p>
        </div>
        
        <div class="d-flex gap-2">
             <button @click="hitungStatistik" class="btn btn-outline-primary shadow-sm" :disabled="loadingStats">
                <i class="bi" :class="loadingStats ? 'bi-hourglass-split' : 'bi-pie-chart-fill'"></i>
                {{ loadingStats ? 'Menghitung...' : 'Refresh Rekap Generasi' }}
            </button>
        </div>
    </div>

    <div class="row g-3 mb-4" v-if="stats.total > 0">
        <div class="col">
            <div class="card border-0 shadow-sm border-start border-4 border-secondary h-100">
                <div class="card-body p-2 ps-3">
                    <div class="text-muted small fw-bold text-uppercase">Baby Boomers</div>
                    <div class="fs-4 fw-bold">{{ stats.boomers }}</div>
                    <div class="small text-muted">1946-1964</div>
                </div>
            </div>
        </div>
        <div class="col">
            <div class="card border-0 shadow-sm border-start border-4 border-success h-100">
                <div class="card-body p-2 ps-3">
                    <div class="text-muted small fw-bold text-uppercase">Gen X</div>
                    <div class="fs-4 fw-bold">{{ stats.genx }}</div>
                    <div class="small text-muted">1965-1980</div>
                </div>
            </div>
        </div>
        <div class="col">
            <div class="card border-0 shadow-sm border-start border-4 border-primary h-100">
                <div class="card-body p-2 ps-3">
                    <div class="text-muted small fw-bold text-uppercase">Millennials</div>
                    <div class="fs-4 fw-bold">{{ stats.millennials }}</div>
                    <div class="small text-muted">1981-1996</div>
                </div>
            </div>
        </div>
        <div class="col">
            <div class="card border-0 shadow-sm border-start border-4 border-info h-100">
                <div class="card-body p-2 ps-3">
                    <div class="text-muted small fw-bold text-uppercase">Gen Z</div>
                    <div class="fs-4 fw-bold">{{ stats.genz }}</div>
                    <div class="small text-muted">1997-2012</div>
                </div>
            </div>
        </div>
        <div class="col">
            <div class="card border-0 shadow-sm border-start border-4 border-warning h-100">
                <div class="card-body p-2 ps-3">
                    <div class="text-muted small fw-bold text-uppercase">Gen Alpha</div>
                    <div class="fs-4 fw-bold">{{ stats.alpha }}</div>
                    <div class="small text-muted">2013+</div>
                </div>
            </div>
        </div>
    </div>

    <div class="d-flex justify-content-between mb-3">
        <div class="input-group shadow-sm" style="width: 300px;">
            <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
            <input v-model="searchQuery" type="text" class="form-control border-start-0 ps-0" placeholder="Cari NIP (Ketik 4 digit)...">
        </div>

        <div class="d-flex gap-2">
            <input type="file" ref="fileInput" @change="handleImportExcel" hidden accept=".xlsx, .xls" />
            <button @click="$refs.fileInput.click()" class="btn btn-success shadow-sm" :disabled="isImporting">
                <span v-if="isImporting" class="spinner-border spinner-border-sm me-1"></span>
                <span v-else><i class="bi bi-file-earmark-excel me-1"></i> Import</span>
            </button>
            <button @click="openModal()" class="btn btn-primary shadow-sm">
                <i class="bi bi-person-plus-fill me-1"></i> Tambah
            </button>
        </div>
    </div>

    <div class="card shadow-sm border-0">
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th class="ps-4 cursor-pointer" @click="changeSort('nip')">
                                Identitas Pegawai <i class="bi" :class="getSortIcon('nip')"></i>
                            </th>
                            <th class="cursor-pointer" @click="changeSort('tempat_lahir')">
                                Generasi / Gender <i class="bi" :class="getSortIcon('tempat_lahir')"></i>
                            </th>
                            <th class="cursor-pointer" @click="changeSort('perangkat_daerah')">
                                Perangkat Daerah <i class="bi" :class="getSortIcon('perangkat_daerah')"></i>
                            </th>
                            <th class="text-end pe-4">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading">
                            <td colspan="4" class="text-center py-5 text-muted">
                                <div class="spinner-border spinner-border-sm text-primary me-2"></div> Memuat data...
                            </td>
                        </tr>
                        <tr v-else-if="listData.length === 0">
                            <td colspan="4" class="text-center py-5 text-muted">
                                <i class="bi bi-inbox fs-1 d-block mb-2 opacity-25"></i>
                                Data tidak ditemukan.
                            </td>
                        </tr>
                        <tr v-else v-for="item in listData" :key="item.nip">
                            <td class="ps-4">
                                <div class="fw-bold text-dark font-monospace bg-light d-inline px-1 rounded">{{ item.nip }}</div>
                                <div class="text-primary fw-bold mt-1">{{ item.nama }}</div>
                            </td>
                            <td>
                                <span class="badge mb-1" :class="getGenColor(getInfoNip(item.nip).generation)">
                                    {{ getInfoNip(item.nip).generation }}
                                </span>
                                <div class="small text-muted d-flex align-items-center">
                                    <i class="bi bi-calendar-event me-1"></i> 
                                    {{ item.tempat_lahir || '?' }}, {{ getInfoNip(item.nip).tgl }}
                                </div>
                                <div class="small text-muted mt-1">
                                    <i class="bi" :class="getInfoNip(item.nip).genderIcon"></i> 
                                    {{ getInfoNip(item.nip).gender }}
                                </div>
                            </td>
                            <td><span class="badge bg-light text-secondary border text-wrap text-start">{{ item.perangkat_daerah || '-' }}</span></td>
                            <td class="text-end pe-4">
                                <button @click="openModal(item)" class="btn btn-sm btn-light border me-1 text-primary"><i class="bi bi-pencil-square"></i></button>
                                <button @click="hapusData(item)" class="btn btn-sm btn-light border text-danger"><i class="bi bi-trash"></i></button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="card-footer bg-white d-flex justify-content-between align-items-center py-3">
            <div class="small text-muted">
                Halaman {{ currentPage }}
            </div>
            <div>
                <button class="btn btn-sm btn-outline-secondary me-1" @click="prevPage" :disabled="currentPage === 1 || loading">
                    <i class="bi bi-chevron-left"></i> Prev
                </button>
                <button class="btn btn-sm btn-outline-primary" @click="nextPage" :disabled="isLastPage || loading">
                    Next <i class="bi bi-chevron-right"></i>
                </button>
            </div>
        </div>
    </div>

    <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);" tabindex="-1" @click.self="closeModal">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title fw-bold">{{ isEdit ? 'Edit Data' : 'Tambah Data' }}</h5>
                    <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                </div>
                <div class="modal-body p-4">
                    <form @submit.prevent="simpanData">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">NIP</label>
                            <input v-model="form.nip" class="form-control" :disabled="isEdit" placeholder="1985..." required>
                            <div class="form-text small" v-if="form.nip.length >= 4">
                                Generasi: <span class="fw-bold">{{ getInfoNip(form.nip).generation }}</span>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Nama Lengkap</label>
                            <input v-model="form.nama" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Tempat Lahir</label>
                            <input v-model="form.tempat_lahir" class="form-control">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Perangkat Daerah</label>
                            <input v-model="form.perangkat_daerah" class="form-control">
                        </div>
                        <div class="d-grid mt-4">
                            <button type="submit" class="btn btn-primary py-2" :disabled="isSaving">
                                {{ isSaving ? 'Menyimpan...' : 'Simpan Data' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
`;