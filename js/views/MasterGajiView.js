import { formatRupiah } from '../utils.js';

export const TplMasterGaji = `
<div class="p-3 p-md-4">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
            <h3 class="fw-bold text-primary mb-1">Master Gaji Pokok</h3>
            
            <div class="d-flex align-items-center mt-2">
                <span class="badge bg-white text-dark border shadow-sm px-3 py-2 rounded-pill">
                    <i class="bi bi-database-check text-success me-2"></i>
                    Total Server: <strong class="ms-1">{{ totalReal }}</strong> Data
                </span>
                <button @click="hitungTotalReal" class="btn btn-sm btn-link text-decoration-none ms-2" title="Refresh Counter">
                    <i class="bi bi-arrow-clockwise fs-5"></i>
                </button>
            </div>
        </div>
        
        <div class="d-flex flex-column flex-md-row gap-2">
            <div class="input-group shadow-sm w-100 w-md-auto">
                <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                <input v-model="searchQuery" type="text" class="form-control border-start-0 ps-0" placeholder="Cari Golongan...">
            </div>

            <div class="d-flex gap-2">
                <input type="file" ref="fileInput" @change="handleImportExcel" hidden accept=".xlsx, .xls" />
                <button @click="$refs.fileInput.click()" class="btn btn-success shadow-sm flex-fill text-nowrap" :disabled="isImporting">
                    <span v-if="isImporting" class="spinner-border spinner-border-sm me-1"></span>
                    <span v-else><i class="bi bi-file-earmark-excel me-1"></i> Import</span>
                </button>

                <button @click="openModal()" class="btn btn-primary shadow-sm flex-fill text-nowrap">
                    <i class="bi bi-plus-lg me-1"></i> Tambah
                </button>
            </div>
        </div>
    </div>

    <div class="card shadow-sm border-0">
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" style="min-width: 600px;">
                    <thead class="table-light">
                        <tr>
                            <th class="ps-4">Golongan</th>
                            <th>Masa Kerja (MKG)</th>
                            <th>Gaji Pokok</th>
                            <th class="text-end pe-4">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading">
                            <td colspan="4" class="text-center py-5 text-muted">Loading...</td>
                        </tr>
                        <tr v-else-if="listData.length === 0">
                            <td colspan="4" class="text-center py-5 text-muted">Data tidak ditemukan.</td>
                        </tr>
                        <tr v-else v-for="item in listData" :key="item.id">
                            <td class="ps-4 fw-bold text-primary">{{ item.golongan }}</td>
                            <td>
                                <span class="badge bg-light text-dark border">{{ item.mkg }} Tahun</span>
                            </td>
                            <td class="fw-bold text-success">{{ formatRupiah(item.gaji) }}</td>
                            <td class="text-end pe-4">
                                <div class="btn-group">
                                    <button @click="openModal(item)" class="btn btn-sm btn-light border text-primary" title="Edit">
                                        <i class="bi bi-pencil-square"></i>
                                    </button>
                                    <button @click="hapusData(item)" class="btn btn-sm btn-light border text-danger" title="Hapus">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
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
        <div class="modal-dialog modal-dialog-centered modal-fullscreen-sm-down">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title fw-bold">{{ isEdit ? 'Edit Gaji' : 'Tambah Gaji' }}</h5>
                    <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                </div>
                <div class="modal-body p-4">
                    <form @submit.prevent="simpanData">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Golongan</label>
                            <input v-model="form.golongan" class="form-control" :disabled="isEdit" placeholder="III/a" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Masa Kerja (Tahun)</label>
                            <input v-model.number="form.mkg" type="number" class="form-control" :disabled="isEdit" min="0" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Gaji Pokok</label>
                            <input v-model.number="form.gaji" type="number" class="form-control" required>
                        </div>
                        
                        <div class="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                             <button type="button" class="btn btn-light border px-4 py-2" @click="closeModal">Batal</button>
                            <button type="submit" class="btn btn-primary px-4 py-2 shadow-sm" :disabled="isSaving">Simpan Data</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
`;