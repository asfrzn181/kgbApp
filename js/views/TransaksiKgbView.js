// 1. TAMPILAN COMPONENT SEARCH SELECT
export const TplSearchSelect = `
    <div class="dropdown w-100" ref="dropdown">
        <button class="form-select text-start d-flex justify-content-between align-items-center" 
            type="button" @click="!disabled && (isOpen = !isOpen)" 
            :class="{'text-muted': !modelValue, 'bg-light': disabled}" :disabled="disabled">
            <span class="text-truncate">{{ selectedLabel || placeholder || 'Pilih...' }}</span>
            <i class="bi bi-chevron-down small"></i>
        </button>
        <div class="dropdown-menu w-100 p-2 shadow" :class="{ show: isOpen }" style="max-height: 300px; overflow-y: auto;">
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

// 2. TAMPILAN COMPONENT AUTOCOMPLETE JABATAN
export const TplAutocompleteJabatan = `
    <div class="position-relative">
        <input type="text" class="form-control" :value="modelValue" @input="handleInput"
            @focus="showSuggestions = true" @blur="delayHide" placeholder="Ketik nama jabatan..." autocomplete="off">
        <ul v-if="showSuggestions && suggestions.length > 0" class="list-group position-absolute w-100 shadow mt-1" style="z-index: 1050; max-height: 200px; overflow-y: auto;">
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

// 3. TAMPILAN UTAMA (TABEL & FORM)
export const TplMain = `
<div class="p-4">
    <div v-if="!showModal && !showPreviewModal">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div><h3 class="fw-bold text-primary mb-1">Data Usulan KGB</h3><p class="text-muted small mb-0">Riwayat usulan gaji berkala.</p></div>
            <div class="d-flex gap-2">
                <div class="input-group shadow-sm" style="width: 250px;">
                    <input v-model="tableSearch" type="text" class="form-control border-end-0" placeholder="Cari Nama/NIP...">
                    <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                </div>
                <button @click="openModal()" class="btn btn-primary shadow-sm"><i class="bi bi-plus-lg me-2"></i> Buat Baru</button>
            </div>
        </div>
        <div class="card shadow-sm border-0">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-4">Pegawai</th>
                                <th>Jabatan</th>
                                <th>Gaji Baru</th>
                                <th>TMT Berlaku</th>
                                <th class="text-center">Status & Tanggal</th>
                                <th>Nomor SK</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="tableLoading"><td colspan="7" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>
                            <tr v-else-if="listData.length === 0"><td colspan="7" class="text-center py-5 text-muted">Belum ada data.</td></tr>
                            <tr v-else v-for="item in listData" :key="item.id">
                                <td class="ps-4">
                                    <div class="fw-bold text-dark">{{ item.nama_snapshot }}</div>
                                    <div class="small text-muted font-monospace">{{ item.nip }}</div>
                                </td>
                                <td>
                                    <div class="small fw-bold text-truncate" style="max-width: 200px;" :title="item.jabatan_snapshot">{{ item.jabatan_snapshot }}</div>
                                    <span class="badge bg-light text-secondary border">{{ item.golongan }}</span>
                                    <span v-if="item.tipe_asn === 'PPPK'" class="badge bg-warning text-dark border ms-1">PPPK</span>
                                </td>
                                <td class="fw-bold text-success">{{ formatRupiah(item.gaji_baru) }}</td>
                                <td>{{ formatTanggal(item.tmt_sekarang) }}</td>
                                
                                <td class="text-center">
                                    <div class="dropdown">
                                        <button class="btn btn-sm dropdown-toggle fw-bold text-white shadow-sm" 
                                            :class="statusColor(item.status)" type="button" data-bs-toggle="dropdown" style="min-width: 110px;">
                                            {{ item.status || 'DRAFT' }}
                                        </button>
                                        <ul class="dropdown-menu shadow">
                                            <li><h6 class="dropdown-header">Ubah Status</h6></li>
                                            <li><a class="dropdown-item" href="#" @click.prevent="updateStatus(item, 'DRAFT')"><i class="bi bi-file-earmark me-2"></i>DRAFT</a></li>
                                            <li><a class="dropdown-item" href="#" @click.prevent="updateStatus(item, 'TEKEN')"><i class="bi bi-pen me-2 text-warning"></i>TEKEN</a></li>
                                            <li><a class="dropdown-item" href="#" @click.prevent="updateStatus(item, 'DISTRIBUSI')"><i class="bi bi-check-circle me-2 text-success"></i>DISTRIBUSI</a></li>
                                        </ul>
                                    </div>
                                    <div class="mt-1 small fw-bold text-muted" style="font-size: 0.75em;">
                                        <span v-if="item.status === 'TEKEN' && item.tgl_teken_formatted">{{ item.tgl_teken_formatted }}</span>
                                        <span v-else-if="item.status === 'DISTRIBUSI' && item.tgl_distribusi_formatted">{{ item.tgl_distribusi_formatted }}</span>
                                    </div>
                                </td>

                                <td>
                                    <div v-if="item.nomor_naskah">
                                        <span class="badge bg-success mb-1"><i class="bi bi-check-circle me-1"></i>Terbit</span>
                                        <div class="small font-monospace text-dark" style="font-size: 0.75rem;">{{ item.nomor_naskah }}</div>
                                    </div>
                                    <div v-else>
                                        <span class="badge bg-secondary">Draft</span>
                                    </div>
                                </td>

                                <td class="text-end pe-4">
                                    <div class="btn-group">
                                        <button @click="previewSK(item)" class="btn btn-sm btn-light border text-primary" title="Preview"><i class="bi bi-eye-fill"></i></button>
                                        
                                        <button @click="openModal(item)" class="btn btn-sm btn-light border text-secondary" title="Edit"><i class="bi bi-pencil-square"></i></button>
                                        
                                        <button v-if="!item.nomor_naskah" @click="hapusTransaksi(item)" class="btn btn-sm btn-light border text-danger" title="Hapus"><i class="bi bi-trash"></i></button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="card-footer bg-white py-3 d-flex justify-content-between">
                <button class="btn btn-sm btn-outline-secondary" @click="prevPage" :disabled="currentPage===1">Prev</button>
                <span class="small text-muted align-self-center">Hal {{ currentPage }}</span>
                <button class="btn btn-sm btn-outline-primary" @click="nextPage" :disabled="isLastPage">Next</button>
            </div>
        </div>
    </div>

    <div v-if="showModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 1050;" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title fw-bold">{{ isEditMode ? 'Edit Usulan' : 'Input Usulan Baru' }}</h5>
                    <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
                </div>
                <div class="modal-body bg-light p-4">
                    <form @submit.prevent="simpanTransaksi">
                        
                        <div class="card shadow-sm border-0 mb-3">
                            <div class="card-header bg-white py-3"><h6 class="fw-bold text-primary mb-0">1. Identitas Pegawai</h6></div>
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-md-4">
                                        <label class="form-label small fw-bold">NIP / NI PPPK</label>
                                        <div class="input-group">
                                            <input v-model="form.nip" type="text" class="form-control" :disabled="isEditMode" placeholder="Ketik NIP..." @input="handleNipInput">
                                            <span v-if="isSearching" class="input-group-text bg-white"><div class="spinner-border spinner-border-sm"></div></span>
                                        </div>
                                        <div v-if="searchMsg" class="form-text small fw-bold text-primary">{{ searchMsg }}</div>
                                    </div>
                                    <div class="col-md-2">
                                        <label class="form-label small fw-bold">Tipe ASN</label>
                                        <select v-model="form.tipe_asn" class="form-select">
                                            <option value="PNS">PNS</option>
                                            <option value="PPPK">PPPK</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6"><label class="form-label small text-muted">Nama Lengkap</label><input v-model="form.nama" class="form-control fw-bold" required></div>
                                    <div class="col-md-3"><label class="form-label small text-muted">Tempat Lahir</label><input v-model="form.tempat_lahir" class="form-control" placeholder="Kota"></div>
                                    <div class="col-md-3">
                                        <label class="form-label small text-muted">Tanggal Lahir</label>
                                        <input v-model="form.tgl_lahir" type="date" class="form-control border-warning" required>
                                        <div class="form-text small fw-bold text-dark" v-if="currentAge > 0">Umur: {{ currentAge }} Thn</div>
                                    </div>
                                    <div class="col-md-6"><label class="form-label small text-muted">Jabatan</label><AutocompleteJabatan v-model="form.jabatan" @select="handleJabatanSelect" /></div>
                                    <div class="col-md-6"><label class="form-label small text-muted">Perangkat Daerah</label><input v-model="form.perangkat_daerah" class="form-control"></div>
                                    <div class="col-md-6"><label class="form-label small text-muted">Unit Kerja (Lokasi)</label><input v-model="form.unit_kerja" class="form-control"></div>
                                    <div class="col-md-6">
                                        <label class="form-label small text-muted">Jenis Jabatan</label>
                                        <select v-model="form.jenis_jabatan" class="form-select">
                                            <option value="Pelaksana">Pelaksana</option>
                                            <option value="Fungsional">Fungsional</option>
                                            <option value="Struktural">Struktural</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="card shadow-sm border-0 mb-3">
                            <div class="card-header bg-white py-3"><h6 class="fw-bold text-secondary mb-0">2. Dasar SK Lama</h6></div>
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-md-6"><label class="form-label small fw-bold">Dasar Surat</label><SearchSelect :options="listDasarHukum" v-model="form.dasar_hukum" label-key="judul" value-key="judul" placeholder="Pilih..." /></div>
                                    <div class="col-md-6"><label class="form-label small text-muted">Pejabat TTD</label><input v-model="form.dasar_pejabat" class="form-control"></div>
                                    <div class="col-md-4"><label class="form-label small text-muted">Nomor SK</label><input v-model="form.dasar_nomor" class="form-control"></div>
                                    <div class="col-md-4"><label class="form-label small text-muted">Tanggal SK</label><input v-model="form.dasar_tanggal" type="date" class="form-control"></div>
                                    <div class="col-md-4"><label class="form-label small fw-bold text-primary">TMT Gaji Lama</label><input v-model="form.dasar_tmt" type="date" class="form-control" required></div>
                                    <div class="col-12 bg-light p-3 rounded border">
                                        <div class="row g-2">
                                            <div class="col-md-4"><label class="small text-muted fw-bold">Gol. Lama</label><SearchSelect :options="filteredGolongan" v-model="form.dasar_golongan" label-key="kode" value-key="kode" placeholder="Pilih..." /></div>
                                            <div class="col-md-2"><label class="small text-muted">MK Thn</label><input v-model.number="form.dasar_mk_tahun" type="number" class="form-control form-control-sm"></div>
                                            <div class="col-md-2"><label class="small text-muted">MK Bln</label><input v-model.number="form.dasar_mk_bulan" type="number" class="form-control form-control-sm"></div>
                                            <div class="col-md-4"><label class="small text-muted fw-bold">Gaji Lama</label><div class="input-group input-group-sm"><input :value="formatRupiah(form.dasar_gaji_lama)" class="form-control fw-bold text-secondary" readonly><button type="button" @click="cariGajiLama" class="btn btn-outline-secondary"><i class="bi bi-arrow-clockwise"></i></button></div></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="card shadow-sm border-0 border-start border-4 border-success mb-3">
                            <div class="card-header bg-success bg-opacity-10 py-3"><h6 class="fw-bold text-success mb-0">3. Penetapan Gaji Baru</h6></div>
                            <div class="card-body">
                                <div class="row g-3">
                                    <div class="col-md-4"><label class="form-label small fw-bold">Golongan Baru</label><SearchSelect :options="filteredGolongan" v-model="form.golongan" label-key="label_full" value-key="kode" placeholder="Pilih..." @change="handleGolonganChange" /></div>
                                    <div class="col-md-2"><label class="form-label small fw-bold">MK Thn</label><input v-model.number="form.mk_baru_tahun" type="number" class="form-control fw-bold" min="0"></div>
                                    <div class="col-md-2"><label class="form-label small fw-bold">MK Bln</label><input v-model.number="form.mk_baru_bulan" type="number" class="form-control" min="0" max="11"></div>
                                    <div class="col-md-4"><label class="form-label small fw-bold text-success">Gaji Pokok Baru</label><div class="input-group"><input :value="formatRupiah(form.gaji_baru)" class="form-control bg-success text-white fw-bold" readonly><button type="button" @click="cariGajiBaru" class="btn btn-outline-success"><i class="bi bi-arrow-clockwise"></i></button></div><div v-if="gajiMsg" class="small text-danger mt-1">{{ gajiMsg }}</div></div>
                                    
                                    <div class="col-12"><hr></div>
                                    
                                    <div v-if="form.tipe_asn === 'PPPK'" class="col-12 bg-warning bg-opacity-10 p-3 rounded border border-warning mb-3">
                                        <h6 class="text-warning small fw-bold mb-3"><i class="bi bi-exclamation-circle-fill me-2"></i>Atribut Khusus PPPK</h6>
                                        <div class="row g-3">
                                            <div class="col-md-6"><label class="form-label small fw-bold">Masa Perjanjian Kerja</label><input v-model="form.masa_perjanjian" class="form-control" placeholder="Contoh: 5 (Lima) Tahun"></div>
                                            <div class="col-md-6"><label class="form-label small fw-bold">Perpanjangan Perjanjian Kerja</label><input v-model="form.perpanjangan_perjanjian" class="form-control" placeholder="Contoh: 01 Januari 2025 s.d 31 Desember 2029"></div>
                                        </div>
                                    </div>

                                    <div class="col-md-3"><label class="form-label small fw-bold">TMT Sekarang</label><input v-model="form.tmt_sekarang" type="date" class="form-control" required></div>
                                    
                                    <div class="col-md-4">
                                        <label class="form-label small text-muted">TMT YAD (Selanjutnya)</label>
                                        <div class="input-group">
                                            <input v-model="form.tmt_selanjutnya" type="date" class="form-control bg-white">
                                            <button type="button" @click="setTmtPensiun" class="btn btn-danger text-white btn-sm fw-bold" title="Set Pensiun (00 00 0000)">
                                                <i class="bi bi-stop-circle me-1"></i> STOP
                                            </button>
                                        </div>
                                        <div class="small text-danger fw-bold mt-1" v-if="pensiunMsg">{{ pensiunMsg }}</div>
                                    </div>

                                    <div class="col-md-5"><label class="form-label small fw-bold text-primary">Pejabat Penandatangan SK</label><SearchSelect :options="listPejabat" v-model="form.pejabat_baru_nip" label-key="jabatan" value-key="nip" placeholder="Pilih Pejabat..." /></div>
                                </div>
                            </div>
                        </div>

                        <div class="card shadow-sm border-0 border-start border-4 border-danger">
                            <div class="card-header bg-danger bg-opacity-10 py-3"><h6 class="fw-bold text-danger mb-0">4. Status Akhir (Opsional)</h6></div>
                            <div class="card-body">
                                <div class="form-check form-switch p-2">
                                    <input class="form-check-input ms-0 me-2" type="checkbox" v-model="form.is_pensiun_manual" id="manualPensiunCheck" style="transform: scale(1.2);">
                                    <label class="form-check-label small fw-bold text-danger pt-1" for="manualPensiunCheck">
                                        Set Status: Berhenti Berkala (Pensiun/Meninggal)
                                    </label>
                                </div>
                                <div class="text-muted small ms-4">
                                    <i>Centang ini jika pegawai akan pensiun sebelum periode KGB berikutnya. TMT YAD akan dikosongkan.</i>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>
                <div class="modal-footer bg-white">
                    <button type="button" class="btn btn-light border px-4" @click="closeModal">Batal</button>
                    <button type="button" class="btn btn-primary px-4 shadow" @click="simpanTransaksi" :disabled="isSaving"><span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span> Simpan</button>
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
                
                <div class="modal-body p-0 d-flex flex-column bg-light position-relative">
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