// excel-worker.js
// Membuat file XLSX di Web Worker agar halaman utama tidak freeze/crash.
// File ini berada di js/excel-worker.js; XLSX diambil dari vendor lokal.
// importScripts path relatif terhadap URL worker: js/ -> ../assets/vendor/
importScripts('../assets/vendor/xlsx.full.min.js');

self.onmessage = (e) => {
    try {
        const { aoa, sheetName } = e.data;
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = (aoa[0] || []).map(h => ({ wch: Math.max(String(h).length + 2, 20) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');
        const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        self.postMessage({ ok: true, buffer: out }, [out.buffer]);
    } catch (err) {
        self.postMessage({ ok: false, error: err.message || String(err) });
    }
};
