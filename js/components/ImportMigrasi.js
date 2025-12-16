import { ref } from 'vue';
import { db, collection, doc, writeBatch, serverTimestamp, Timestamp, getDocs } from '../firebase.js';
import { showToast, showConfirm } from '../utils.js';

export default {
    template: `
    <div class="p-4">
        <h3 class="fw-bold text-danger mb-4"><i class="bi bi-tools me-2"></i>Maintenance & Migrasi Data</h3>
        
        <div class="row g-4">
            <div class="col-md-6">
                <div class="card shadow-sm border-danger h-100">
                    <div class="card-header bg-danger text-white">
                        <h6 class="mb-0 fw-bold">1. Import Data CSV/Excel</h6>
                    </div>
                    <div class="card-body">
                        <div class="alert alert-warning small">
                            Import data legacy dengan auto-parsing tanggal & created_at mundur 2 bulan.
                        </div>
                        <div class="mb-3">
                            <input type="file" ref="fileInput" class="form-control" accept=".csv, .xlsx, .xls">
                        </div>
                        <button class="btn btn-danger w-100" @click="prosesMigrasi" :disabled="isProcessing">
                            {{ isProcessing ? 'Sedang Memproses Import...' : 'Mulai Import' }}
                        </button>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="card shadow-sm border-primary h-100">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0 fw-bold">2. Fix Data Massal</h6>
                    </div>
                    <div class="card-body">
                        <div class="alert alert-info small">
                            Update field <code>created_by</code> untuk <b>SEMUA</b> data yang ada di database menjadi UID Admin tertentu.
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Target UID</label>
                            <input type="text" class="form-control font-monospace" value="ZUubJwBBmrhphhwLgmpVgh6ubIE2" readonly>
                        </div>
                        <button class="btn btn-primary w-100" @click="updateAllCreatedBy" :disabled="isProcessing">
                            <i class="bi bi-person-check-fill me-2"></i> Update Owner ke UID Ini
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="logs.length > 0" class="mt-4">
            <h6 class="fw-bold">Log Proses:</h6>
            <div class="progress mb-2" style="height: 20px;" v-if="totalRows > 0">
                <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                        role="progressbar" 
                        :style="{ width: (processedRows/totalRows)*100 + '%' }">
                </div>
            </div>
            <div class="p-3 bg-dark text-white rounded border font-monospace" style="max-height: 300px; overflow-y: auto; font-size: 0.8rem;">
                <div v-for="(log, i) in logs" :key="i" :class="log.type === 'error' ? 'text-danger' : 'text-success'">
                    <span class="text-muted me-2">[{{ new Date().toLocaleTimeString() }}]</span> {{ log.msg }}
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        const isProcessing = ref(false);
        const fileInput = ref(null);
        const logs = ref([]);
        const totalRows = ref(0);
        const processedRows = ref(0);

        const addLog = (msg, type = 'info') => { logs.value.unshift({ msg, type }); };

        // --- HELPER IMPORT (SAMA SEPERTI SEBELUMNYA) ---
        const parseIndoToDateObj = (str) => {
            if (!str || typeof str !== 'string') return null;
            const months = {'Januari':0,'Februari':1,'Maret':2,'April':3,'Mei':4,'Juni':5,'Juli':6,'Agustus':7,'September':8,'Oktober':9,'November':10,'Desember':11,'Jan':0,'Feb':1,'Mar':2,'Apr':3,'Jun':5,'Jul':6,'Aug':7,'Sep':8,'Oct':9,'Nov':10,'Dec':11};
            const parts = str.trim().split(' '); 
            if (parts.length < 3) return null;
            const day = parseInt(parts[0]); const month = months[parts[1]]!==undefined?months[parts[1]]:0; const year = parseInt(parts[2]);
            if(isNaN(year)) return null;
            return new Date(year, month, day);
        };
        const toIsoString = (d) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';
        const parseMK = (str) => {
            if (!str) return { thn: 0, bln: 0 };
            const s = String(str);
            const t = s.match(/(\d+)\s*Tahun/i); const b = s.match(/(\d+)\s*Bulan/i);
            return { thn: t?parseInt(t[1]):0, bln: b?parseInt(b[1]):0 };
        };

        // --- 1. PROSES IMPORT (SAMA SEPERTI SEBELUMNYA) ---
        const prosesMigrasi = async () => {
            const file = fileInput.value.files[0];
            if (!file) return showToast("Pilih file dulu!", 'warning');
            if (!await showConfirm('Mulai Import?', 'Data akan ditambahkan ke database.')) return;

            isProcessing.value = true; logs.value = []; processedRows.value = 0;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const XLSX = window.XLSX;
                    const data = new Uint8Array(e.target.result);
                    const wb = XLSX.read(data, { type: 'array' });
                    const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

                    totalRows.value = json.length;
                    addLog(`Mulai import ${json.length} baris data...`);

                    const CHUNK = 300; 
                    for (let i = 0; i < json.length; i += CHUNK) {
                        const batch = writeBatch(db);
                        const chunk = json.slice(i, i + CHUNK);
                        let count = 0;

                        chunk.forEach((row) => {
                            const nipRaw = String(row['nip']||'').replace(/['"\s]/g, '');
                            if (!nipRaw) return;

                            const tmtObj = parseIndoToDateObj(row['tmt_sekarang']);
                            let createdAtTimestamp = serverTimestamp();
                            if (tmtObj) {
                                const cd = new Date(tmtObj);
                                cd.setMonth(cd.getMonth() - 2);
                                createdAtTimestamp = Timestamp.fromDate(cd);
                            }

                            const mkLama = parseMK(row['dasar_mk_lama']);
                            const mkBaru = parseMK(row['mk_baru']);
                            const tipeAsn = (row['golongan']||'').includes('/') ? 'PNS' : 'PPPK';

                            const docData = {
                                nip: nipRaw, nama: row['nama']||'', nama_snapshot: row['nama']||'',
                                tempat_lahir: row['tempatLahir']||'', tgl_lahir: toIsoString(parseIndoToDateObj(row['tglLahir'])),
                                tipe_asn: tipeAsn, perangkat_daerah: row['unit_kerja_induk']||'', unit_kerja: row['unit_kerja']||'',
                                jabatan: row['jabatan']||'', jabatan_snapshot: row['jabatan']||'', pangkat: row['pangkat']||'',
                                dasar_hukum: row['dasar']||'', dasar_nomor: row['dasar_nomor']||'',
                                dasar_tanggal: toIsoString(parseIndoToDateObj(row['dasar_tanggal'])),
                                dasar_pejabat: row['dasar_pejabat']||'', dasar_tmt: toIsoString(parseIndoToDateObj(row['dasar_tmt'])),
                                dasar_golongan: row['golongan']||'', dasar_mk_tahun: mkLama.thn, dasar_mk_bulan: mkLama.bln,
                                dasar_gaji_lama: Number(row['dasar_gaji_lama']||0),
                                golongan: row['golongan']||'', mk_baru_tahun: mkBaru.thn, mk_baru_bulan: mkBaru.bln,
                                gaji_baru: Number(row['gaji_baru']||0),
                                tmt_sekarang: toIsoString(tmtObj), tmt_selanjutnya: toIsoString(parseIndoToDateObj(row['tmt_selanjutnya'])),
                                tahun_pembuatan: Number(row['tahun_pembuatan']||new Date().getFullYear()),
                                created_by: 'MIGRASI_LEGACY', status: 'ARCHIVED',
                                created_at: createdAtTimestamp, updated_at: serverTimestamp()
                            };
                            batch.set(doc(collection(db, "usulan_kgb")), docData);
                            count++;
                        });

                        if (count > 0) {
                            await batch.commit();
                            processedRows.value += chunk.length;
                            addLog(`Batch tersimpan (${count} data)`);
                        }
                    }
                    addLog("Import Selesai!", 'success');
                    showToast("Import Selesai!", 'success');
                } catch (e) { addLog("Error: " + e.message, 'error'); } 
                finally { isProcessing.value = false; fileInput.value.value = ''; }
            };
            reader.readAsArrayBuffer(file);
        };

        // --- 2. FITUR BARU: UPDATE CREATED_BY MASSAL ---
        const updateAllCreatedBy = async () => {
            const TARGET_UID = "ZUubJwBBmrhphhwLgmpVgh6ubIE2";

            if (!await showConfirm('Update Owner?', `Semua data usulan_kgb akan menjadi milik UID: ${TARGET_UID}`)) return;

            isProcessing.value = true;
            logs.value = [];
            processedRows.value = 0;

            try {
                addLog("Mengambil semua data usulan (ini mungkin memakan waktu)...");
                // Ambil semua dokumen (Hati-hati jika data > 10.000, sebaiknya pakai cursor)
                // Untuk 3000-5000 masih aman di load client
                const snapshot = await getDocs(collection(db, "usulan_kgb"));
                
                totalRows.value = snapshot.size;
                addLog(`Ditemukan ${snapshot.size} dokumen. Mulai update batch...`);

                const docs = snapshot.docs;
                const CHUNK = 400; // Limit batch write 500

                for (let i = 0; i < docs.length; i += CHUNK) {
                    const batch = writeBatch(db);
                    const chunk = docs.slice(i, i + CHUNK);
                    
                    chunk.forEach(docSnap => {
                        const ref = doc(db, "usulan_kgb", docSnap.id);
                        batch.update(ref, { 
                            created_by: TARGET_UID,
                            // Opsional: update email jika perlu
                            // created_by_email: 'email.baru@...' 
                        });
                    });

                    await batch.commit();
                    processedRows.value += chunk.length;
                    addLog(`Batch update sukses: ${processedRows.value}/${totalRows.value}`);
                }

                addLog("SUKSES! Semua data telah diupdate ke UID baru.", 'success');
                showToast("Update Owner Selesai!", 'success');

            } catch (e) {
                console.error(e);
                addLog("Error Update: " + e.message, 'error');
            } finally {
                isProcessing.value = false;
            }
        };

        return { 
            isProcessing, fileInput, logs, totalRows, processedRows, 
            prosesMigrasi, updateAllCreatedBy 
        };
    }
};