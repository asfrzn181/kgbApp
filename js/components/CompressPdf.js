/**
 * CompressPdf.js
 * ──────────────────────────────────────────────
 * Fitur Compress PDF — 100% Client-Side
 * 
 * Menggunakan:
 *  - pdf-lib (CDN) untuk manipulasi PDF
 *  - pdfjs-dist (CDN) untuk rendering preview
 *  - Canvas API untuk rekompresi gambar (JPEG quality)
 * 
 * Fitur:
 *  - Drag & drop upload
 *  - Atur kualitas kompresi (0.1 — 1.0)
 *  - Target ukuran file (iterasi otomatis)
 *  - Pilih halaman tertentu
 *  - Preview hasil kompresi
 *  - Download langsung (tidak menyimpan ke server/database)
 * ──────────────────────────────────────────────
 */

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { TplCompressPdf } from '../views/CompressPdfView.js';

// CDN URLs
const PDF_LIB_CDN = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDFJS_WORKER_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

/**
 * Memuat script CDN secara dinamis (hanya sekali)
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Gagal memuat: ${src}`));
        document.head.appendChild(s);
    });
}

export default {
    template: TplCompressPdf,
    setup() {
        // ─── STATE ──────────────────────────────────────
        const pdfFile = ref(null);
        const pdfBytes = ref(null);
        const totalPages = ref(0);
        const isDragging = ref(false);
        const fileInput = ref(null);

        // Compression settings
        const imageQuality = ref(0.5);
        const imageScale = ref(0.75);
        const useTargetSize = ref(false);
        const targetSizeKB = ref(500);
        const targetSizeUnit = ref('KB');

        // Page selection
        const pageMode = ref('all');
        const selectedPages = ref([]);
        const pageRangeInput = ref('');

        // Processing
        const isProcessing = ref(false);
        const processStatus = ref('');
        const processPercent = ref(0);
        const compressResult = ref(null);
        const compressResultBytes = ref(null);

        // Preview
        const previewCanvas = ref(null);
        const previewPage = ref(1);
        const previewTotalPages = ref(0);
        const previewZoom = ref(1);

        // Libraries loaded flag
        const libsLoaded = ref(false);

        // ─── COMPUTED ───────────────────────────────────

        const qualityLabel = computed(() => {
            const q = imageQuality.value;
            if (q <= 0.2) return 'Ekstrem';
            if (q <= 0.4) return 'Rendah';
            if (q <= 0.6) return 'Sedang';
            if (q <= 0.8) return 'Tinggi';
            return 'Maksimal';
        });

        const qualityBadgeClass = computed(() => {
            const q = imageQuality.value;
            if (q <= 0.3) return 'bg-danger';
            if (q <= 0.6) return 'bg-warning text-dark';
            return 'bg-success';
        });

        const canCompress = computed(() => {
            if (!pdfFile.value) return false;
            if (pageMode.value === 'custom' && selectedPages.value.length === 0) return false;
            return true;
        });

        const compressionRatio = computed(() => {
            if (!pdfFile.value || !compressResult.value) return 0;
            const original = pdfFile.value.size;
            const compressed = compressResult.value.size;
            return Math.max(0, ((1 - compressed / original) * 100)).toFixed(1);
        });

        // ─── FILE HANDLING ──────────────────────────────

        const triggerFileInput = () => {
            if (!pdfFile.value) {
                fileInput.value?.click();
            }
        };

        const handleFileSelect = async (e) => {
            const file = e.target.files[0];
            if (file) await loadPdfFile(file);
        };

        const handleDrop = async (e) => {
            isDragging.value = false;
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                await loadPdfFile(file);
            } else {
                Swal.fire('Format Salah', 'Hanya file PDF yang didukung.', 'warning');
            }
        };

        const loadPdfFile = async (file) => {
            if (file.size > 200 * 1024 * 1024) {
                Swal.fire('File Terlalu Besar', 'Maksimal ukuran file adalah 200 MB.', 'warning');
                return;
            }

            try {
                // Ensure libraries are loaded
                await loadLibraries();

                pdfFile.value = file;
                compressResult.value = null;
                compressResultBytes.value = null;

                const arrayBuffer = await file.arrayBuffer();
                pdfBytes.value = new Uint8Array(arrayBuffer);

                // Get page count using pdf-lib
                const { PDFDocument } = window.PDFLib;
                const pdfDoc = await PDFDocument.load(pdfBytes.value, { ignoreEncryption: true });
                totalPages.value = pdfDoc.getPageCount();

                // Select all pages by default
                selectedPages.value = Array.from({ length: totalPages.value }, (_, i) => i + 1);
                pageRangeInput.value = `1-${totalPages.value}`;

            } catch (err) {
                console.error('Error loading PDF:', err);
                Swal.fire('Error', 'Gagal memuat PDF: ' + err.message, 'error');
                resetAll();
            }
        };

        // ─── LIBRARIES ─────────────────────────────────

        const loadLibraries = async () => {
            if (libsLoaded.value) return;

            processStatus.value = 'Memuat library...';
            await loadScript(PDF_LIB_CDN);
            await loadScript(PDFJS_CDN);

            // Set worker
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
            libsLoaded.value = true;
        };

        // ─── PAGE SELECTION ─────────────────────────────

        const togglePage = (page) => {
            const idx = selectedPages.value.indexOf(page);
            if (idx === -1) {
                selectedPages.value.push(page);
            } else {
                selectedPages.value.splice(idx, 1);
            }
            selectedPages.value.sort((a, b) => a - b);
            updatePageRangeFromSelection();
        };

        const selectAllPages = () => {
            selectedPages.value = Array.from({ length: totalPages.value }, (_, i) => i + 1);
            updatePageRangeFromSelection();
        };

        const deselectAllPages = () => {
            selectedPages.value = [];
            pageRangeInput.value = '';
        };

        const updatePageRangeFromSelection = () => {
            const pages = [...selectedPages.value].sort((a, b) => a - b);
            if (pages.length === 0) { pageRangeInput.value = ''; return; }
            
            const ranges = [];
            let start = pages[0], end = pages[0];

            for (let i = 1; i < pages.length; i++) {
                if (pages[i] === end + 1) {
                    end = pages[i];
                } else {
                    ranges.push(start === end ? `${start}` : `${start}-${end}`);
                    start = pages[i];
                    end = pages[i];
                }
            }
            ranges.push(start === end ? `${start}` : `${start}-${end}`);
            pageRangeInput.value = ranges.join(', ');
        };

        // Parse page range input → selectedPages
        const parsePageRange = (input) => {
            const pages = new Set();
            const parts = input.split(',');
            for (const part of parts) {
                const trimmed = part.trim();
                if (!trimmed) continue;
                if (trimmed.includes('-')) {
                    const [a, b] = trimmed.split('-').map(Number);
                    if (!isNaN(a) && !isNaN(b)) {
                        for (let i = Math.max(1, a); i <= Math.min(totalPages.value, b); i++) {
                            pages.add(i);
                        }
                    }
                } else {
                    const n = parseInt(trimmed);
                    if (!isNaN(n) && n >= 1 && n <= totalPages.value) {
                        pages.add(n);
                    }
                }
            }
            return Array.from(pages).sort((a, b) => a - b);
        };

        // Watch page range input changes
        let pageRangeDebounce = null;
        watch(pageRangeInput, (val) => {
            clearTimeout(pageRangeDebounce);
            pageRangeDebounce = setTimeout(() => {
                const parsed = parsePageRange(val);
                selectedPages.value = parsed;
            }, 400);
        });

        // ─── COMPRESSION ENGINE ─────────────────────────

        /**
         * Inti kompresi: Render setiap halaman ke Canvas, lalu re-embed sebagai JPEG
         * ke dalam PDF baru. Ini efektif menghilangkan font embedding, mengurangi
         * resolusi gambar, dan mengontrol kualitas JPEG.
         */
        const compressPdf = async (quality, scale) => {
            const { PDFDocument } = window.PDFLib;
            const pdfjsLib = window.pdfjsLib;

            // Determine which pages to process
            const pagesToProcess = pageMode.value === 'all'
                ? Array.from({ length: totalPages.value }, (_, i) => i + 1)
                : [...selectedPages.value].sort((a, b) => a - b);

            if (pagesToProcess.length === 0) {
                throw new Error('Tidak ada halaman yang dipilih.');
            }

            // Load source PDF with pdf.js for rendering
            const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.value.slice() });
            const pdfJsDoc = await loadingTask.promise;

            // Create new PDF document
            const newPdf = await PDFDocument.create();

            // Canvas for rendering
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            for (let i = 0; i < pagesToProcess.length; i++) {
                const pageNum = pagesToProcess[i];
                processStatus.value = `Mengompresi halaman ${pageNum} (${i + 1}/${pagesToProcess.length})...`;
                processPercent.value = Math.round(((i + 1) / pagesToProcess.length) * 90);

                // Render page to canvas using pdf.js
                const page = await pdfJsDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: scale });

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // White background
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                await page.render({ canvasContext: ctx, viewport }).promise;

                // Convert canvas to JPEG bytes
                const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
                const jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(',')[1]), c => c.charCodeAt(0));

                // Embed JPEG into the new PDF
                const jpegImage = await newPdf.embedJpg(jpegBytes);

                // Get original page dimensions to maintain aspect ratio
                const origViewport = page.getViewport({ scale: 1.0 });
                const newPage = newPdf.addPage([origViewport.width, origViewport.height]);

                newPage.drawImage(jpegImage, {
                    x: 0,
                    y: 0,
                    width: origViewport.width,
                    height: origViewport.height,
                });

                // Yield to UI thread
                await new Promise(r => setTimeout(r, 10));
            }

            processStatus.value = 'Menyimpan PDF...';
            processPercent.value = 95;

            const resultBytes = await newPdf.save();
            return resultBytes;
        };

        // ─── START COMPRESSION ──────────────────────────

        const startCompress = async () => {
            if (!canCompress.value) return;

            isProcessing.value = true;
            processPercent.value = 0;
            processStatus.value = 'Memulai kompresi...';
            compressResult.value = null;
            compressResultBytes.value = null;

            try {
                await loadLibraries();

                let resultBytes;

                if (useTargetSize.value && targetSizeKB.value > 0) {
                    // ── Iterative compression to reach target size ──
                    const targetBytes = targetSizeUnit.value === 'MB' 
                        ? targetSizeKB.value * 1024 * 1024 
                        : targetSizeKB.value * 1024;

                    let bestResult = null;
                    let currentQuality = imageQuality.value;
                    let currentScale = imageScale.value;
                    const MAX_ITERATIONS = 5;

                    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
                        processStatus.value = `Iterasi ${iter + 1}/${MAX_ITERATIONS} (quality: ${(currentQuality * 100).toFixed(0)}%, scale: ${(currentScale * 100).toFixed(0)}%)...`;

                        const bytes = await compressPdf(currentQuality, currentScale);
                        bestResult = bytes;

                        if (bytes.length <= targetBytes) {
                            // Target reached!
                            break;
                        }

                        // Adjust parameters for next iteration
                        const ratio = targetBytes / bytes.length;
                        if (ratio < 0.5) {
                            currentQuality = Math.max(0.05, currentQuality * 0.5);
                            currentScale = Math.max(0.25, currentScale * 0.7);
                        } else {
                            currentQuality = Math.max(0.05, currentQuality * ratio * 0.9);
                            currentScale = Math.max(0.25, currentScale * 0.9);
                        }
                    }

                    resultBytes = bestResult;
                } else {
                    // ── Single-pass compression ──
                    resultBytes = await compressPdf(imageQuality.value, imageScale.value);
                }

                processPercent.value = 100;
                processStatus.value = 'Selesai!';

                // Store result
                compressResultBytes.value = resultBytes;
                const blob = new Blob([resultBytes], { type: 'application/pdf' });
                compressResult.value = {
                    blob,
                    size: resultBytes.length,
                    name: pdfFile.value.name.replace('.pdf', '_compressed.pdf')
                };

                // Show preview
                await nextTick();
                await renderPreview(1);

                // Success notification
                Swal.fire({
                    icon: 'success',
                    title: 'Kompresi Berhasil!',
                    html: `
                        <div class="text-start">
                            <p><strong>Ukuran Asli:</strong> ${formatFileSize(pdfFile.value.size)}</p>
                            <p><strong>Ukuran Baru:</strong> ${formatFileSize(resultBytes.length)}</p>
                            <p><strong>Pengurangan:</strong> <span class="text-success fw-bold">${compressionRatio.value}%</span></p>
                        </div>
                    `,
                    confirmButtonColor: '#d90429',
                    confirmButtonText: 'Download Sekarang',
                    showCancelButton: true,
                    cancelButtonText: 'Nanti Saja'
                }).then((result) => {
                    if (result.isConfirmed) {
                        downloadResult();
                    }
                });

            } catch (err) {
                console.error('Compression error:', err);
                Swal.fire('Error', 'Gagal mengompresi PDF: ' + err.message, 'error');
            } finally {
                isProcessing.value = false;
            }
        };

        // ─── PREVIEW ────────────────────────────────────

        const renderPreview = async (pageNum) => {
            if (!compressResultBytes.value || !previewCanvas.value) return;

            try {
                const pdfjsLib = window.pdfjsLib;
                const loadingTask = pdfjsLib.getDocument({ data: compressResultBytes.value.slice() });
                const pdfDoc = await loadingTask.promise;
                previewTotalPages.value = pdfDoc.numPages;

                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 });

                const canvas = previewCanvas.value;
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                await page.render({ canvasContext: ctx, viewport }).promise;
            } catch (err) {
                console.error('Preview error:', err);
            }
        };

        // Watch preview page changes
        watch(previewPage, async (newPage) => {
            await renderPreview(newPage);
        });

        // ─── DOWNLOAD ───────────────────────────────────

        const downloadResult = () => {
            if (!compressResult.value) return;
            const url = URL.createObjectURL(compressResult.value.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = compressResult.value.name;
            a.click();
            URL.revokeObjectURL(url);
        };

        // ─── RESET ──────────────────────────────────────

        const resetAll = () => {
            pdfFile.value = null;
            pdfBytes.value = null;
            totalPages.value = 0;
            selectedPages.value = [];
            pageRangeInput.value = '';
            pageMode.value = 'all';
            compressResult.value = null;
            compressResultBytes.value = null;
            isProcessing.value = false;
            processStatus.value = '';
            processPercent.value = 0;
            previewPage.value = 1;
            previewTotalPages.value = 0;
            previewZoom.value = 1;

            // Reset file input
            if (fileInput.value) {
                fileInput.value.value = '';
            }
        };

        // ─── UTILITIES ──────────────────────────────────

        const formatFileSize = (bytes) => {
            if (!bytes) return '0 B';
            const units = ['B', 'KB', 'MB', 'GB'];
            let i = 0;
            let size = bytes;
            while (size >= 1024 && i < units.length - 1) {
                size /= 1024;
                i++;
            }
            return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
        };

        // ─── LIFECYCLE ──────────────────────────────────

        onMounted(() => {
            // Inject styles if not present
            if (!document.getElementById('compress-pdf-styles')) {
                const styleTag = document.querySelector('style#compress-pdf-styles') 
                    || document.querySelector('#compress-pdf-styles');
                // Styles are embedded in the template, they get rendered automatically
            }
        });

        // ─── EXPOSE ─────────────────────────────────────

        return {
            // State
            pdfFile, totalPages, isDragging, fileInput,
            imageQuality, imageScale,
            useTargetSize, targetSizeKB, targetSizeUnit,
            pageMode, selectedPages, pageRangeInput,
            isProcessing, processStatus, processPercent,
            compressResult,
            previewCanvas, previewPage, previewTotalPages, previewZoom,

            // Computed
            qualityLabel, qualityBadgeClass, canCompress, compressionRatio,

            // Methods
            triggerFileInput, handleFileSelect, handleDrop,
            togglePage, selectAllPages, deselectAllPages,
            startCompress, downloadResult, resetAll,
            formatFileSize,
        };
    }
};
