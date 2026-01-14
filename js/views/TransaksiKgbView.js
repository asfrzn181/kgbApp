// ==========================================
// 1. TAMPILAN COMPONENT SEARCH SELECT
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
            @focus="showSuggestions = true" @blur="delayHide" placeholder="Ketik nama jabatan..." autocomplete="off">
        
        <ul v-if="showSuggestions && suggestions.length > 0" class="list-group position-absolute w-100 shadow mt-1" style="z-index: 1050; max-height: 250px; overflow-y: auto;">
            <li v-for="item in suggestions" :key="item.id" class="list-group-item list-group-item-action small cursor-pointer py-2" @mousedown="selectItem(item)">
                <div class="fw-bold text-dark">{{ item.nama_jabatan }}</div>
                <div class="d-flex justify-content-between small mt-1">
                    <span class="badge bg-light text-secondary border">{{ item.jenis_jabatan || 'Umum' }}</span>
                    <span v-if="item.bup" class="badge bg-warning text-dark border">BUP {{ item.bup }}</span>
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
            @focus="showSuggestions = true" @blur="delayHide" placeholder="Cari unit kerja..." autocomplete="off">
        
        <ul v-if="showSuggestions && suggestions.length > 0" class="list-group position-absolute w-100 shadow mt-1" style="z-index: 1050; max-height: 250px; overflow-y: auto;">
            <li v-for="(item, index) in suggestions" :key="index" class="list-group-item list-group-item-action small cursor-pointer py-2" @mousedown="selectItem(item)">
                <div class="fw-bold text-dark"><i class="bi bi-geo-alt me-2 text-muted"></i>{{ item }}</div>
            </li>
        </ul>
    </div>
`;

// ==========================================
// 4. TAMPILAN COMPONENT AUTOCOMPLETE PERANGKAT DAERAH
// ==========================================
export const TplAutocompletePerangkatDaerah = `
    <div class="position-relative w-100">
        <input type="text" class="form-control" :value="modelValue" @input="handleInput"
            @focus="showSuggestions = true" @blur="delayHide" placeholder="Cari perangkat daerah..." autocomplete="off">
        
        <ul v-if="showSuggestions && suggestions.length > 0" class="list-group position-absolute w-100 shadow mt-1" style="z-index: 1050; max-height: 250px; overflow-y: auto;">
            <li v-for="(item, index) in suggestions" :key="index" class="list-group-item list-group-item-action small cursor-pointer py-2" @mousedown="selectItem(item)">
                <div class="fw-bold text-dark"><i class="bi bi-building me-2 text-muted"></i>{{ item }}</div>
            </li>
        </ul>
    </div>
`;

// ==========================================
// 5. TAMPILAN UTAMA (UPDATE TERBARU: SWITCH SELESAI)
// ==========================================
export const TplMain = `
<div class="p-3 p-md-4">
    <div v-if="!showModal && !showPreviewModal">
        
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
            <div>
                <h3 class="fw-bold text-primary mb-1">Data Usulan KGB</h3>
                <p class="text-muted small mb-0">Manajemen usulan kenaikan gaji berkala.</p>
            </div>
            <button @click="openModal()" class="btn btn-primary shadow-sm text-nowrap w-100 w-md-auto">
                <i class="bi bi-plus-lg me-2"></i> Input Baru
            </button>
        </div>

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
                        <input type="date" v-model="filterStartDate" class="form-control form-control-sm" placeholder="Mulai TMT">
                        <span class="small text-muted">-</span>
                        <input type="date" v-model="filterEndDate" class="form-control form-control-sm" placeholder="Sampai TMT">
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
                <div v-if="tableLoading" class="text-center py-5">
                    <div class="spinner-border text-primary spinner-border-sm mb-2"></div>
                    <div class="small text-muted">Memuat data...</div>
                </div>

                <div v-else-if="listData.length === 0" class="text-center py-5">
                    <i class="bi bi-inbox fs-1 text-muted opacity-25 mb-2 d-block"></i>
                    <span class="text-muted">Tidak ada data ditemukan.</span>
                </div>

                <div v-else>
                    <div class="d-none d-md-block table-responsive">
                        <table class="table table-hover align-middle mb-0 text-nowrap" style="min-width: 1000px;">
                            <thead class="bg-light">
                                <tr>
                                    <th style="width: 40px;"></th>
                                    <th class="ps-2 py-3 small fw-bold">Pegawai</th>
                                    <th class="py-3 small fw-bold">Gaji Baru</th>
                                    <th class="py-3 small fw-bold">TMT</th>
                                    <th class="py-3 small fw-bold text-center" style="width: 120px;">Selesai</th>
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
                                            <div class="fw-bold text-dark">{{ item.nama_snapshot }}</div>
                                            <div class="small text-muted font-monospace">{{ item.nip }}</div>
                                        </td>
                                        <td class="fw-bold text-success font-monospace">{{ formatRupiah(item.gaji_baru) }}</td>
                                        <td>{{ formatTanggal(item.tmt_sekarang) }}</td>
                                        
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
                                                <button @click="previewSK(item)" class="btn btn-light border text-primary" title="Preview"><i class="bi bi-eye"></i></button>
                                                <button @click="openModal(item)" class="btn btn-light border text-secondary" title="Edit"><i class="bi bi-pencil"></i></button>
                                                <button  @click="hapusTransaksi(item)" class="btn btn-light border text-danger" title="Hapus"><i class="bi bi-trash"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    <tr v-if="isExpanded(item.id)" class="bg-light border-bottom fade-in">
                                        <td colspan="6" class="p-3 ps-5">
                                            <div class="row g-3 small">
                                                <div class="col-md-4">
                                                    <h6 class="fw-bold text-muted mb-2 text-uppercase" style="font-size: 0.7rem;">Detail Jabatan</h6>
                                                    <div class="mb-1"><i class="bi bi-briefcase me-2"></i> {{ item.jabatan_snapshot }}</div>
                                                    <div class="mb-1"><i class="bi bi-geo-alt me-2"></i> {{ item.unit_kerja }}</div>
                                                    <div class="mb-1"><i class="bi bi-building me-2"></i> {{ item.perangkat_daerah }}</div>
                                                    <div><span class="badge bg-white border text-dark">{{ item.golongan }}</span></div>
                                                </div>
                                                <div class="col-md-4">
                                                    <h6 class="fw-bold text-muted mb-2 text-uppercase" style="font-size: 0.7rem;">Data Gaji</h6>
                                                    <table class="table table-sm table-borderless mb-0 w-auto">
                                                        <tr><td class="text-muted ps-0">Gaji Lama:</td><td class="fw-bold">{{ formatRupiah(item.dasar_gaji_lama) }}</td></tr>
                                                        <tr><td class="text-muted ps-0">MK Baru:</td><td class="fw-bold">{{ item.mk_baru_tahun }} Tahun {{ item.mk_baru_bulan }} Bulan</td></tr>
                                                        <tr><td class="text-muted ps-0">TMT YAD:</td><td class="text-danger fw-bold">{{ item.tmt_selanjutnya ? formatTanggal(item.tmt_selanjutnya) : 'STOP/PENSIUN' }}</td></tr>
                                                    </table>
                                                </div>
                                                <div class="col-md-4">
                                                    <h6 class="fw-bold text-muted mb-2 text-uppercase" style="font-size: 0.7rem;">Administrasi</h6>
                                                    <div class="mb-1" v-if="item.nomor_naskah">
                                                        <span class="text-muted">No. SK:</span> <span class="fw-bold font-monospace text-dark">{{ item.nomor_naskah }}</span>
                                                    </div>
                                                    <div v-else class="text-muted fst-italic mb-1">Belum ada nomor SK</div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>
                    </div>

                    <div class="d-md-none bg-light p-3 d-flex flex-column gap-3">
                        <div v-for="item in listData" :key="'mob-'+item.id" class="card border-0 shadow-sm">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <h6 class="fw-bold mb-0 text-primary">{{ item.nama_snapshot }}</h6>
                                        <small class="text-muted font-monospace">{{ item.nip }}</small>
                                    </div>
                                    <span class="small fw-bold" :class="item.status==='SELESAI' ? 'text-success' : 'text-muted'">
                                        {{ item.status==='SELESAI' ? 'Selesai' : 'Belum Selesai' }}
                                    </span>
                                </div>
                                
                                <div class="bg-light p-2 rounded small mb-3">
                                    <div class="row g-2">
                                        <div class="col-6"><span class="text-muted d-block">TMT</span> <strong>{{ formatTanggal(item.tmt_sekarang) }}</strong></div>
                                        <div class="col-6"><span class="text-muted d-block">Gaji</span> <strong class="text-success">{{ formatRupiah(item.gaji_baru) }}</strong></div>
                                        <div class="col-12"><span class="text-muted d-block">Jabatan</span> <strong>{{ item.jabatan_snapshot }}</strong></div>
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
                                        <button @click="previewSK(item)" class="btn btn-outline-primary"><i class="bi bi-eye"></i></button>
                                        <button @click="openModal(item)" class="btn btn-outline-secondary"><i class="bi bi-pencil"></i></button>
                                        <button  @click="hapusTransaksi(item)" class="btn btn-outline-danger"><i class="bi bi-trash"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card-footer bg-white p-3">
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
                    <small class="text-muted">Halaman {{ currentPage }} dari {{ totalPages }}</small>
                    <nav aria-label="Page navigation">
                        <ul class="pagination pagination-sm mb-0">
                            <li class="page-item" :class="{ disabled: currentPage === 1 }">
                                <button class="page-link" @click="goToPage(currentPage - 1)" aria-label="Previous"><span aria-hidden="true">&laquo;</span></button>
                            </li>
                            <li class="page-item" v-for="page in visiblePages" :key="page" :class="{ active: currentPage === page }">
                                <button class="page-link" @click="goToPage(page)">{{ page }}</button>
                            </li>
                            <li class="page-item" :class="{ disabled: currentPage === totalPages || totalPages === 0 }">
                                <button class="page-link" @click="goToPage(currentPage + 1)" aria-label="Next"><span aria-hidden="true">&raquo;</span></button>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>
        </div>
    </div>

    <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 1050;" tabindex="-1">
        <div class="modal-dialog modal-xl modal-fullscreen-sm-down modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title fw-bold">{{ isEditMode ? 'Edit Usulan' : 'Input Usulan Baru' }}</h5>
                    <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                </div>
                <div class="modal-body bg-light p-3 p-md-4">
                    <form @submit.prevent="simpanTransaksi">
                        <div class="card shadow-sm border-0 mb-3">
                            <div class="card-header bg-white py-3"><h6 class="fw-bold text-primary mb-0">1. Identitas Pegawai</h6></div>
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-12 col-md-4"><label class="form-label small fw-bold">NIP</label><div class="input-group"><input v-model="form.nip" type="text" class="form-control" :disabled="isEditMode" placeholder="Ketik NIP..." @input="handleNipInput"><span v-if="isSearching" class="input-group-text bg-white"><div class="spinner-border spinner-border-sm"></div></span></div></div>
                                    <div class="col-6 col-md-2"><label class="form-label small fw-bold">Tipe ASN</label><select v-model="form.tipe_asn" class="form-select"><option value="PNS">PNS</option><option value="PPPK">PPPK</option></select></div>
                                    <div class="col-12 col-md-6"><label class="form-label small text-muted">Nama Lengkap</label><input v-model="form.nama" class="form-control fw-bold" required></div>
                                    <div class="col-6 col-md-3"><label class="form-label small text-muted">Tempat Lahir</label><input v-model="form.tempat_lahir" class="form-control"></div>
                                    <div class="col-6 col-md-3"><label class="form-label small text-muted">Tgl Lahir</label><input v-model="form.tgl_lahir" type="date" class="form-control border-warning" required></div>
                                    <div class="col-12 col-md-6"><label class="form-label small text-muted">Jabatan</label><AutocompleteJabatan v-model="form.jabatan" @select="handleJabatanSelect" /></div>
                                    
                                    <div class="col-12 col-md-6"><label class="form-label small text-muted">Unit Kerja</label><AutocompleteUnitKerja v-model="form.unit_kerja" /><label class="form-label small text-danger">Bila tidak bisa dihapus : CTRL + A + BACKSPACE</label></div>
                                    
                                    <div class="col-12 col-md-6"><label class="form-label small text-muted">Perangkat Daerah</label><AutocompletePerangkatDaerah v-model="form.perangkat_daerah" /></div>
                                    
                                    <div class="col-12 col-md-6"><label class="form-label small text-muted">Jenis Jabatan</label><select v-model="form.jenis_jabatan" class="form-select"><option value="Pelaksana">Pelaksana</option><option value="Fungsional">Fungsional</option><option value="Struktural">Struktural</option></select></div>
                                </div>
                            </div>
                        </div>

                        <div class="card shadow-sm border-0 mb-3"><div class="card-header bg-white py-3"><h6 class="fw-bold text-secondary mb-0">2. Dasar SK Lama</h6></div><div class="card-body"><div class="row g-3"><div class="col-12 col-md-6"><label class="form-label small fw-bold">Dasar Surat</label><SearchSelect :options="listDasarHukum" v-model="form.dasar_hukum" label-key="judul" value-key="judul" placeholder="Pilih..." /></div><div class="col-12 col-md-6"><label class="form-label small text-muted">Pejabat TTD</label><input v-model="form.dasar_pejabat" class="form-control"></div><div class="col-6 col-md-4"><label class="form-label small text-muted">Nomor SK</label><input v-model="form.dasar_nomor" class="form-control"></div><div class="col-6 col-md-4"><label class="form-label small text-muted">Tanggal SK</label><input v-model="form.dasar_tanggal" type="date" class="form-control"></div><div class="col-12 col-md-4"><label class="form-label small fw-bold text-primary">TMT Gaji Lama</label><input v-model="form.dasar_tmt" type="date" class="form-control" required></div><div class="col-12 bg-light p-3 rounded border"><div class="row g-2"><div class="col-12 col-md-4"><label class="small text-muted fw-bold">Gol. Lama</label><SearchSelect :options="filteredGolongan" v-model="form.dasar_golongan" label-key="kode" value-key="kode" /></div><div class="col-6 col-md-2"><label class="small text-muted">MK Thn</label><input v-model.number="form.dasar_mk_tahun" type="number" class="form-control form-control-sm"></div><div class="col-6 col-md-2"><label class="small text-muted">MK Bln</label><input v-model.number="form.dasar_mk_bulan" type="number" class="form-control form-control-sm"></div><div class="col-12 col-md-4"><label class="small text-muted fw-bold">Gaji Lama</label><div class="input-group input-group-sm"><input :value="formatRupiah(form.dasar_gaji_lama)" class="form-control fw-bold text-secondary" readonly><button type="button" @click="cariGajiLama" class="btn btn-outline-secondary"><i class="bi bi-arrow-clockwise"></i></button></div></div></div></div></div></div></div>
                        
                        <div class="card shadow-sm border-0 border-start border-4 border-success mb-3"><div class="card-header bg-success bg-opacity-10 py-3"><h6 class="fw-bold text-success mb-0">3. Penetapan Gaji Baru</h6></div><div class="card-body"><div class="row g-3"><div class="col-12 col-md-4"><label class="form-label small fw-bold">Golongan Baru</label><SearchSelect :options="filteredGolongan" v-model="form.golongan" label-key="label_full" value-key="kode" placeholder="Pilih..." @change="handleGolonganChange" /></div><div class="col-6 col-md-2"><label class="form-label small fw-bold">MK Thn</label><input v-model.number="form.mk_baru_tahun" type="number" class="form-control fw-bold"></div><div class="col-6 col-md-2"><label class="form-label small fw-bold">MK Bln</label><input v-model.number="form.mk_baru_bulan" type="number" class="form-control"></div><div class="col-12 col-md-4"><label class="form-label small fw-bold text-success">Gaji Pokok Baru</label><div class="input-group"><input :value="formatRupiah(form.gaji_baru)" class="form-control bg-success text-white fw-bold" readonly><button type="button" @click="cariGajiBaru" class="btn btn-outline-success"><i class="bi bi-arrow-clockwise"></i></button></div></div><div class="col-12"><hr></div><div v-if="form.tipe_asn === 'PPPK'" class="col-12 bg-warning bg-opacity-10 p-3 rounded border border-warning mb-3"><div class="row g-3"><div class="col-12 col-md-6"><label class="form-label small fw-bold">Masa Perjanjian</label><input v-model="form.masa_perjanjian" class="form-control"></div><div class="col-12 col-md-6"><label class="form-label small fw-bold">Perpanjangan</label><input v-model="form.perpanjangan_perjanjian" class="form-control"></div></div></div><div class="col-12 col-md-3"><label class="form-label small fw-bold">TMT Sekarang</label><input v-model="form.tmt_sekarang" type="date" class="form-control" required></div><div class="col-12 col-md-4"><label class="form-label small text-muted">TMT YAD</label><div class="input-group"><input v-model="form.tmt_selanjutnya" type="date" class="form-control bg-white"><button type="button" @click="setTmtPensiun" class="btn btn-danger text-white btn-sm fw-bold"><i class="bi bi-stop-circle me-1"></i> STOP</button></div><div class="small text-danger fw-bold mt-1" v-if="pensiunMsg">{{ pensiunMsg }}</div></div><div class="col-12 col-md-5"><label class="form-label small fw-bold text-primary">Pejabat TTD</label><SearchSelect :options="listPejabat" v-model="form.pejabat_baru_nip" label-key="jabatan" value-key="nip" /></div></div></div></div>
                        
                        <div class="card shadow-sm border-0 border-start border-4 border-danger"><div class="card-body py-2"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" v-model="form.is_pensiun_manual" id="manualPensiunCheck"><label class="form-check-label small fw-bold text-danger" for="manualPensiunCheck">Set Status: Berhenti Berkala (Pensiun/Meninggal)</label></div></div></div>
                    </form>
                </div>
                <div class="modal-footer bg-white">
                    <button type="button" class="btn btn-light border px-4" @click="closeModal">Batal</button>
                    <button type="button" class="btn btn-primary px-4 shadow" @click="simpanTransaksi" :disabled="isSaving">Simpan</button>
                </div>
            </div>
        </div>
    </div>

    <div v-if="showPreviewModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.8); z-index: 1060;" tabindex="-1" @click.self="closePreview">
        <div class="modal-dialog modal-xl modal-fullscreen-sm-down modal-dialog-scrollable" style="height: 95vh;">
            <div class="modal-content h-100 border-0">
                <div class="modal-header bg-dark text-white border-0 py-2 align-items-center justify-content-between">
                    <h6 class="modal-title mb-0"><i class="bi bi-eye me-2"></i>Preview SK</h6>
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
                        <div id="docx-preview-container" class="bg-white shadow-lg transition-all" style="width: 210mm; min-height: 297mm; padding: 20px;"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`;