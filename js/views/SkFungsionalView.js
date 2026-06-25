// ==========================================
// SK FUNGSIONAL VIEW TEMPLATES
// ==========================================

// ==========================================
// 1. TAMPILAN COMPONENT SEARCH SELECT (shared)
// ==========================================
export const TplSearchSelect = `
    <div class="dropdown w-100" ref="dropdown">
        <button class="form-select text-start d-flex justify-content-between align-items-center" 
            type="button" @click="!disabled && (isOpen = !isOpen)" 
            :class="{'text-muted': !modelValue, 'bg-light': disabled}" :disabled="disabled">
            <span class="text-truncate">{{ selectedLabel || placeholder || 'Pilih...' }}</span>
            <i class="bi bi-chevron-down small"></i>
        </button>
        <div class="dropdown-menu w-100 p-2 shadow" :class="{ show: isOpen }" style="max-height: 250px; overflow-y: auto;">
            <input ref="searchInput" v-model="search" type="text" class="form-control form-control-sm mb-2" placeholder="Ketik...">
            <div v-if="safeOptions.length === 0" class="text-muted small text-center py-2">Tidak ditemukan.</div>
            <a v-for="opt in safeOptions" :key="getKey(opt)" 
                class="dropdown-item rounded small py-2" 
                :class="{ active: modelValue === getKey(opt) }"
                href="#" @click.prevent="selectOpt(opt)">
                {{ getLabel(opt) }}
            </a>
        </div>
    </div>
`;

// ==========================================
// 2. TAMPILAN COMPONENT AUTOCOMPLETE JABATAN
// ==========================================
export const TplAutocompleteJabatan = `
    <div class="position-relative w-100">
        <input type="text" class="form-control" :value="modelValue" @input="handleInput"
            @focus="showSuggestions = true" @blur="handleBlur" :placeholder="placeholder || 'Ketik nama jabatan...'" autocomplete="off">
        
        <ul v-if="showSuggestions && suggestions.length > 0" class="list-group position-absolute w-100 shadow mt-1" style="z-index: 1050; max-height: 250px; overflow-y: auto;">
            <li v-for="item in suggestions" :key="item.id" class="list-group-item list-group-item-action small cursor-pointer py-2" @mousedown.prevent="selectItem(item)">
                <div class="fw-bold text-dark">{{ item.nama_jabatan }}</div>
                <div class="d-flex justify-content-between align-items-center small mt-1">
                    <span class="badge bg-light text-secondary border">{{ item.jenis_jabatan || 'Umum' }}</span>
                    <span v-if="item.tunjangan && Number(item.tunjangan) > 0" class="badge bg-success text-white ms-1">
                        <i class="bi bi-cash-coin me-1"></i>Rp {{ Number(item.tunjangan).toLocaleString('id-ID') }}
                    </span>
                    <span v-else class="badge bg-light text-muted border ms-1">Non Tunjangan</span>
                </div>
            </li>
        </ul>
    </div>
`;

// ==========================================
// 3. TAMPILAN COMPONENT AUTOCOMPLETE UNIT KERJA
// ==========================================
export const TplAutocompleteUnitKerja = `
    <div class="position-relative w-100">
        <input type="text" class="form-control" :value="modelValue" @input="handleInput"
            @focus="showSuggestions = true" @blur="handleBlur" placeholder="Cari unit kerja..." autocomplete="off">
        
        <ul v-if="showSuggestions && suggestions.length > 0" class="list-group position-absolute w-100 shadow mt-1" style="z-index: 1050; max-height: 250px; overflow-y: auto;">
            <li v-for="(item, index) in suggestions" :key="index" class="list-group-item list-group-item-action small cursor-pointer py-2" @mousedown="selectItem(item)">
                <div class="fw-bold text-dark"><i class="bi bi-geo-alt me-2 text-muted"></i>{{ item }}</div>
            </li>
        </ul>
    </div>
`;

// ==========================================
// 4. TAMPILAN UTAMA - HALAMAN SK FUNGSIONAL
// ==========================================
export const TplMain = `
<div class="p-3 p-md-4">
    <div v-if="!showModal && !showPreviewModal">

        <!-- HEADER -->
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
            <div>
                <h3 class="fw-bold mb-1" style="color: #5c35a5;">
                    <i class="bi bi-file-earmark-person me-2"></i>SK Jabatan Fungsional
                </h3>
                <p class="text-muted small mb-0">Manajemen Surat Keputusan Kenaikan Jabatan Fungsional PNS.</p>
            </div>
            <div class="d-flex gap-2 w-100 w-md-auto flex-wrap">
                <button @click="downloadExcel()" class="btn btn-success shadow-sm text-nowrap px-3 py-2 fw-semibold" style="flex: 1;">
                    <i class="bi bi-file-earmark-excel me-2"></i> Export Data
                </button>
                <button @click="openModal()" class="btn btn-primary shadow-sm text-nowrap px-4 py-2 fw-semibold" style="flex: 1; background-color: #5c35a5; border-color: #5c35a5;">
                    <i class="bi bi-plus-lg me-2"></i> Input SK Baru
                </button>
            </div>
        </div>

        <!-- TABEL DATA -->
        <div class="card shadow-sm border-0">
            <div class="card-header bg-white p-3 border-bottom-0">
                <div class="row g-2 align-items-center">
                    <div class="col-6 col-md-auto">
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-light border-end-0">Show</span>
                            <select v-model="itemsPerPage" @change="fetchTable(1)" class="form-select border-start-0" style="max-width: 70px;">
                                <option :value="10">10</option>
                                <option :value="25">25</option>
                                <option :value="50">50</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-12 col-md-auto d-flex gap-2 align-items-center">
                        <input type="date" v-model="filterStartDate" class="form-control form-control-sm" placeholder="Dari Tanggal">
                        <span class="small text-muted">-</span>
                        <input type="date" v-model="filterEndDate" class="form-control form-control-sm" placeholder="Sampai Tanggal">
                        <button @click="fetchTable(1)" class="btn btn-sm btn-outline-primary" title="Filter"><i class="bi bi-funnel-fill"></i></button>
                    </div>
                    <div class="col d-none d-md-block"></div>
                    <div class="col-12 col-md-auto">
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                            <input v-model="tableSearch" type="text" class="form-control border-start-0 ps-0" placeholder="Cari Nama / NIP...">
                        </div>
                    </div>
                </div>
            </div>

            <div class="card-body p-0">
                <!-- LOADING -->
                <div v-if="tableLoading" class="text-center py-5">
                    <div class="spinner-border spinner-border-sm mb-2" style="color: #5c35a5;"></div>
                    <div class="small text-muted">Memuat data...</div>
                </div>

                <!-- EMPTY -->
                <div v-else-if="listData.length === 0" class="text-center py-5">
                    <i class="bi bi-file-earmark-person fs-1 text-muted opacity-25 mb-2 d-block"></i>
                    <span class="text-muted">Belum ada data SK Fungsional.</span>
                </div>

                <!-- TABEL DESKTOP -->
                <div v-else>
                    <div class="d-none d-md-block table-responsive">
                        <table class="table table-hover align-middle mb-0" style="min-width: 900px;">
                            <thead class="bg-light">
                                <tr>
                                    <th style="width: 40px;"></th>
                                    <th class="ps-2 py-3 small fw-bold">Pegawai</th>
                                    <th class="py-3 small fw-bold">Jabatan Baru</th>
                                    <th class="py-3 small fw-bold">TMT Jabatan</th>
                                    <th class="py-3 small fw-bold text-center" style="width: 130px;">Selesai</th>
                                    <th class="text-end pe-4 py-3 small fw-bold">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                <template v-for="item in listData" :key="item.id">
                                    <tr :class="{'bg-light': isExpanded(item.id)}">
                                        <td class="text-center">
                                            <button class="btn btn-sm btn-link text-decoration-none p-0" @click="toggleRow(item.id)">
                                                <i class="bi" :class="isExpanded(item.id) ? 'bi-dash-circle-fill text-danger' : 'bi-plus-circle-fill text-primary'"></i>
                                            </button>
                                        </td>
                                        <td class="ps-2">
                                            <div class="fw-bold text-dark">{{ item.nama }}</div>
                                            <div class="small text-muted font-monospace">{{ item.nip }}</div>
                                            <div class="small text-muted">{{ item.unit_kerja }}</div>
                                        </td>
                                        <td>
                                            <div class="fw-semibold text-dark">{{ item.jabatan_baru }}</div>
                                            <div class="small text-muted">Dari: {{ item.jabatan_lama || '-' }}</div>
                                        </td>
                                        <td>{{ formatTanggal(item.tmt_jabatan) }}</td>

                                        <td class="text-center">
                                            <div class="form-check form-switch d-flex justify-content-center align-items-center gap-2">
                                                <input class="form-check-input cursor-pointer" type="checkbox" role="switch"
                                                    :checked="item.status === 'SELESAI'"
                                                    @change="updateStatus(item, $event.target.checked ? 'SELESAI' : 'DRAFT')">
                                                <label class="form-check-label small" :class="item.status === 'SELESAI' ? 'text-success fw-bold' : 'text-muted'">
                                                    {{ item.status === 'SELESAI' ? 'Ya' : 'Belum' }}
                                                </label>
                                            </div>
                                        </td>

                                        <td class="text-end pe-4">
                                            <div class="btn-group btn-group-sm">
                                                <button @click="previewSK(item)" class="btn btn-light border text-primary" title="Preview / View">
                                                    <i class="bi bi-eye"></i>
                                                </button>
                                                <button @click="openModal(item)" class="btn btn-light border text-secondary" title="Edit">
                                                    <i class="bi bi-pencil"></i>
                                                </button>
                                                <button @click="openSrikandi(item)" class="btn btn-light border text-success" title="Kirim ke Srikandi">
                                                    <i class="bi bi-send-fill"></i>
                                                </button>
                                                <button @click="hapusData(item)" class="btn btn-light border text-danger" title="Hapus">
                                                    <i class="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- EXPANDED ROW -->
                                    <tr v-if="isExpanded(item.id)" class="bg-light border-bottom">
                                        <td colspan="6" class="p-3 ps-5">
                                            <div class="row g-3 small">
                                                <div class="col-md-4">
                                                    <h6 class="fw-bold text-muted mb-2 text-uppercase" style="font-size: 0.7rem;">Identitas Jabatan</h6>
                                                    <div class="mb-1"><i class="bi bi-person-badge me-2"></i>{{ item.pangkat_golongan || '-' }}</div>
                                                    <div class="mb-1"><i class="bi bi-calendar me-2"></i>TMT Pangkat: {{ formatTanggal(item.tmt_pangkat_golongan) }}</div>
                                                    <div class="mb-1"><i class="bi bi-star me-2"></i>Angka Kredit: {{ item.angka_kredit || '-' }}</div>
                                                    <div class="mb-1">
                                                        <i class="bi bi-cash-coin me-2"></i>
                                                        <span v-if="item.tunjangan && Number(item.tunjangan) > 0" class="fw-bold text-success">
                                                            Tunjangan: Rp {{ Number(item.tunjangan).toLocaleString('id-ID') }}
                                                        </span>
                                                        <span v-else class="text-muted fst-italic">Non Tunjangan</span>
                                                    </div>
                                                </div>
                                                <div class="col-md-4">
                                                    <h6 class="fw-bold text-muted mb-2 text-uppercase" style="font-size: 0.7rem;">Dokumen Dasar</h6>
                                                    <div class="mb-1"><i class="bi bi-file-text me-2"></i>Pertek BKN: {{ item.no_pertek_bkn || '-' }}</div>
                                                    <div class="mb-1"><i class="bi bi-calendar me-2"></i>Tgl Pertek: {{ formatTanggal(item.tgl_pertek_bkn) }}</div>
                                                    <div class="mb-1"><i class="bi bi-award me-2"></i>SerKom: {{ item.no_ser_kom || '-' }}</div>
                                                </div>
                                                <div class="col-md-4">
                                                    <h6 class="fw-bold text-muted mb-2 text-uppercase" style="font-size: 0.7rem;">Administrasi</h6>
                                                    <div class="mb-1" v-if="item.nomor_naskah">
                                                        <span class="text-muted">No. SK:</span> <span class="fw-bold font-monospace text-dark">{{ item.nomor_naskah }}</span>
                                                    </div>
                                                    <div v-else class="text-muted fst-italic mb-1">Belum ada nomor SK</div>
                                                    <div class="mb-1"><i class="bi bi-person-check me-2"></i>Penandatangan: {{ item.pejabat_nama || '-' }}</div>
                                                    <div class="small text-muted">Dibuat: {{ formatTanggal(item.created_at?.toDate?.() || item.created_at) }}</div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>
                    </div>

                    <!-- KARTU MOBILE -->
                    <div class="d-md-none bg-light p-3 d-flex flex-column gap-3">
                        <div v-for="item in listData" :key="'mob-'+item.id" class="card border-0 shadow-sm">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <h6 class="fw-bold mb-0" style="color: #5c35a5;">{{ item.nama }}</h6>
                                        <small class="text-muted font-monospace">{{ item.nip }}</small>
                                    </div>
                                    <span class="small fw-bold" :class="item.status==='SELESAI' ? 'text-success' : 'text-muted'">
                                        {{ item.status==='SELESAI' ? 'Selesai' : 'Belum' }}
                                    </span>
                                </div>

                                <div class="bg-light p-2 rounded small mb-3">
                                    <div class="row g-2">
                                        <div class="col-12"><span class="text-muted d-block">Jabatan Baru</span><strong>{{ item.jabatan_baru }}</strong></div>
                                        <div class="col-6"><span class="text-muted d-block">Dari</span><strong>{{ item.jabatan_lama || '-' }}</strong></div>
                                        <div class="col-6"><span class="text-muted d-block">TMT Jabatan</span><strong>{{ formatTanggal(item.tmt_jabatan) }}</strong></div>
                                    </div>
                                </div>

                                <div class="d-flex justify-content-between align-items-center gap-2 bg-white border rounded p-2">
                                    <div class="form-check form-switch m-0 d-flex align-items-center gap-2">
                                        <input class="form-check-input" type="checkbox" role="switch"
                                            :checked="item.status === 'SELESAI'"
                                            @change="updateStatus(item, $event.target.checked ? 'SELESAI' : 'DRAFT')">
                                        <label class="form-check-label small fw-bold">Selesai?</label>
                                    </div>
                                    <div class="btn-group btn-group-sm">
                                        <button @click="previewSK(item)" class="btn btn-light border text-primary" title="Preview">
                                            <i class="bi bi-eye"></i>
                                        </button>
                                        <button @click="openModal(item)" class="btn btn-light border text-secondary" title="Edit">
                                            <i class="bi bi-pencil"></i>
                                        </button>
                                        <button @click="openSrikandi(item)" class="btn btn-light border text-success" title="Kirim Srikandi">
                                            <i class="bi bi-send-fill"></i>
                                        </button>
                                        <button @click="hapusData(item)" class="btn btn-light border text-danger" title="Hapus">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- PAGINATION FOOTER -->
            <div class="card-footer bg-white p-3">
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
                    <small class="text-muted">Halaman {{ currentPage }} dari {{ totalPages }} (Total: {{ totalItems }})</small>
                    <nav aria-label="Page navigation">
                        <ul class="pagination pagination-sm mb-0">
                            <li class="page-item" :class="{ disabled: currentPage === 1 }">
                                <button class="page-link" @click="goToPage(currentPage - 1)">&laquo;</button>
                            </li>
                            <li class="page-item" v-for="page in visiblePages" :key="page" :class="{ active: currentPage === page }">
                                <button class="page-link" @click="goToPage(page)">{{ page }}</button>
                            </li>
                            <li class="page-item" :class="{ disabled: currentPage === totalPages || totalPages === 0 }">
                                <button class="page-link" @click="goToPage(currentPage + 1)">&raquo;</button>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>
        </div>
    </div>

    <!-- ============================================================ -->
    <!-- MODAL FORM INPUT / EDIT                                       -->
    <!-- ============================================================ -->
    <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 1050;" tabindex="-1">
        <div class="modal-dialog modal-xl modal-fullscreen-sm-down modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header text-white" style="background-color: #5c35a5;">
                    <h5 class="modal-title fw-bold">
                        <i class="bi bi-file-earmark-person me-2"></i>
                        {{ isEditMode ? 'Edit SK Fungsional' : 'Input SK Fungsional Baru' }}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                </div>
                <div class="modal-body bg-light p-3 p-md-4">
                    <form @submit.prevent="simpanData">

                        <!-- SEKSI 1: IDENTITAS PEGAWAI -->
                        <div class="card shadow-sm border-0 mb-3">
                            <div class="card-header bg-white py-3">
                                <h6 class="fw-bold mb-0" style="color: #5c35a5;">
                                    <i class="bi bi-person-badge me-2"></i>1. Identitas Pegawai
                                </h6>
                            </div>
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-12 col-md-5">
                                        <label class="form-label small fw-bold">NIP <span class="text-danger">*</span></label>
                                        <div class="input-group">
                                            <input v-model="form.nip" type="text" class="form-control" :disabled="isEditMode" 
                                                   placeholder="Ketik NIP untuk cari data..." @input="handleNipInput">
                                            <span v-if="isSearching" class="input-group-text bg-white">
                                                <div class="spinner-border spinner-border-sm text-primary"></div>
                                            </span>
                                            <button type="button" class="btn btn-outline-info btn-sm"
                                                :disabled="!form.nip"
                                                @click="cekSIASN(form.nip)"
                                                title="Buka profil PNS di SIASN BKN (tab baru)">
                                                <i class="bi bi-box-arrow-up-right me-1"></i>
                                                <span class="d-none d-md-inline">Cek SIASN</span>
                                            </button>
                                        </div>
                                        <div v-if="searchMsg" class="small mt-1" :class="searchMsg === 'Ditemukan' ? 'text-success' : 'text-warning'">
                                            <i class="bi" :class="searchMsg === 'Ditemukan' ? 'bi-check-circle-fill' : 'bi-plus-circle'"></i> {{ searchMsg }}
                                        </div>
                                        <div class="small text-muted mt-1 d-flex align-items-center gap-2 flex-wrap">
                                            <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-2"
                                                @click="copyBookmarkletSIASN"
                                                title="Salin URL bookmarklet SIASN ke clipboard, lalu paste sebagai URL di bookmark baru browser Anda">
                                                <i class="bi bi-clipboard me-1"></i>
                                                <span style="font-size:0.72rem;">Copy Bookmarklet</span>
                                            </button>
                                            <span style="font-size:0.7rem;" class="text-muted">← paste di URL bookmark browser</span>
                                        </div>
                                    </div>
                                    <div class="col-12 col-md-7">
                                        <label class="form-label small text-muted">Nama Lengkap <span class="text-danger">*</span></label>
                                        <input v-model="form.nama" class="form-control fw-bold" required placeholder="Nama lengkap PNS...">
                                    </div>

                                    <div class="col-12 col-md-6">
                                        <label class="form-label small text-muted">Unit Kerja</label>
                                        <AutocompleteUnitKerja v-model="form.unit_kerja" />
                                    </div>
                                    <div class="col-12 col-md-6">
                                        <label class="form-label small text-muted">Perangkat Daerah</label>
                                        <input v-model="form.perangkat_daerah" class="form-control" placeholder="Perangkat daerah...">
                                        <div class="small text-muted mt-1" style="font-size: 0.7rem;">
                                            <i class="bi bi-info-circle"></i> Jika unit kerja berbeda dengan perangkat daerah, format cetak otomatis menjadi: <strong>Unit Kerja - Perangkat Daerah</strong>
                                        </div>
                                    </div>

                                    <div class="col-12 col-md-6">
                                        <label class="form-label small fw-bold">Pangkat / Golongan Ruang</label>
                                        <SearchSelect :options="listGolongan" v-model="form.golongan_kode" 
                                            label-key="label_full" value-key="kode" 
                                            placeholder="Pilih golongan..." 
                                            @change="handleGolonganChange" />
                                        <input v-model="form.pangkat_golongan" class="form-control mt-2" placeholder="Atau ketik langsung: Penata Muda Tk. I / III-b">
                                    </div>
                                    <div class="col-12 col-md-6">
                                        <label class="form-label small text-muted">TMT Pangkat / Golongan Ruang</label>
                                        <input v-model="form.tmt_pangkat_golongan" type="date" class="form-control">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SEKSI 2: DOKUMEN DASAR -->
                        <div class="card shadow-sm border-0 mb-3">
                            <div class="card-header bg-white py-3">
                                <h6 class="fw-bold text-secondary mb-0">
                                    <i class="bi bi-file-text me-2"></i>2. Dokumen Dasar (Konsideran)
                                </h6>
                            </div>
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-12 col-md-6">
                                        <label class="form-label small fw-bold">Nomor Pertek BKN</label>
                                        <input v-model="form.no_pertek_bkn" class="form-control" placeholder="Nomor surat Pertek BKN...">
                                    </div>
                                    <div class="col-12 col-md-6">
                                        <label class="form-label small text-muted">Tanggal Pertek BKN</label>
                                        <input v-model="form.tgl_pertek_bkn" type="date" class="form-control">
                                    </div>
                                    <div class="col-12 col-md-6">
                                        <label class="form-label small fw-bold">Nomor Sertifikat Kompetensi</label>
                                        <input v-model="form.no_ser_kom" class="form-control" placeholder="Nomor Sertifikat Uji Kompetensi...">
                                    </div>
                                    <div class="col-12 col-md-6">
                                        <label class="form-label small text-muted">Tanggal Sertifikat Kompetensi</label>
                                        <input v-model="form.tgl_ser_kom" type="date" class="form-control">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SEKSI 3: DETAIL JABATAN FUNGSIONAL -->
                        <div class="card shadow-sm border-0 border-start border-4 mb-3" style="border-color: #5c35a5 !important;">
                            <div class="card-header py-3" style="background-color: rgba(92, 53, 165, 0.08);">
                                <h6 class="fw-bold mb-0" style="color: #5c35a5;">
                                    <i class="bi bi-stars me-2"></i>3. Detail Jabatan Fungsional
                                </h6>
                            </div>
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-12 col-md-6">
                                        <label class="form-label small fw-bold">Jabatan Fungsional Lama</label>
                                        <AutocompleteJabatan v-model="form.jabatan_lama" :placeholder="'Ketik jabatan lama...'" />
                                    </div>
                                    <div class="col-12 col-md-6">
                                        <label class="form-label small fw-bold text-primary">Jabatan Fungsional Baru <span class="text-danger">*</span></label>
                                        <AutocompleteJabatan v-model="form.jabatan_baru" :placeholder="'Ketik jabatan baru...'" @select="handleJabatanBaruSelect" />
                                        <div v-if="form.tunjangan" class="small text-success mt-1">
                                            <i class="bi bi-check-circle-fill"></i>
                                            Tunjangan dari master: <strong>Rp {{ Number(form.tunjangan).toLocaleString('id-ID') }}</strong>
                                            <span class="text-muted ms-1">(dapat diubah di kolom bawah)</span>
                                        </div>
                                    </div>
                                    <div class="col-12 col-md-4">
                                        <label class="form-label small fw-bold text-primary">TMT Jabatan Baru <span class="text-danger">*</span></label>
                                        <input v-model="form.tmt_jabatan" type="date" class="form-control" required>
                                    </div>
                                    <div class="col-12 col-md-4">
                                        <label class="form-label small fw-bold">Angka Kredit</label>
                                        <input v-model="form.angka_kredit" type="text" class="form-control" placeholder="Contoh: 150,00">
                                    </div>

                                    <div class="col-12 col-md-4">
                                        <label class="form-label small fw-bold">Kategori Jabatan</label>
                                        <div class="d-flex gap-3 mt-1 pt-1">
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" v-model="form.kategori_jabatan" value="Keahlian" id="katKeahlian">
                                                <label class="form-check-label fw-semibold" for="katKeahlian">
                                                    <i class="bi bi-mortarboard-fill text-primary me-1"></i>Keahlian
                                                </label>
                                            </div>
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" v-model="form.kategori_jabatan" value="Keterampilan" id="katKeterampilan">
                                                <label class="form-check-label fw-semibold" for="katKeterampilan">
                                                    <i class="bi bi-tools text-warning me-1"></i>Keterampilan
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="col-12">
                                        <div class="card border-warning border-2 bg-warning bg-opacity-10">
                                            <div class="card-body py-2 px-3">
                                                <label class="form-label small fw-bold text-warning-emphasis mb-2">
                                                    <i class="bi bi-cash-coin me-1"></i>Tunjangan Jabatan
                                                </label>
                                                <!-- Radio: Dengan / Non Tunjangan -->
                                                <div class="d-flex gap-4 mb-2">
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" id="tunjanganYa"
                                                            v-model="opsiTunjangan" value="dengan">
                                                        <label class="form-check-label fw-semibold text-success" for="tunjanganYa">
                                                            <i class="bi bi-check-circle-fill me-1"></i>Dengan Tunjangan
                                                        </label>
                                                    </div>
                                                    <div class="form-check">
                                                        <input class="form-check-input" type="radio" id="tunjanganTidak"
                                                            v-model="opsiTunjangan" value="non">
                                                        <label class="form-check-label fw-semibold text-secondary" for="tunjanganTidak">
                                                            <i class="bi bi-x-circle me-1"></i>Non Tunjangan
                                                        </label>
                                                    </div>
                                                </div>
                                                <!-- Input nominal, hanya muncul jika Dengan Tunjangan -->
                                                <div v-if="opsiTunjangan === 'dengan'" class="input-group mb-1">
                                                    <span class="input-group-text bg-white fw-bold">Rp</span>
                                                    <input v-model="form.tunjangan" type="number" min="0" class="form-control" placeholder="Contoh: 540000">
                                                </div>
                                                <div class="small text-warning-emphasis mt-1">
                                                    <i class="bi bi-info-circle"></i>
                                                    <strong>Dengan Tunjangan</strong> &rarr; template <strong>SK_FUNGSIONAL_TUNJANGAN</strong>.
                                                    <strong>Non Tunjangan</strong> &rarr; template <strong>SK_FUNGSIONAL</strong>.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SEKSI 4: PENANDATANGAN -->
                        <div class="card shadow-sm border-0 mb-3">
                            <div class="card-header bg-white py-3">
                                <h6 class="fw-bold text-secondary mb-0">
                                    <i class="bi bi-pen me-2"></i>4. Penandatangan / Pengesah Petikan
                                </h6>
                            </div>
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label small fw-bold">Pilih Pejabat Penandatangan</label>
                                        <SearchSelect :options="listPejabat" v-model="form.pejabat_nip" 
                                            label-key="jabatan" value-key="nip" 
                                            placeholder="Pilih pejabat dari master..." 
                                            @change="handlePejabatChange" />
                                    </div>
                                    <div v-if="pejabatTerpilih" class="col-12">
                                        <div class="bg-light p-3 rounded border small">
                                            <div class="row g-2">
                                                <div class="col-md-4">
                                                    <span class="text-muted d-block">Nama</span>
                                                    <strong>{{ pejabatTerpilih.nama }}</strong>
                                                </div>
                                                <div class="col-md-4">
                                                    <span class="text-muted d-block">Jabatan</span>
                                                    <strong>{{ pejabatTerpilih.jabatan }}</strong>
                                                </div>
                                                <div class="col-md-4">
                                                    <span class="text-muted d-block">Pangkat / NIP</span>
                                                    <strong>{{ pejabatTerpilih.pangkat }}</strong>
                                                    <div class="font-monospace text-muted" style="font-size: 0.75rem;">{{ pejabatTerpilih.nip }}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SEKSI 5: ADMINISTRASI (OPSIONAL) -->
                        <div class="card shadow-sm border-0">
                            <div class="card-header bg-white py-3">
                                <h6 class="fw-bold text-muted mb-0">
                                    <i class="bi bi-hash me-2"></i>5. Administrasi (Opsional)
                                </h6>
                            </div>
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label small text-muted">Nomor SK / Naskah</label>
                                        <input v-model="form.nomor_naskah" class="form-control font-monospace" placeholder="Biarkan kosong jika belum ada...">
                                    </div>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>
                <div class="modal-footer bg-white">
                    <button type="button" class="btn btn-light border px-4" @click="closeModal">Batal</button>
                    <button type="button" class="btn px-4 shadow text-white fw-bold" 
                            style="background-color: #5c35a5;" 
                            @click="simpanData" :disabled="isSaving">
                        <span v-if="isSaving"><div class="spinner-border spinner-border-sm me-1"></div></span>
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- ============================================================ -->
    <!-- MODAL PREVIEW DOKUMEN                                          -->
    <!-- ============================================================ -->
    <div v-if="showPreviewModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.8); z-index: 1060;" tabindex="-1" @click.self="closePreview">
        <div class="modal-dialog modal-xl modal-fullscreen-sm-down modal-dialog-scrollable" style="height: 95vh;">
            <div class="modal-content h-100 border-0">
                <div class="modal-header bg-dark text-white border-0 py-2 align-items-center justify-content-between">
                    <h6 class="modal-title mb-0">
                        <i class="bi bi-eye me-2"></i>Preview SK Fungsional
                        <span v-if="currentPreviewItem" class="ms-2 fw-normal text-white-50 small">— {{ currentPreviewItem.nama }}</span>
                    </h6>
                    <div>
                        <button class="btn btn-sm btn-success me-2" @click="downloadFromPreview">
                            <i class="bi bi-download me-1"></i> <span class="d-none d-md-inline">Download</span>
                        </button>
                        <button type="button" class="btn-close btn-close-white" @click="closePreview"></button>
                    </div>
                </div>
                <div class="modal-body p-0 d-flex flex-column bg-light position-relative">
                    <ul class="nav nav-tabs nav-justified bg-white border-bottom shadow-sm">
                        <li class="nav-item">
                            <a class="nav-link rounded-0 py-3 fw-bold" :class="previewTab === 'BASAH' ? 'active text-primary' : 'text-muted'" @click="changePreviewTab('BASAH')">TTD BASAH</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link rounded-0 py-3 fw-bold" :class="previewTab === 'TTE' ? 'active text-success' : 'text-muted'" @click="changePreviewTab('TTE')">TTE (Srikandi)</a>
                        </li>
                    </ul>
                    <div class="flex-grow-1 bg-secondary d-flex justify-content-center overflow-auto py-4 position-relative">
                        <div v-if="previewLoading" class="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center bg-secondary bg-opacity-75" style="z-index: 10;">
                            <div class="spinner-border text-white" role="status"></div>
                            <div class="text-white small mt-2">Memuat preview...</div>
                        </div>
                        <div id="docx-preview-container-fungsional" class="bg-white shadow-lg" style="width: 210mm; min-height: 297mm; padding: 20px;"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

</div>
`;
