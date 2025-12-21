export const TplMasterPejabat = `
<div class="p-4">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
        <div class="mb-3 mb-md-0">
            <h3 class="fw-bold text-primary mb-1">Master Pejabat</h3>
            <p class="text-muted small mb-0">Daftar Pejabat Penandatangan SK (Bupati/Kepala Dinas)</p>
            
            <div class="mt-2">
                <span class="badge bg-light text-dark border">
                    Total: <strong>{{ totalReal }}</strong> Data
                </span>
            </div>
        </div>
        
        <div class="d-flex gap-2 flex-wrap">
            <div class="input-group shadow-sm" style="width: 250px;">
                <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                <input v-model="searchQuery" type="text" class="form-control border-start-0 ps-0" placeholder="Cari NIP Pejabat...">
            </div>

            <input type="file" ref="fileInput" @change="handleImportExcel" hidden accept=".xlsx, .xls" />
            <button @click="$refs.fileInput.click()" class="btn btn-success shadow-sm" :disabled="isImporting">
                <span v-if="isImporting" class="spinner-border spinner-border-sm me-1"></span>
                <span v-else><i class="bi bi-file-earmark-excel me-1"></i> Import</span>
            </button>

            <button @click="openModal()" class="btn btn-primary shadow-sm">
                <i class="bi bi-plus-lg me-1"></i> Tambah
            </button>
        </div>
    </div>

    <div class="card shadow-sm border-0">
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th class="ps-4">NIP / Nama</th>
                            <th>Jabatan</th>
                            <th>Pangkat</th>
                            <th class="text-end pe-4">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading">
                            <td colspan="4" class="text-center py-5 text-muted">Loading...</td>
                        </tr>
                        <tr v-else-if="listData.length === 0">
                            <td colspan="4" class="text-center py-5 text-muted">Belum ada data pejabat.</td>
                        </tr>
                        <tr v-else v-for="item in listData" :key="item.nip">
                            <td class="ps-4">
                                <div class="fw-bold text-dark font-monospace">{{ item.nip }}</div>
                                <div class="text-primary fw-bold">{{ item.nama }}</div>
                            </td>
                            <td>
                                <div class="fw-bold text-dark">{{ item.jabatan }}</div>
                            </td>
                            <td>
                                <span class="badge bg-info text-dark bg-opacity-10 border border-info">{{ item.pangkat }}</span>
                            </td>
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
            <div class="small text-muted">Halaman {{ currentPage }}</div>
            <div>
                <button class="btn btn-sm btn-outline-secondary me-1" @click="prevPage" :disabled="currentPage === 1 || loading">Prev</button>
                <button class="btn btn-sm btn-outline-primary" @click="nextPage" :disabled="isLastPage || loading">Next</button>
            </div>
        </div>
    </div>

    <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5);" tabindex="-1" @click.self="closeModal">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title fw-bold">{{ isEdit ? 'Edit Pejabat' : 'Tambah Pejabat' }}</h5>
                    <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                </div>
                <div class="modal-body p-4">
                    <form @submit.prevent="simpanData">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">NIP</label>
                            <input v-model="form.nip" class="form-control" :disabled="isEdit" placeholder="NIP Pejabat" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Nama Lengkap</label>
                            <input v-model="form.nama" class="form-control" placeholder="Nama beserta gelar" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Jabatan</label>
                            <input v-model="form.jabatan" class="form-control" placeholder="Contoh: BUPATI BANGKA" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Pangkat / Golongan</label>
                            <input v-model="form.pangkat" class="form-control" placeholder="Contoh: Pembina Utama Madya (IV/d)" required>
                        </div>
                        
                        <div class="d-grid mt-4">
                            <button type="submit" class="btn btn-primary" :disabled="isSaving">Simpan Data</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
`;