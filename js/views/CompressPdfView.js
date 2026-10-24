export const TplCompressPdf = `
<div class="container-fluid px-4 mt-4 pb-5">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h3 class="fw-bold text-danger mb-0">
            <i class="bi bi-file-earmark-zip me-2"></i>Compress PDF
        </h3>
        <span class="badge bg-dark bg-opacity-75 px-3 py-2">
            <i class="bi bi-shield-lock me-1"></i> 100% Offline — File tidak dikirim ke server
        </span>
    </div>

    <!-- Upload Area -->
    <div class="card shadow-sm border-0 mb-4 overflow-hidden">
        <div class="card-body p-0">
            <!-- Dropzone -->
            <div 
                class="compress-dropzone text-center p-5"
                :class="{ 'compress-dropzone-active': isDragging, 'compress-dropzone-has-file': pdfFile }"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
                @click="triggerFileInput"
                style="cursor: pointer; transition: all 0.3s ease;"
            >
                <input 
                    type="file" 
                    ref="fileInput" 
                    accept=".pdf,application/pdf" 
                    @change="handleFileSelect" 
                    class="d-none"
                    id="pdfFileInput"
                >

                <!-- State: No File -->
                <div v-if="!pdfFile" class="py-3">
                    <div class="compress-icon-wrapper mb-3">
                        <i class="bi bi-cloud-arrow-up" style="font-size: 3.5rem; color: var(--primary-color); opacity: 0.7;"></i>
                    </div>
                    <h5 class="fw-bold text-dark mb-2">Drag & Drop PDF di sini</h5>
                    <p class="text-muted mb-3">atau klik untuk memilih file</p>
                    <span class="badge bg-light text-muted border px-3 py-2">
                        <i class="bi bi-info-circle me-1"></i> Maks. 200 MB — Hanya file .pdf
                    </span>
                </div>

                <!-- State: File Loaded -->
                <div v-else class="d-flex align-items-center justify-content-between px-4 py-2">
                    <div class="d-flex align-items-center">
                        <div class="bg-danger bg-opacity-10 rounded-3 p-3 me-3">
                            <i class="bi bi-file-earmark-pdf-fill text-danger" style="font-size: 2rem;"></i>
                        </div>
                        <div class="text-start">
                            <h6 class="fw-bold mb-1 text-dark text-truncate" style="max-width: 350px;">{{ pdfFile.name }}</h6>
                            <div class="d-flex gap-3 text-muted small">
                                <span><i class="bi bi-hdd me-1"></i>{{ formatFileSize(pdfFile.size) }}</span>
                                <span><i class="bi bi-files me-1"></i>{{ totalPages }} halaman</span>
                            </div>
                        </div>
                    </div>
                    <button @click.stop="resetAll" class="btn btn-outline-danger btn-sm" title="Hapus file">
                        <i class="bi bi-x-lg me-1"></i> Ganti File
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Settings Panel (only shown when file is loaded) -->
    <div v-if="pdfFile && totalPages > 0" class="row g-4 mb-4 animate-fade">
        
        <!-- Compression Settings -->
        <div class="col-lg-7">
            <div class="card shadow-sm border-0 h-100">
                <div class="card-header bg-white border-bottom-0 pt-4 px-4">
                    <h5 class="fw-bold mb-0"><i class="bi bi-sliders me-2 text-primary"></i>Pengaturan Kompresi</h5>
                </div>
                <div class="card-body px-4 pb-4">
                    
                    <!-- Quality Slider -->
                    <div class="mb-4">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <label class="form-label fw-bold mb-0">Kualitas Gambar</label>
                            <span class="badge px-3 py-2" :class="qualityBadgeClass">
                                {{ qualityLabel }} — {{ imageQuality * 100 }}%
                            </span>
                        </div>
                        <input 
                            type="range" 
                            class="form-range compress-range" 
                            min="0.1" 
                            max="1.0" 
                            step="0.05" 
                            v-model.number="imageQuality"
                            id="qualitySlider"
                        >
                        <div class="d-flex justify-content-between text-muted small mt-1">
                            <span>🔥 Ukuran Kecil</span>
                            <span>💎 Kualitas Tinggi</span>
                        </div>
                    </div>

                    <!-- Target Size -->
                    <div class="mb-4">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <label class="form-label fw-bold mb-0">Target Ukuran (opsional)</label>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" v-model="useTargetSize" id="useTargetSizeSwitch">
                                <label class="form-check-label small" for="useTargetSizeSwitch">Aktifkan</label>
                            </div>
                        </div>
                        <div v-if="useTargetSize" class="input-group animate-fade">
                            <input 
                                type="number" 
                                class="form-control" 
                                v-model.number="targetSizeKB"
                                min="50"
                                placeholder="Contoh: 500"
                                id="targetSizeInput"
                            >
                            <select class="form-select" style="max-width: 90px;" v-model="targetSizeUnit" id="targetSizeUnit">
                                <option value="KB">KB</option>
                                <option value="MB">MB</option>
                            </select>
                        </div>
                        <small v-if="useTargetSize" class="text-muted mt-1 d-block">
                            <i class="bi bi-info-circle me-1"></i>
                            Sistem akan mencoba iterasi otomatis untuk mendekati target. Ukuran asli: <strong>{{ formatFileSize(pdfFile.size) }}</strong>
                        </small>
                    </div>

                    <!-- Image Scale -->
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <label class="form-label fw-bold mb-0">Skala Resolusi Gambar</label>
                            <span class="badge bg-secondary px-3 py-2">{{ (imageScale * 100).toFixed(0) }}%</span>
                        </div>
                        <input 
                            type="range" 
                            class="form-range" 
                            min="0.3" 
                            max="1.0" 
                            step="0.05" 
                            v-model.number="imageScale"
                            id="scaleSlider"
                        >
                        <div class="d-flex justify-content-between text-muted small mt-1">
                            <span>30% (Sangat Kecil)</span>
                            <span>100% (Asli)</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>

        <!-- Page Selection -->
        <div class="col-lg-5">
            <div class="card shadow-sm border-0 h-100">
                <div class="card-header bg-white border-bottom-0 pt-4 px-4">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="fw-bold mb-0"><i class="bi bi-files me-2 text-primary"></i>Pilih Halaman</h5>
                        <div class="btn-group btn-group-sm">
                            <button 
                                class="btn" 
                                :class="pageMode === 'all' ? 'btn-primary' : 'btn-outline-secondary'"
                                @click="pageMode = 'all'"
                            >Semua</button>
                            <button 
                                class="btn" 
                                :class="pageMode === 'custom' ? 'btn-primary' : 'btn-outline-secondary'"
                                @click="pageMode = 'custom'"
                            >Pilih</button>
                        </div>
                    </div>
                </div>
                <div class="card-body px-4 pb-4">
                    
                    <!-- All Pages Info -->
                    <div v-if="pageMode === 'all'" class="text-center py-4">
                        <div class="bg-success bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 64px; height: 64px;">
                            <i class="bi bi-check-circle-fill text-success" style="font-size: 2rem;"></i>
                        </div>
                        <h6 class="fw-bold">Semua {{ totalPages }} halaman akan dikompresi</h6>
                        <p class="text-muted small">Seluruh halaman PDF akan diproses</p>
                    </div>

                    <!-- Custom Page Selection -->
                    <div v-else class="animate-fade">
                        <!-- Page Range Input -->
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Rentang Halaman</label>
                            <input 
                                type="text" 
                                class="form-control" 
                                v-model="pageRangeInput"
                                placeholder="Contoh: 1-3, 5, 8-10"
                                id="pageRangeInput"
                            >
                            <small class="text-muted">Gunakan format: 1-3, 5, 8-10</small>
                        </div>

                        <!-- Quick Select Buttons -->
                        <div class="d-flex flex-wrap gap-1 mb-3">
                            <button 
                                @click="selectAllPages" 
                                class="btn btn-outline-primary btn-sm"
                            >
                                <i class="bi bi-check-all me-1"></i> Pilih Semua
                            </button>
                            <button 
                                @click="deselectAllPages" 
                                class="btn btn-outline-secondary btn-sm"
                            >
                                <i class="bi bi-x-circle me-1"></i> Hapus Semua
                            </button>
                        </div>

                        <!-- Page Grid -->
                        <div class="compress-page-grid" style="max-height: 220px; overflow-y: auto; scrollbar-width: thin;">
                            <div 
                                v-for="p in totalPages" 
                                :key="p"
                                class="compress-page-chip"
                                :class="{ 'compress-page-chip-active': selectedPages.includes(p) }"
                                @click="togglePage(p)"
                                :title="'Halaman ' + p"
                            >
                                {{ p }}
                            </div>
                        </div>

                        <div class="mt-3 text-muted small text-center">
                            <strong class="text-primary">{{ selectedPages.length }}</strong> dari {{ totalPages }} halaman dipilih
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Action Bar -->
    <div v-if="pdfFile && totalPages > 0" class="card shadow-sm border-0 mb-4 animate-fade">
        <div class="card-body p-4">
            <div class="row align-items-center">
                <div class="col-md-8">
                    <!-- Progress Bar -->
                    <div v-if="isProcessing" class="mb-0">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="fw-bold text-dark small">{{ processStatus }}</span>
                            <span class="text-muted small">{{ processPercent }}%</span>
                        </div>
                        <div class="progress" style="height: 10px; border-radius: 8px;">
                            <div 
                                class="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
                                :style="'width: ' + processPercent + '%'"
                            ></div>
                        </div>
                    </div>
                    
                    <!-- Result Summary -->
                    <div v-else-if="compressResult" class="d-flex align-items-center gap-4">
                        <div class="d-flex align-items-center">
                            <div class="bg-success bg-opacity-10 rounded-3 p-2 me-2">
                                <i class="bi bi-check-circle-fill text-success fs-4"></i>
                            </div>
                            <div>
                                <div class="fw-bold text-success">Kompresi Selesai!</div>
                                <div class="text-muted small">
                                    {{ formatFileSize(pdfFile.size) }} → 
                                    <strong class="text-primary">{{ formatFileSize(compressResult.size) }}</strong>
                                    <span class="badge bg-success ms-2">-{{ compressionRatio }}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-else class="text-muted small">
                        <i class="bi bi-info-circle me-1"></i>
                        Klik "Compress Sekarang" untuk memulai proses kompresi.
                    </div>
                </div>
                <div class="col-md-4 text-end">
                    <!-- Compress Button -->
                    <button 
                        v-if="!compressResult"
                        @click="startCompress"
                        class="btn btn-primary btn-lg px-4"
                        :disabled="isProcessing || !canCompress"
                        id="btnCompress"
                    >
                        <span v-if="isProcessing" class="spinner-border spinner-border-sm me-2"></span>
                        <i v-else class="bi bi-lightning-charge-fill me-2"></i>
                        {{ isProcessing ? 'Memproses...' : 'Compress Sekarang' }}
                    </button>

                    <!-- Download Button -->
                    <div v-else class="d-flex gap-2 justify-content-end">
                        <button @click="downloadResult" class="btn btn-success btn-lg px-4" id="btnDownload">
                            <i class="bi bi-download me-2"></i> Download
                        </button>
                        <button @click="resetAll" class="btn btn-outline-secondary btn-lg" title="Proses file baru">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- PDF Preview -->
    <div v-if="compressResult" class="card shadow-sm border-0 mb-4 animate-fade">
        <div class="card-header bg-white border-bottom pt-3 px-4">
            <div class="d-flex justify-content-between align-items-center">
                <h5 class="fw-bold mb-0"><i class="bi bi-eye me-2 text-primary"></i>Preview Hasil</h5>
                <div class="d-flex gap-2 align-items-center">
                    <button @click="previewZoom = Math.max(0.5, previewZoom - 0.25)" class="btn btn-outline-secondary btn-sm">
                        <i class="bi bi-zoom-out"></i>
                    </button>
                    <span class="badge bg-secondary">{{ (previewZoom * 100).toFixed(0) }}%</span>
                    <button @click="previewZoom = Math.min(2, previewZoom + 0.25)" class="btn btn-outline-secondary btn-sm">
                        <i class="bi bi-zoom-in"></i>
                    </button>
                </div>
            </div>
        </div>
        <div class="card-body p-4 text-center" style="max-height: 600px; overflow: auto;">
            <canvas ref="previewCanvas" class="border rounded shadow-sm" :style="'transform: scale(' + previewZoom + '); transform-origin: top center;'"></canvas>
            <div class="mt-3 d-flex justify-content-center align-items-center gap-3">
                <button @click="previewPage = Math.max(1, previewPage - 1)" class="btn btn-outline-secondary btn-sm" :disabled="previewPage <= 1">
                    <i class="bi bi-chevron-left"></i>
                </button>
                <span class="fw-bold">Hal. {{ previewPage }} / {{ previewTotalPages }}</span>
                <button @click="previewPage = Math.min(previewTotalPages, previewPage + 1)" class="btn btn-outline-secondary btn-sm" :disabled="previewPage >= previewTotalPages">
                    <i class="bi bi-chevron-right"></i>
                </button>
            </div>
        </div>
    </div>

</div>

<!-- Custom Styles for this component -->
<style id="compress-pdf-styles">
    .compress-dropzone {
        border: 3px dashed #dee2e6;
        border-radius: 12px;
        background: linear-gradient(135deg, #fafbfc 0%, #f0f2f5 100%);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .compress-dropzone:hover {
        border-color: var(--primary-color);
        background: linear-gradient(135deg, #fff5f5 0%, #ffe8ec 100%);
        transform: translateY(-2px);
    }
    .compress-dropzone-active {
        border-color: var(--primary-color) !important;
        background: linear-gradient(135deg, #ffe0e6 0%, #ffd4dc 100%) !important;
        transform: scale(1.01);
    }
    .compress-dropzone-has-file {
        border-style: solid;
        border-color: #e9ecef;
        background: white;
        padding: 1rem !important;
    }
    .compress-dropzone-has-file:hover {
        border-color: #ced4da;
        background: #fafbfc;
        transform: none;
    }
    .compress-range::-webkit-slider-thumb {
        background: var(--primary-color);
    }
    .compress-range::-webkit-slider-runnable-track {
        background: linear-gradient(90deg, var(--primary-color), #28a745);
    }
    .compress-page-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
        gap: 6px;
    }
    .compress-page-chip {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        aspect-ratio: 1;
        border-radius: 8px;
        border: 2px solid #e9ecef;
        font-weight: 600;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
        color: #6c757d;
        background: white;
    }
    .compress-page-chip:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
        transform: scale(1.05);
    }
    .compress-page-chip-active {
        background: var(--primary-color) !important;
        border-color: var(--primary-color) !important;
        color: white !important;
        box-shadow: 0 2px 8px rgba(217, 4, 41, 0.35);
    }
    .animate-fade {
        animation: compressFadeIn 0.4s ease;
    }
    @keyframes compressFadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
</style>
`;
