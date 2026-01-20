// ==========================================
// FILE: src/views/PenomoranInpassingView.js
// ==========================================

// 1. TEMPLATE AUTOCOMPLETE USULAN
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
            <h3 class="fw-bold text-primary mb-1">Registrasi Nomor SK Inpassing</h3>
            <p class="text-muted small mb-0">Generator Nomor Surat Otomatis & Log Penomoran (Unified Counter).</p>
        </div>
        <div class="d-flex gap-2">
            <button @click="showGapModal = true; checkGaps()" class="btn btn-outline-primary shadow-sm text-nowrap">
                <i class="bi bi-search me-2"></i>Cek No. Kosong
            </button>
            <button @click="openModal()" class="btn btn-primary shadow-sm text-nowrap">
                <i class="bi bi-plus-lg me-2"></i> Input Nomor Baru
            </button>
        </div>
    </div>

    <div class="card shadow-sm border-0 mb-3">
        <div class="card-body p-3">
            <div class="row g-2 align-items-center">
                <div class="col-6 col-md-auto">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-light border-end-0">Show</span>
                        <select v-model="itemsPerPage" @change="fetchData(1)" class="form-select border-start-0" style="max-width: 70px;">
                            <option :value="10">10</option>
                            <option :value="25">25</option>
                            <option :value="50">50</option>
                        </select>
                    </div>
                </div>
                <div class="col-12 col-md-auto d-flex gap-2 align-items-center">
                    <input type="date" v-model="filterStartDate" class="form-control form-control-sm" title="Mulai Tanggal">
                    <span class="text-muted small">s/d</span>
                    <input type="date" v-model="filterEndDate" class="form-control form-control-sm" title="Sampai Tanggal">
                    <button class="btn btn-sm btn-outline-primary" @click="fetchData(1)" title="Terapkan Filter">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
                <div class="col d-none d-md-block"></div>
                <div class="col-12 col-md-auto">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                        <input v-model="tableSearch" type="text" class="form-control border-start-0 ps-0" placeholder="Cari No SK / Nama...">
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="card shadow-sm border-0">
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" style="min-width: 800px;">
                    <thead class="table-light">
                        <tr>
                            <th class="ps-4">No. Surat Lengkap</th>
                            <th>Nama Pegawai</th>
                            <th>Kategori & Tahun</th>
                            <th>Tanggal Dibuat</th>
                            <th>Urutan</th>
                            <th class="text-end pe-4">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading"><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary spinner-border-sm me-2"></div>Loading...</td></tr>
                        <tr v-else-if="listData.length === 0"><td colspan="6" class="text-center py-5 text-muted">Data tidak ditemukan.</td></tr>
                        
                        <tr v-else v-for="item in listData" :key="item.id">
                            <td class="ps-4">
                                <div class="fw-bold text-primary font-monospace">{{ item.nomor_lengkap }}</div>
                                <div class="small text-muted">Gol: {{ item.golongan }}</div>
                                <div v-if="item.keterangan_inpassing" class="small text-info fst-italic"><i class="bi bi-info-circle me-1"></i>{{ item.keterangan_inpassing }}</div>
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
                                <span v-if="item.kategori === 'INPASSING'" class="badge bg-warning text-dark ms-1" style="font-size: 0.65rem;">INP</span>
                            </td>
                            <td>
                                <div class="small text-muted">{{ item.created_at_formatted }}</div>
                            </td>
                            <td>
                                <div class="fw-bold text-dark fs-5">#{{ String(item.no_urut).padStart(4, '0') }}</div>
                            </td>
                            <td class="text-end pe-4">
                                <div class="btn-group">
                                    <button @click="previewSK(item)" class="btn btn-sm btn-light border text-primary" title="Preview">
                                        <i class="bi bi-eye-fill"></i>
                                    </button>
                                    <button @click="editNomor(item)" class="btn btn-sm btn-light border text-warning" title="Edit">
                                        <i class="bi bi-pencil-square"></i>
                                    </button>
                                    <button @click="hapusNomor(item)" class="btn btn-sm btn-light border text-danger" title="Hapus">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="card-footer bg-white p-3">
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
                <small class="text-muted">
                    Halaman <strong>{{ currentPage }}</strong> dari {{ totalPages }} 
                    <span v-if="totalItems > 0">(Total: {{ totalItems }} Data)</span>
                </small>
                <nav aria-label="Page navigation" v-if="totalPages > 1">
                    <ul class="pagination pagination-sm mb-0">
                        <li class="page-item" :class="{ disabled: currentPage === 1 }">
                            <button class="page-link" @click="goToPage(currentPage - 1)" aria-label="Previous"><span aria-hidden="true">&laquo;</span></button>
                        </li>
                        <li class="page-item" v-for="page in visiblePages" :key="page" :class="{ active: currentPage === page }">
                            <button class="page-link" @click="goToPage(page)">{{ page }}</button>
                        </li>
                        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                            <button class="page-link" @click="goToPage(currentPage + 1)" aria-label="Next"><span aria-hidden="true">&raquo;</span></button>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>
    </div>

    <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5);" tabindex="-1" @click.self="closeModal">
        <div class="modal-dialog modal-lg modal-fullscreen-sm-down">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title fw-bold">
                        {{ isEditMode ? 'Edit Data Nomor SK' : 'Generate Nomor SK Inpassing' }}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                </div>
                <div class="modal-body p-4 bg-light">
                    <div v-if="isEditMode" class="alert alert-warning d-flex align-items-center mb-3">
                        <i class="bi bi-exclamation-triangle-fill me-2 fs-4"></i>
                        <small>Anda sedang mengedit data untuk <strong>No Urut #{{ String(form.no_urut).padStart(4,'0') }}</strong>. Nomor urut tidak akan berubah.</small>
                    </div>

                    <form @submit.prevent="simpanFinal">
                        
                        <div v-if="!isEditMode" class="card border-0 shadow-sm mb-3">
                            <div class="card-body">
                                <label class="form-label fw-bold small text-muted">1. Pilih Usulan (KGB)</label>
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
                                <div class="form-text small" v-if="form.nama_pegawai">
                                    <i class="bi bi-info-circle me-1"></i>
                                    Terpilih: <strong>{{ form.nama_pegawai }}</strong> (Gol: {{ form.golongan }})
                                </div>
                            </div>
                        </div>

                        <div v-else class="card border-0 shadow-sm mb-3 bg-light border-start border-4 border-primary">
                            <div class="card-body">
                                <label class="form-label fw-bold small text-muted">1. Data Pegawai (Mode Edit)</label>
                                <div class="d-flex align-items-center">
                                    <div class="bg-white p-2 rounded border me-3">
                                        <i class="bi bi-person-bounding-box fs-3 text-primary"></i>
                                    </div>
                                    <div>
                                        <div class="fw-bold text-dark">{{ form.nama_pegawai }}</div>
                                        <div class="small text-muted font-monospace">{{ form.nip }}</div>
                                    </div>
                                </div>
                                <div class="mt-2 small text-info fst-italic">
                                    *Data personal tidak dapat diubah dalam mode edit nomor.
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm mb-3 border-start border-4 border-info">
                            <div class="card-header bg-info bg-opacity-10 py-2">
                                <h6 class="mb-0 fw-bold text-info small"><i class="bi bi-pencil-square me-2"></i>Detail Khusus Inpassing</h6>
                            </div>
                            <div class="card-body">
                                <div class="col-12">
                                    <label class="form-label small fw-bold text-dark">TMT Inpassing</label>
                                    <input 
                                        v-model="form.tmt_inpassing" 
                                        type="date" 
                                        class="form-control"
                                        required
                                    >
                                    </div>
                                <div class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label small fw-bold text-dark">Masa Kerja Golongan Inpassing</label>
                                        <div class="input-group input-group-sm">
                                            <input v-model.number="form.mk_inpassing_tahun" type="number" class="form-control" placeholder="Tahun">
                                            <span class="input-group-text">Tahun</span>
                                            <input v-model.number="form.mk_inpassing_bulan" type="number" class="form-control" placeholder="Bulan">
                                            <span class="input-group-text">Bulan</span>
                                        </div>
                                    </div>

                                    <div class="col-12">
                                        <label class="form-label small fw-bold text-dark">Gaji Pokok Lama (Sebelum Inpassing)</label>
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text fw-bold">Rp</span>
                                            <input v-model.number="form.gaji_lama_inpassing" type="number" class="form-control" placeholder="Contoh: 3500000">
                                        </div>
                                        <div class="form-text small text-muted">Input angka tanpa titik/koma.</div>
                                    </div>

                                    <div class="col-12">
                                        <label class="form-label small fw-bold text-dark">Masa Kerja Untuk KGB Berikutnya</label>
                                        <div class="input-group input-group-sm">
                                            <input v-model.number="form.mk_berikutnya_tahun" type="number" class="form-control" placeholder="Tahun">
                                            <span class="input-group-text">Tahun</span>
                                            <input v-model.number="form.mk_berikutnya_bulan" type="number" class="form-control" placeholder="Bulan">
                                            <span class="input-group-text">Bulan</span>
                                        </div>
                                    </div>


                                    <div class="col-12"> <label class="form-label small fw-bold text-dark">Tanggal SK Inpassing</label>
                                        <input 
                                            v-model="form.tanggal_inpassing_manual" 
                                            type="date" 
                                            class="form-control form-control-sm"
                                        >
                                    </div>


                                    <div class="col-12">
                                        <label class="form-label small fw-bold text-dark">Keterangan (Opsional)</label>
                                        <textarea v-model="form.keterangan_inpassing" class="form-control form-control-sm" rows="2" placeholder="Tambahkan catatan jika ada..."></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="card border-0 shadow-sm mb-3">
                            <div class="card-body">
                                <label class="form-label fw-bold small text-muted mb-3">3. Detail Klasifikasi SK</label>
                                <div class="row g-3">
                                    <div class="col-12 col-md-4">
                                        <label class="form-label small fw-bold">Jenis Jabatan</label>
                                        <select v-model="form.jenis_jabatan" class="form-select" :disabled="isEditMode" required>
                                            <option value="Fungsional">Fungsional</option>
                                            <option value="Struktural">Struktural</option>
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
                                <label class="form-label fw-bold text-dark mb-2">4. Nomor Surat (Final)</label>
                                <div class="input-group">
                                    <input v-model="form.nomor_custom" type="text" class="form-control font-monospace fw-bold fs-5 text-dark" placeholder="Klik tombol Hitung..." required>
                                    <button v-if="!isEditMode" type="button" class="btn btn-warning shadow-sm" @click="previewNomor" :disabled="isSaving || !form.usulan_id">
                                        <i class="bi bi-calculator me-md-2"></i><span class="d-none d-md-inline">Hitung Otomatis</span>
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
                                    <div><strong>{{ customNumberMsg }}</strong></div>
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

    <div v-if="showGapModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 1060;" tabindex="-1">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-white border-bottom">
                    <div>
                        <h5 class="modal-title fw-bold text-primary"><i class="bi bi-sort-numeric-down me-2"></i>Nomor Urut Kosong</h5>
                        <small class="text-muted">Mencari celah nomor yang terlewat (Unified Counter).</small>
                    </div>
                    <button type="button" class="btn-close" @click="showGapModal = false"></button>
                </div>
                <div class="modal-body bg-light">
                    <div class="card border-0 shadow-sm mb-3">
                        <div class="card-body">
                            <div class="row g-2 align-items-end">
                                <div class="col-md-9">
                                    <label class="form-label small fw-bold">Tahun Register</label>
                                    <select v-model="gapForm.tahun" class="form-select">
                                        <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
                                    </select>
                                </div>
                                <div class="col-md-3">
                                    <button @click="checkGaps" class="btn btn-primary w-100" :disabled="gapLoading">
                                        <i class="bi" :class="gapLoading ? 'bi-hourglass-split' : 'bi-search'"></i> Cari
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="gapLoading" class="text-center py-5">
                        <div class="spinner-border text-primary" role="status"></div>
                        <div class="mt-2 small text-muted">Memindai database...</div>
                    </div>

                    <div v-else>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="badge bg-secondary">Max Counter: {{ maxCounterVal }}</span>
                            <span class="small text-muted">Ditemukan: <strong>{{ emptyNumbers.length }}</strong> celah kosong</span>
                        </div>

                        <div v-if="emptyNumbers.length === 0" class="alert alert-success d-flex align-items-center">
                            <i class="bi bi-check-circle-fill fs-4 me-3"></i>
                            <div>
                                <strong>Sempurna!</strong> Tidak ada nomor urut yang terlewat (kosong) hingga urutan ke-{{ maxCounterVal }}.
                            </div>
                        </div>

                        <div v-else class="d-flex flex-wrap gap-2">
                            <button v-for="num in emptyNumbers" :key="num" 
                                @click="useGapNumber(num)"
                                class="btn btn-outline-danger btn-sm px-3 py-2 fw-bold"
                                title="Klik untuk gunakan nomor ini">
                                #{{ String(num).padStart(4, '0') }}
                            </button>
                        </div>
                        <div v-if="emptyNumbers.length > 0" class="mt-3 small text-muted fst-italic">
                            *Klik salah satu nomor untuk langsung menggunakannya pada form registrasi.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div v-if="showPreviewModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.8); z-index: 1060;" tabindex="-1" @click.self="closePreview">
        <div class="modal-dialog modal-xl modal-fullscreen-sm-down modal-dialog-scrollable" style="height: 95vh;">
            <div class="modal-content h-100 border-0">
                <div class="modal-header bg-dark text-white border-0 py-2 align-items-center justify-content-between">
                    <h6 class="modal-title mb-0"><i class="bi bi-eye me-2"></i>Preview SK Inpassing</h6>
                    <div>
                        <button class="btn btn-sm btn-success me-2" @click="downloadFromPreview"><i class="bi bi-download me-1"></i> <span class="d-none d-md-inline">Download</span></button>
                        <button type="button" class="btn-close btn-close-white" @click="closePreview"></button>
                    </div>
                </div>
                
                <div class="modal-body p-0 d-flex flex-column bg-light position-relative">
                    <ul class="nav nav-tabs nav-justified bg-white border-bottom shadow-sm">
                        <li class="nav-item"><a class="nav-link rounded-0 py-3 fw-bold" :class="previewTab === 'BASAH' ? 'active text-primary' : 'text-muted'" @click="changePreviewTab('BASAH')">TTD BASAH</a></li>
                        <li class="nav-item"><a class="nav-link rounded-0 py-3 fw-bold" :class="previewTab === 'TTE' ? 'active text-success' : 'text-muted'" @click="changePreviewTab('TTE')">TTE (Srikandi)</a></li>
                    </ul>

                    <div class="flex-grow-1 bg-secondary d-flex justify-content-center overflow-auto py-4 position-relative">
                        <div v-if="previewLoading" class="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center bg-secondary bg-opacity-75" style="z-index: 10;">
                            <div class="spinner-border text-primary" role="status"></div>
                        </div>
                        
                        <div id="docx-preview-container" 
                             class="bg-white shadow-lg transition-all" >
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;