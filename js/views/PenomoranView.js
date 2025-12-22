// 1. TEMPLATE AUTOCOMPLETE USULAN (PENGGANTI SELECT2)
export const TplAutocompleteUsulan = `
    <div class="position-relative w-100">
        <div class="input-group">
            <input type="text" class="form-control" 
                :value="displayValue" 
                @input="handleInput"
                @focus="isOpen = true" 
                @blur="delayClose"
                placeholder="Ketik Nama atau NIP..." 
                autocomplete="off"
                :disabled="disabled">
            <button class="btn btn-outline-secondary" type="button" @click="isOpen = !isOpen" :disabled="disabled">
                <i class="bi bi-chevron-down"></i>
            </button>
        </div>
        
        <div v-if="isOpen" class="card position-absolute w-100 shadow mt-1 overflow-auto" style="z-index: 1050; max-height: 250px;">
            <ul class="list-group list-group-flush">
                <li v-if="filteredOptions.length === 0" class="list-group-item text-muted small p-3 text-center">
                    Data tidak ditemukan.
                </li>
                <li v-for="item in filteredOptions" :key="item.id" 
                    class="list-group-item list-group-item-action cursor-pointer p-2"
                    @mousedown.prevent="selectItem(item)">
                    <div class="fw-bold text-primary">{{ item.nama_snapshot }}</div>
                    <div class="small text-muted d-flex justify-content-between">
                        <span>{{ item.nip }}</span>
                        <span class="badge bg-light text-dark border">{{ item.golongan }}</span>
                    </div>
                    <div class="small text-secondary fst-italic truncate">{{ item.jabatan_snapshot }}</div>
                </li>
            </ul>
        </div>
    </div>
`;

// 2. TEMPLATE UTAMA
export const TplPenomoran = `
<div class="p-3 p-md-4">
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
            <h3 class="fw-bold text-primary mb-1">Registrasi Nomor SK</h3>
            <p class="text-muted small mb-0">Generator Nomor Surat Otomatis (Auto-Increment).</p>
        </div>
        <button @click="openModal()" class="btn btn-primary shadow-sm w-100 w-md-auto">
            <i class="bi bi-plus-lg me-2"></i> Registrasi Nomor
        </button>
    </div>

    <div class="card shadow-sm border-0">
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" style="min-width: 800px;">
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
        <div class="modal-dialog modal-lg modal-fullscreen-sm-down">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title fw-bold">
                        {{ isEditMode ? 'Edit Data Nomor SK' : 'Generate Nomor SK' }}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                </div>
                <div class="modal-body p-4 bg-light">
                    <div v-if="isEditMode" class="alert alert-warning d-flex align-items-center mb-3">
                        <i class="bi bi-exclamation-triangle-fill me-2 fs-4"></i>
                        <small>Anda sedang mengedit data untuk <strong>No Urut #{{ String(form.no_urut).padStart(4,'0') }}</strong>. Nomor urut tidak akan berubah, hanya kepemilikan data yang berubah.</small>
                    </div>

                    <form @submit.prevent="simpanFinal">
                        
                        <div class="card border-0 shadow-sm mb-3">
                            <div class="card-body">
                                <label class="form-label fw-bold small text-muted">1. Pilih Usulan KGB</label>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-outline-secondary" type="button" @click="fetchUsulanList" title="Refresh Data">
                                        <i class="bi bi-arrow-clockwise"></i>
                                    </button>
                                    
                                    <AutocompleteUsulan 
                                        :options="listUsulan" 
                                        v-model="form.usulan_id" 
                                        @change="handleUsulanChange"
                                        :disabled="false" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm mb-3">
                            <div class="card-body">
                                <label class="form-label fw-bold small text-muted mb-3">2. Detail Penomoran</label>
                                <div class="row g-3">
                                    <div class="col-12 col-md-4">
                                        <label class="form-label small fw-bold">Jenis Jabatan</label>
                                        <select v-model="form.jenis_jabatan" class="form-select" :disabled="isEditMode" required>
                                            <option value="Struktural">Struktural</option>
                                            <option value="Fungsional">Fungsional</option>
                                        </select>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <label class="form-label small fw-bold">Tahun</label>
                                        <select v-model="form.tahun" class="form-select" :disabled="isEditMode" required>
                                            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
                                        </select>
                                    </div>
                                    <div class="col-6 col-md-4">
                                        <label class="form-label small fw-bold">Golongan</label>
                                        <input v-model="form.golongan" type="text" class="form-control" placeholder="III/a" :readonly="isEditMode" required>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm mb-3 border-start border-4 border-warning">
                            <div class="card-body bg-warning bg-opacity-10">
                                <label class="form-label fw-bold text-dark mb-2">3. Nomor Surat (Final)</label>
                                
                                <div class="input-group">
                                    <input v-model="form.nomor_custom" type="text" class="form-control font-monospace fw-bold fs-5 text-dark" placeholder="Klik tombol Hitung atau Ketik Manual..." required>
                                    <button v-if="!isEditMode" type="button" class="btn btn-warning shadow-sm" @click="previewNomor" :disabled="isSaving || !form.usulan_id">
                                        <i class="bi bi-calculator me-md-2"></i><span class="d-none d-md-inline">Generate</span>
                                    </button>
                                </div>

                                <div v-if="customNumberStatus" class="alert py-2 small mb-0 mt-2 d-flex align-items-center shadow-sm" 
                                     :class="{
                                         'alert-info': customNumberStatus === 'checking',
                                         'alert-success': customNumberStatus === 'available',
                                         'alert-danger': customNumberStatus === 'taken',
                                         'alert-warning': customNumberStatus === 'warning' || customNumberStatus === 'invalid'
                                     }">
                                    <i class="bi me-2 fs-5" :class="{
                                        'bi-hourglass-split': customNumberStatus === 'checking',
                                        'bi-check-circle-fill': customNumberStatus === 'available',
                                        'bi-x-circle-fill': customNumberStatus === 'taken',
                                        'bi-exclamation-triangle-fill': customNumberStatus === 'warning' || customNumberStatus === 'invalid'
                                    }"></i>
                                    <div>
                                        <strong>{{ customNumberMsg }}</strong>
                                    </div>
                                </div>

                            </div>
                        </div>

                        <div class="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                            <button type="button" class="btn btn-light border px-4 py-2" @click="closeModal">Batal</button>
                            <button type="submit" class="btn btn-primary px-4 py-2 shadow" :disabled="isSaving || customNumberStatus === 'taken'">
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
        <div class="modal-dialog modal-xl modal-fullscreen-sm-down modal-dialog-scrollable" style="height: 95vh;">
            <div class="modal-content h-100 border-0">
                <div class="modal-header bg-dark text-white border-0 py-2 align-items-center justify-content-between">
                    <h6 class="modal-title mb-0"><i class="bi bi-eye me-2"></i>Preview SK</h6>
                    <div>
                        <button class="btn btn-sm btn-success me-2" @click="downloadFromPreview">
                            <i class="bi bi-download me-1"></i> <span class="d-none d-md-inline">Download Word</span>
                        </button>
                        <button type="button" class="btn-close btn-close-white" @click="closePreview"></button>
                    </div>
                </div>
                
                <div class="modal-body p-0 d-flex flex-column bg-light position-relative">
                    <ul class="nav nav-tabs nav-justified bg-white border-bottom shadow-sm">
                        <li class="nav-item">
                            <a class="nav-link rounded-0 py-3 fw-bold" 
                               :class="previewTab === 'BASAH' ? 'active text-primary border-bottom-0' : 'text-muted'"
                               style="cursor: pointer;"
                               @click="changePreviewTab('BASAH')">
                                <i class="bi bi-pen me-2"></i><span class="d-none d-md-inline">TTD BASAH</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link rounded-0 py-3 fw-bold" 
                               :class="previewTab === 'TTE' ? 'active text-success border-bottom-0' : 'text-muted'"
                               style="cursor: pointer;"
                               @click="changePreviewTab('TTE')">
                                <i class="bi bi-qr-code me-2"></i><span class="d-none d-md-inline">TTE (Srikandi)</span>
                            </a>
                        </li>
                    </ul>

                    <div class="flex-grow-1 bg-secondary d-flex justify-content-center overflow-auto py-4 position-relative">
                        
                        <div v-if="previewLoading" class="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center bg-secondary bg-opacity-75" style="z-index: 10;">
                            <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
                            <div class="mt-2 text-white fw-bold text-shadow">Sedang merender preview...</div>
                        </div>

                        <div id="docx-preview-container" class="bg-white shadow-lg transition-all" style="width: 210mm; min-height: 297mm; padding: 20px;"></div>

                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`;