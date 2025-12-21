import { store } from '../store.js';

export const TplPenomoran = `
<div class="p-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h3 class="fw-bold text-primary mb-1">Registrasi Nomor SK</h3>
            <p class="text-muted small mb-0">Generator Nomor Surat Otomatis (Auto-Increment).</p>
        </div>
        <button @click="openModal()" class="btn btn-primary shadow-sm">
            <i class="bi bi-plus-lg me-2"></i> Registrasi Nomor
        </button>
    </div>

    <div class="card shadow-sm border-0">
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th class="ps-4">No. Surat Lengkap</th>
                            <th>Nama Pegawai</th>
                            <th>Jenis & Tahun</th>
                            <th>Urutan</th>
                            <th class="text-end pe-4">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading"><td colspan="5" class="text-center py-5">Loading...</td></tr>
                        <tr v-else-if="listData.length === 0"><td colspan="5" class="text-center py-5 text-muted">Belum ada nomor yang digenerate.</td></tr>
                        
                        <tr v-else v-for="item in listData" :key="item.id">
                            <td class="ps-4">
                                <div class="fw-bold text-primary font-monospace">{{ item.nomor_lengkap }}</div>
                                <div class="small text-muted">Gol: {{ item.golongan }}</div>
                            </td>
                            <td>
                                <div class="fw-bold">{{ item.nama_pegawai }}</div>
                                <div class="small text-muted">{{ item.nip }}</div>
                            </td>
                            <td>
                                <span class="badge me-1" :class="item.jenis_jabatan === 'Struktural' ? 'bg-success' : 'bg-info'">
                                    {{ item.jenis_jabatan }}
                                </span>
                                <span class="badge bg-light text-dark border">{{ item.tahun }}</span>
                            </td>
                            <td>
                                <div class="fw-bold text-dark fs-5">#{{ String(item.no_urut).padStart(4, '0') }}</div>
                            </td>
                            <td class="text-end pe-4">
                                <div class="btn-group">
                                    <button @click="previewSK(item)" class="btn btn-sm btn-light border text-primary" title="Preview Dokumen">
                                        <i class="bi bi-eye-fill"></i>
                                    </button>
                                    <button @click="editNomor(item)" class="btn btn-sm btn-light border text-warning" title="Edit / Ganti Pemilik">
                                        <i class="bi bi-pencil-square"></i>
                                    </button>
                                    <button @click="hapusNomor(item)" class="btn btn-sm btn-light border text-danger" title="Batalkan Nomor">
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
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title fw-bold">
                        {{ isEditMode ? 'Edit Data Nomor SK' : 'Generate Nomor SK' }}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                </div>
                <div class="modal-body p-4">
                    <div v-if="isEditMode" class="alert alert-warning d-flex align-items-center mb-3">
                        <i class="bi bi-exclamation-triangle-fill me-2 fs-4"></i>
                        <small>Anda sedang mengedit data untuk <strong>No Urut #{{ String(form.no_urut).padStart(4,'0') }}</strong>. Nomor urut tidak akan berubah, hanya kepemilikan data yang berubah.</small>
                    </div>

                    <form @submit.prevent="simpanFinal">
                        
                        <div class="mb-3">
                            <label class="form-label fw-bold small">Pilih Usulan KGB</label>
                            <div class="input-group">
                                <button class="btn btn-outline-secondary" type="button" @click="fetchUsulanList" title="Refresh">
                                    <i class="bi bi-arrow-clockwise"></i>
                                </button>
                                
                                <select id="selectUsulan" class="form-select" required style="width: 85%;">
                                    <option value="" disabled selected>-- Cari Pegawai / NIP --</option>
                                    <option v-for="u in listUsulan" :key="u.id" :value="u.id">
                                        {{ u.nama_snapshot }} - {{ u.nip }} (TMT: {{ u.tmt_sekarang }})
                                    </option>
                                </select>
                            </div>
                        </div>

                        <div class="row g-3 mb-3">
                            <div class="col-md-4">
                                <label class="form-label fw-bold small">Jenis Jabatan</label>
                                <select v-model="form.jenis_jabatan" class="form-select" :disabled="isEditMode" required>
                                    <option value="Struktural">Struktural</option>
                                    <option value="Fungsional">Fungsional</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label fw-bold small">Tahun</label>
                                <select v-model="form.tahun" class="form-select" :disabled="isEditMode" required>
                                    <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label fw-bold small">Golongan</label>
                                <input v-model="form.golongan" type="text" class="form-control" placeholder="III/a" :readonly="isEditMode" required>
                            </div>
                        </div>

                        <hr>

                        <div class="mb-3">
                            <label class="form-label fw-bold text-primary">Nomor Surat (Final)</label>
                            <div class="input-group">
                                <input v-model="form.nomor_custom" type="text" class="form-control font-monospace fw-bold fs-5 text-dark" placeholder="Klik tombol Hitung..." required :readonly="isEditMode">
                                <button v-if="!isEditMode" type="button" class="btn btn-warning" @click="previewNomor" :disabled="isSaving || !form.usulan_id">
                                    <i class="bi bi-calculator me-2"></i>Hitung Otomatis
                                </button>
                            </div>
                        </div>

                        <div class="d-grid mt-4 gap-2 d-md-flex justify-content-md-end">
                            <button type="button" class="btn btn-light border px-4" @click="closeModal">Batal</button>
                            <button type="submit" class="btn btn-primary px-4" :disabled="isSaving">
                                <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                                {{ isEditMode ? 'Update Data' : 'Simpan Nomor' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <div v-if="showPreviewModal" class="modal fade show d-block" 
            style="background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); z-index: 1060;" 
            tabindex="-1"
            @click.self="closePreview">
        <div class="modal-dialog modal-xl modal-dialog-scrollable" style="height: 95vh;">
            <div class="modal-content h-100 border-0">
                <div class="modal-header bg-dark text-white border-0 py-2 align-items-center justify-content-between">
                    <h6 class="modal-title mb-0"><i class="bi bi-eye me-2"></i>Preview Dokumen SK</h6>
                    <div>
                        <button class="btn btn-sm btn-success me-2" @click="downloadFromPreview">
                            <i class="bi bi-download me-1"></i> Download Word ({{ previewTab === 'TTE' ? 'TTE' : 'Basah' }})
                        </button>
                        <button type="button" class="btn-close btn-close-white" @click="closePreview"></button>
                    </div>
                </div>
                <div class="modal-body p-0 d-flex flex-column bg-light">
                    <ul class="nav nav-tabs nav-justified bg-white border-bottom shadow-sm">
                        <li class="nav-item">
                            <a class="nav-link rounded-0 py-3 fw-bold" 
                               :class="previewTab === 'BASAH' ? 'active text-primary border-bottom-0' : 'text-muted'"
                               style="cursor: pointer;"
                               @click="changePreviewTab('BASAH')">
                                <i class="bi bi-pen me-2"></i>TTD BASAH (Konvensional)
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link rounded-0 py-3 fw-bold" 
                               :class="previewTab === 'TTE' ? 'active text-success border-bottom-0' : 'text-muted'"
                               style="cursor: pointer;"
                               @click="changePreviewTab('TTE')">
                                <i class="bi bi-qr-code me-2"></i>TTE (Srikandi / Elektronik)
                            </a>
                        </li>
                    </ul>
                    <div class="flex-grow-1 bg-secondary d-flex justify-content-center overflow-auto py-4">
                        <div id="docx-preview-container" class="bg-white shadow-lg transition-all" style="width: 210mm; min-height: 297mm; padding: 20px;">
                            <div v-if="previewLoading" class="text-center py-5">
                                <div class="spinner-border text-primary" role="status"></div>
                                <div class="mt-2 text-muted">Sedang merender preview...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`;