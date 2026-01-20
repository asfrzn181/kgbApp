export const TplMasterGolongan = `
<div class="p-3 p-md-4">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
            <h3 class="fw-bold text-primary mb-1">Master Golongan & Pangkat</h3>
            <p class="text-muted small mb-0">Referensi kepangkatan PNS dan PPPK.</p>
        </div>
        
        <div class="d-flex flex-wrap gap-2">
            <input type="file" ref="fileInput" @change="handleImportExcel" hidden accept=".xlsx, .xls" />
            <button @click="$refs.fileInput.click()" class="btn btn-success shadow-sm flex-fill text-nowrap" :disabled="isSaving">
                <span v-if="isImporting" class="spinner-border spinner-border-sm me-1"></span>
                <span v-else><i class="bi bi-file-earmark-excel me-1"></i> Import</span>
            </button>

            <button @click="resetDefault" class="btn btn-outline-danger shadow-sm flex-fill text-nowrap" :disabled="isSaving">
                <i class="bi bi-database-fill-gear me-1"></i> Reset
            </button>

            <button @click="openModal()" class="btn btn-primary shadow-sm flex-fill text-nowrap">
                <i class="bi bi-plus-lg me-1"></i> Tambah
            </button>
        </div>
    </div>

    <ul class="nav nav-pills nav-justified mb-3 bg-white p-1 rounded border shadow-sm" style="max-width: 400px;">
        <li class="nav-item">
            <a class="nav-link cursor-pointer rounded" :class="{ active: filterTipe === 'PNS' }" @click="filterTipe = 'PNS'">PNS</a>
        </li>
        <li class="nav-item">
            <a class="nav-link cursor-pointer rounded" :class="{ active: filterTipe === 'PPPK' }" @click="filterTipe = 'PPPK'">PPPK</a>
        </li>
    </ul>

    <div class="card shadow-sm border-0">
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" style="min-width: 600px;">
                    <thead class="table-light">
                        <tr>
                            <th class="ps-4">Kode Golongan</th>
                            <th>Nama Pangkat</th>
                            <th>Kelompok (Ruang)</th>
                            <th class="text-end pe-4">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading"><td colspan="4" class="text-center py-5">Loading...</td></tr>
                        <tr v-else-if="filteredList.length === 0"><td colspan="4" class="text-center py-5">Data kosong. Silakan Import atau Reset Default.</td></tr>
                        
                        <tr v-else v-for="item in filteredList" :key="item.id">
                            <td class="ps-4 fw-bold font-monospace text-primary">{{ item.kode }}</td>
                            <td class="fw-bold">{{ item.pangkat }}</td>
                            <td><span class="badge bg-light text-dark border">Gol. {{ item.group }}</span></td>
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
    </div>

    <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5);" tabindex="-1" @click.self="closeModal">
        <div class="modal-dialog modal-dialog-centered modal-fullscreen-sm-down">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title fw-bold">{{ isEdit ? 'Edit' : 'Tambah' }} Golongan</h5>
                    <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                </div>
                <div class="modal-body p-4">
                    <form @submit.prevent="simpanData">
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Tipe ASN</label>
                            <select v-model="form.tipe" class="form-select" :disabled="isEdit">
                                <option value="PNS">PNS</option>
                                <option value="PPPK">PPPK</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Kelompok (Group)</label>
                            <input v-model="form.group" class="form-control" placeholder="Contoh: III" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted">Kode Golongan (ID)</label>
                            <input v-model="form.kode" class="form-control" :disabled="isEdit" placeholder="Contoh: III/a" required>
                        </div>
                        <div class="mb-4">
                            <label class="form-label small fw-bold text-muted">Nama Pangkat</label>
                            <input v-model="form.pangkat" class="form-control" placeholder="Contoh: Penata Muda" required>
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