export const TplCekDuplikat = `
<div class="container-fluid px-4 mt-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h3 class="fw-bold text-danger"><i class="bi bi-exclamation-diamond me-2"></i>Pembersih Nomor Ganda</h3>
    </div>

    <div class="card shadow-sm mb-4 border-0">
        <div class="card-body">
            <div class="row align-items-end">
                <div class="col-md-3">
                    <label class="form-label fw-bold small">Tahun Scan</label>
                    <select class="form-select" v-model="filterTahun">
                        <option v-for="y in yearOptions" :value="y">{{ y }}</option>
                    </select>
                </div>
                <div class="col-md-6">
                    <div class="alert alert-secondary mb-0 small py-2">
                        <i class="bi bi-info-circle me-1"></i>
                        Fitur ini hanya menampilkan nomor yang <b>konflik (dipakai >1 orang)</b>. Data yang aman disembunyikan.
                    </div>
                </div>
                <div class="col-md-3 text-end">
                    <button @click="scanDuplicates" class="btn btn-primary w-100" :disabled="loading">
                        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                        <i v-else class="bi bi-search me-2"></i> Scan Konflik
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div v-if="hasScanned" class="animate-fade">
        
        <div v-if="duplicateList.length === 0" class="text-center py-5">
            <i class="bi bi-shield-check text-success" style="font-size: 4rem;"></i>
            <h4 class="mt-3">Bersih!</h4>
            <p class="text-muted">Tidak ditemukan nomor ganda pada tahun {{ filterTahun }}.</p>
        </div>

        <div v-else>
            <div class="alert alert-danger d-flex align-items-center shadow-sm">
                <i class="bi bi-lightning-fill fs-3 me-3"></i>
                <div>
                    <strong>Ditemukan {{ duplicateList.length }} Konflik Nomor!</strong><br>
                    Silakan pilih salah satu dokumen untuk di-reset nomornya agar konflik hilang.
                </div>
            </div>

            <div class="card shadow-sm border-0">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-bordered mb-0 align-middle">
                            <thead class="bg-light text-secondary small text-uppercase">
                                <tr>
                                    <th class="ps-4">Nomor Konflik</th>
                                    <th>Siapa yang menggunakan?</th>
                                    <th class="text-center" style="width: 150px;">Aksi Perbaikan</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, idx) in duplicateList" :key="idx">
                                    <td class="ps-4 bg-light fw-bold text-dark font-monospace" style="vertical-align: top;">
                                        {{ item.nomor }}
                                        <div class="mt-2"><span class="badge bg-danger">{{ item.count }} Conflict</span></div>
                                    </td>

                                    <td colspan="2" class="p-0">
                                        <table class="table table-borderless mb-0">
                                            <tr v-for="doc in item.usage" class="border-bottom">
                                                <td class="ps-3">
                                                    <div class="d-flex align-items-center">
                                                        <span class="badge me-2" :class="doc.source === 'LOG' ? 'bg-secondary' : 'bg-primary'">
                                                            {{ doc.source === 'LOG' ? 'Log' : 'SK' }}
                                                        </span>
                                                        <div class="d-flex flex-column">
                                                            <span class="fw-bold text-dark">{{ doc.nama }}</span>
                                                            <small class="text-muted">{{ doc.jabatan }} | {{ doc.tanggal }}</small>
                                                            <small class="text-muted fst-italic" style="font-size: 0.7rem;">ID: {{ doc.id }}</small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="text-center" style="width: 150px; vertical-align: middle;">
                                                    <button @click="resetNomor(doc)" class="btn btn-outline-danger btn-sm" title="Hapus nomor dari dokumen ini">
                                                        <i class="bi bi-trash"></i> Reset
                                                    </button>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`;