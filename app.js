/**
 * ====================================================================
 * File: app.js
 * Versi: 5.0 (No-API-Change, Pagination Fix, Resource Query)
 * ====================================================================
 */

document.addEventListener("DOMContentLoaded", () => {

    // --- 1. VARIABEL GLOBAL (STATE) ---
    let API_URL = "";
    let API_TOKEN = "";
    
    // Data Utama
    let allPegawaiData = [];
    let filteredPegawaiData = []; // ✅ PENTING: Menyimpan hasil filter untuk pagination
    
    // Data Master
    let masterPangkatPNS = {};
    let masterPangkatPPPK = {};
    let masterGaji = [];
    let masterSuratConfig = {};
    
    // Pagination Config
    let currentPage = 1;
    const itemsPerPage = 10; // Ubah jumlah baris per halaman di sini
    const templateCache = {};

    // --- 2. ELEMEN DOM ---
    const loginSection = document.getElementById('loginSection');
    const mainAppSection = document.getElementById('mainAppSection');
    const loginForm = document.getElementById('loginForm');
    const inputApiUrl = document.getElementById('inputApiUrl');
    const inputApiToken = document.getElementById('inputApiToken');
    const btnLogout = document.getElementById('btnLogout');

    const tableBody = document.getElementById('tableBody');
    const statusLabel = document.getElementById('statusLabel');
    const paginationNav = document.getElementById('paginationNav');
    const searchBox = document.getElementById('searchBox');
    
    const btnRefresh = document.getElementById('btnRefresh');
    const btnTambah = document.getElementById('btnTambah');
    
    const formModalEl = document.getElementById('formDialog');
    const formModal = new bootstrap.Modal(formModalEl);
    const form = document.getElementById('pegawaiForm');
    const formTitle = document.getElementById('formTitle');
    const btnSimpan = document.getElementById('btnSimpan');
    
    // Field Form Mapping
    const formFields = {
        id: document.getElementById("formPegawaiId"),
        tahunPembuatan: document.getElementById("formTahunPembuatan"),
        nip: document.getElementById("formNip"),
        nama: document.getElementById("formNama"),
        tempatLahir: document.getElementById("formTempatLahir"),
        tglLahir: document.getElementById("formTglLahir"),
        status: document.getElementById("formStatus"),
        kodeGolongan: document.getElementById("formKodeGolongan"),
        pangkat: document.getElementById("formPangkat"),
        golongan: document.getElementById("formGolongan"),
        jabatan: document.getElementById("formJabatan"),
        unitKerja: document.getElementById("formUnitKerja"),
        unitKerjaInduk: document.getElementById("formUnitKerjaInduk"),
        dasar: document.getElementById("formDasar"),
        dasarPejabat: document.getElementById("formDasarPejabat"),
        dasarTanggal: document.getElementById("formDasarTanggal"),
        dasarNomor: document.getElementById("formDasarNomor"),
        dasarTmt: document.getElementById("formDasarTmt"),
        dasarMkTahun: document.getElementById("formDasarMkTahun"),
        dasarMkBulan: document.getElementById("formDasarMkBulan"),
        dasarGajiLama: document.getElementById("formDasarGajiLama"),
        mkBaruTahun: document.getElementById("formMkBaruTahun"),
        mkBaruBulan: document.getElementById("formMkBaruBulan"),
        gajiBaru: document.getElementById("formGajiBaru"),
        tmtSekarang: document.getElementById("formTmtSekarang"),
        tmtSelanjutnya: document.getElementById("formTmtSelanjutnya")
    };
    
    let m_currentPangkatMap = new Map();
    const BULAN_CETAK_MAP = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];


    // --- 3. FUNGSI UTAMA (INIT) ---

    async function init() {
        const config = getStoredConfig();
        if (config) {
            API_URL = config.apiUrl;
            API_TOKEN = config.apiToken;
            showMainApp();
        } else {
            showLoginScreen();
        }

        // Load file JSON lokal dulu (Pangkat & Surat)
        await loadLocalJSON();
        attachListeners();
    }

    function getStoredConfig() {
        const data = localStorage.getItem('kgbAppConfig');
        return data ? JSON.parse(data) : null;
    }


    // --- 4. AUTHENTICATION UI ---

    function showLoginScreen() {
        loginSection.classList.remove('d-none');
        mainAppSection.classList.add('d-none');
        inputApiUrl.value = "";
        inputApiToken.value = "";
    }

    async function showMainApp() {
        loginSection.classList.add('d-none');
        mainAppSection.classList.remove('d-none');
        
        // Load Data dari API saat masuk
        await loadMasterGajiFromAPI(); // ✅ Load Gaji dari API
        await loadData(); // ✅ Load Pegawai dari API
    }

    function handleLogout() {
        if (confirm("Keluar dari aplikasi?")) {
            localStorage.removeItem('kgbAppConfig');
            API_URL = "";
            API_TOKEN = "";
            tableBody.innerHTML = "";
            showLoginScreen();
        }
    }

    async function handleLoginSubmit(e) {
        e.preventDefault();
        const url = inputApiUrl.value.trim();
        const token = inputApiToken.value.trim();

        if (!url || !token) { alert("URL dan Token wajib diisi!"); return; }

        const submitBtn = loginForm.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.textContent = "Memverifikasi...";

        try {
            // Tes koneksi sederhana (Default resource = pegawai)
            const testUrl = `${url}?token=${encodeURIComponent(token)}`;
            const response = await fetch(testUrl);
            const result = await response.json();

            if (result.status === 200) {
                localStorage.setItem('kgbAppConfig', JSON.stringify({ apiUrl: url, apiToken: token }));
                API_URL = url;
                API_TOKEN = token;
                showMainApp();
            } else {
                throw new Error(result.message || "Gagal terhubung.");
            }
        } catch (error) {
            alert(`Login Gagal: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Masuk";
        }
    }


    // --- 5. DATA LOADING (API & JSON) ---

    async function loadLocalJSON() {
        try {
            const [pangkatRes, suratRes] = await Promise.all([
                fetch("json/master_pangkat.json"),
                fetch("json/master_surat.json")
            ]);
            if (pangkatRes.ok) {
                const data = await pangkatRes.json();
                masterPangkatPNS = data.PNS;
                masterPangkatPPPK = data.PPPK;
            }
            if (suratRes.ok) masterSuratConfig = await suratRes.json();
        } catch (e) {
            console.warn("Gagal load JSON lokal:", e);
        }
    }

    async function loadMasterGajiFromAPI() {
        if (!API_URL || !API_TOKEN) return;
        
        try {
            // ✅ SESUAIKAN DENGAN API ANDA: resource=master_gaji
            const url = `${API_URL}?token=${encodeURIComponent(API_TOKEN)}&resource=master_gaji`;
            
            const response = await fetch(url);
            const result = await response.json();

            if (result.status === 200) {
                masterGaji = result.data;
                console.log("Master Gaji dimuat:", masterGaji.length, "data");
            } else {
                console.error("Gagal Master Gaji:", result.message);
            }
        } catch (e) {
            console.error("Error fetch Master Gaji:", e);
            // Fallback ke lokal jika API gagal
            try {
                const res = await fetch("json/master_gaji.json");
                const json = await res.json();
                masterGaji = json.data;
            } catch(err) { console.warn("Fallback Gaji gagal"); }
        }
    }

    async function loadData() {
        statusLabel.textContent = "Mengambil data pegawai...";
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Memuat data...</td></tr>';
        paginationNav.innerHTML = ""; 

        try {
            // Request data pegawai standar
            const url = `${API_URL}?token=${encodeURIComponent(API_TOKEN)}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.status !== 200) throw new Error(result.message);

            allPegawaiData = result.data;
            filteredPegawaiData = allPegawaiData; // Init filtered data
            
            currentPage = 1; 
            render(); 
            
            statusLabel.textContent = `Total: ${allPegawaiData.length} Pegawai.`;
        } catch (e) {
            statusLabel.textContent = `Error: ${e.message}`;
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${e.message}</td></tr>`;
        }
    }


    // --- 6. RENDER & PAGINATION (FIXED) ---

    function render() {
        const query = searchBox.value.toLowerCase();

        // 1. Filter Data Utama -> Simpan ke filteredPegawaiData
        if (query) {
            filteredPegawaiData = allPegawaiData.filter(p =>
                Object.values(p).some(val => String(val).toLowerCase().includes(query))
            );
        } else {
            filteredPegawaiData = allPegawaiData;
        }

        // 2. Hitung Pagination berdasarkan filteredPegawaiData
        const totalItems = filteredPegawaiData.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        // Validasi halaman saat ini agar tidak out of bounds setelah search
        if (currentPage > totalPages) currentPage = 1;
        if (currentPage < 1) currentPage = 1;

        // 3. Slice Data untuk Halaman Ini
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pagedData = filteredPegawaiData.slice(start, end);

        renderTable(pagedData);
        renderPagination(totalPages, currentPage);
    }

    function renderTable(data) {
        tableBody.innerHTML = "";
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada data.</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();
        data.forEach(pegawai => {
            const tr = document.createElement("tr");
            tr.dataset.pegawaiData = JSON.stringify(pegawai);
            tr.innerHTML = `
                <td>${pegawai.nip}</td>
                <td>${pegawai.nama}</td>
                <td>${pegawai.golongan}</td>
                <td>${pegawai.jabatan}</td>
                <td>${cleanStringForDisplay(pegawai.tmt_sekarang)}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-info btn-edit me-1" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-success btn-print me-1" title="Cetak">🖨️</button>
                    <button class="btn btn-sm btn-danger btn-delete" title="Hapus">🗑️</button>
                </td>
            `;
            fragment.appendChild(tr);
        });
        tableBody.appendChild(fragment);
    }

    function renderPagination(totalPages, currentPage) {
        paginationNav.innerHTML = "";
        if (totalPages <= 1) return;

        const ul = document.createElement('ul');
        ul.className = 'pagination justify-content-center';

        const createBtn = (page, text, isActive = false, isDisabled = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
            li.innerHTML = `<button class="page-link" data-page="${page}">${text}</button>`;
            return li;
        };

        // Prev
        ul.appendChild(createBtn(currentPage - 1, 'Previous', false, currentPage === 1));

        // Pages
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, currentPage + 2);

        if (start > 1) {
            ul.appendChild(createBtn(1, '1'));
            if (start > 2) ul.appendChild(createBtn(0, '...', false, true));
        }

        for (let i = start; i <= end; i++) {
            ul.appendChild(createBtn(i, i, i === currentPage));
        }

        if (end < totalPages) {
            if (end < totalPages - 1) ul.appendChild(createBtn(0, '...', false, true));
            ul.appendChild(createBtn(totalPages, totalPages));
        }

        // Next
        ul.appendChild(createBtn(currentPage + 1, 'Next', false, currentPage === totalPages));

        paginationNav.appendChild(ul);
    }


    // --- 7. EVENT HANDLERS ---

    function attachListeners() {
        loginForm.addEventListener('submit', handleLoginSubmit);
        btnLogout.addEventListener('click', handleLogout);

        btnRefresh.addEventListener('click', loadData);
        btnTambah.addEventListener('click', () => showForm(null));
        
        // Search: Reset ke page 1 saat ketik
        searchBox.addEventListener('input', () => {
            currentPage = 1;
            render();
        });

        tableBody.addEventListener('click', handleTableClick);
        form.addEventListener('submit', handleFormSubmit);

        // --- Pagination Listener (Event Delegation) ---
        paginationNav.addEventListener('click', (e) => {
            const target = e.target.closest('.page-link');
            if (!target || target.parentElement.classList.contains('disabled')) return;
            
            e.preventDefault();
            const page = parseInt(target.dataset.page, 10);
            
            if (!isNaN(page) && page > 0) {
                currentPage = page;
                render(); // Render ulang tabel
                // tableBody.scrollIntoView({ behavior: 'smooth' }); // Opsional: Scroll ke atas
            }
        });

        // --- Form Internal Listeners ---
        formFields.nip.addEventListener("input", updateTglLahir);
        formFields.status.addEventListener("change", (e) => onStatusChanged(e.target.value));
        formFields.kodeGolongan.addEventListener("change", (e) => onKodeGolonganChanged(e.target.value));
        formFields.golongan.addEventListener("change", (e) => onGolonganChanged(e.target.value));
        formFields.pangkat.addEventListener("change", (e) => onPangkatChanged(e.target.value));
        formFields.dasar.addEventListener("change", updateDasarPejabat);
        
        // Kalkulasi Gaji
        formFields.golongan.addEventListener("change", updateGajiLama);
        formFields.dasarMkTahun.addEventListener("input", updateGajiLama);
        formFields.golongan.addEventListener("change", updateGajiBaru);
        formFields.mkBaruTahun.addEventListener("input", updateGajiBaru);
    }

    // --- 8. CRUD LOGIC (CREATE, UPDATE, DELETE) ---

    async function handleFormSubmit(event) {
        event.preventDefault();
        btnSimpan.disabled = true;
        btnSimpan.textContent = "Menyimpan...";
        
        try {
            const data = getFormData();
            const payload = {
                token: API_TOKEN,
                method: data.id ? "PUT" : "POST",
                ...data
            };

            // Menggunakan text/plain untuk bypass CORS Preflight Google Apps Script
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            if (result.status !== 200 && result.status !== 201) throw new Error(result.message);
            
            formModal.hide();
            alert(`Sukses: ${result.message}`);
            await loadData(); // Refresh data setelah simpan
            
        } catch (e) {
            alert(`Gagal menyimpan: ${e.message}`);
        } finally {
            btnSimpan.disabled = false;
            btnSimpan.textContent = "Simpan";
        }
    }

    async function handleDelete(id, nama) {
        if (!confirm(`Hapus data ${nama}?`)) return;
        statusLabel.textContent = "Menghapus...";
        
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    token: API_TOKEN,
                    method: "DELETE",
                    id: id
                })
            });
            const result = await response.json();
            if (result.status !== 200) throw new Error(result.message);
            
            await loadData();
            alert("Data dihapus.");
        } catch (e) {
            alert(`Gagal hapus: ${e.message}`);
            statusLabel.textContent = "";
        }
    }

    function handleTableClick(event) {
        const target = event.target.closest("button");
        if (!target) return;
        
        const row = target.closest("tr");
        const pegawai = JSON.parse(row.dataset.pegawaiData);

        if (target.classList.contains("btn-edit")) showForm(pegawai);
        if (target.classList.contains("btn-print")) handleCetak(pegawai);
        if (target.classList.contains("btn-delete")) handleDelete(pegawai.id, pegawai.nama);
    }


    // --- 9. FORM HELPERS & CALCULATION ---

    function showForm(pegawai = null) {
        form.reset();
        if (pegawai) {
            formTitle.textContent = "Edit Data";
            formFields.id.value = pegawai.id;
            formFields.tahunPembuatan.value = pegawai.tahun_pembuatan;
            formFields.nip.value = pegawai.nip;
            formFields.nama.value = pegawai.nama;
            formFields.tempatLahir.value = pegawai.tempatLahir;
            formFields.tglLahir.value = cleanStringForDisplay(pegawai.tglLahir);
            formFields.jabatan.value = pegawai.jabatan;
            formFields.unitKerja.value = pegawai.unit_kerja;
            formFields.unitKerjaInduk.value = pegawai.unit_kerja_induk;
            formFields.dasar.value = pegawai.dasar;
            formFields.dasarPejabat.value = pegawai.dasar_pejabat;
            formFields.dasarNomor.value = pegawai.dasar_nomor;
            
            formFields.dasarTanggal.value = cleanStringForDisplay(pegawai.dasar_tanggal);
            formFields.dasarTmt.value = cleanStringForDisplay(pegawai.dasar_tmt);
            formFields.tmtSekarang.value = cleanStringForDisplay(pegawai.tmt_sekarang);
            formFields.tmtSelanjutnya.value = cleanStringForDisplay(pegawai.tmt_selanjutnya);

            splitMkString(pegawai.dasar_mk_lama, formFields.dasarMkTahun, formFields.dasarMkBulan);
            splitMkString(pegawai.mk_baru, formFields.mkBaruTahun, formFields.mkBaruBulan);

            formFields.status.value = pegawai.status_kepegawaian || "PNS";
            onStatusChanged(formFields.status.value);
            formFields.kodeGolongan.value = pegawai.kode_golongan;
            onKodeGolonganChanged(formFields.kodeGolongan.value);
            formFields.pangkat.value = pegawai.pangkat;
            formFields.golongan.value = pegawai.golongan;

            updateDasarPejabat();
            updateGajiLama();
            updateGajiBaru();
        } else {
            formTitle.textContent = "Tambah Data";
            formFields.id.value = "";
            formFields.tahunPembuatan.value = new Date().getFullYear();
            formFields.status.value = "PNS";
            onStatusChanged("PNS");
            updateDasarPejabat();
        }
        formModal.show();
    }

    function getFormData() {
        return {
            id: formFields.id.value,
            tahun_pembuatan: formFields.tahunPembuatan.value,
            nip: formFields.nip.value,
            nama: formFields.nama.value,
            tempatLahir: formFields.tempatLahir.value,
            tglLahir: prepareStringForApi(formFields.tglLahir.value),
            status_kepegawaian: formFields.status.value, // Note: API Anda tidak pakai field ini, tapi berguna utk logika frontend
            kode_golongan: formFields.kodeGolongan.value,
            pangkat: formFields.pangkat.value,
            golongan: formFields.golongan.value,
            jabatan: formFields.jabatan.value,
            unit_kerja: formFields.unitKerja.value,
            unit_kerja_induk: formFields.unitKerjaInduk.value,
            dasar: formFields.dasar.value,
            dasar_pejabat: formFields.dasarPejabat.value,
            dasar_nomor: formFields.dasarNomor.value,
            dasar_tanggal: prepareStringForApi(formFields.dasarTanggal.value),
            dasar_tmt: prepareStringForApi(formFields.dasarTmt.value),
            dasar_mk_lama: `${formFields.dasarMkTahun.value || 0} Tahun ${formFields.dasarMkBulan.value || 0} Bulan`,
            dasar_gaji_lama: formFields.dasarGajiLama.value,
            mk_baru: `${formFields.mkBaruTahun.value || 0} Tahun ${formFields.mkBaruBulan.value || 0} Bulan`,
            gaji_baru: formFields.gajiBaru.value,
            tmt_sekarang: prepareStringForApi(formFields.tmtSekarang.value),
            tmt_selanjutnya: prepareStringForApi(formFields.tmtSelanjutnya.value)
        };
    }

    // Helper Form
    function cleanStringForDisplay(str) { return str && str.startsWith("'") ? str.substring(1) : str || ""; }
    function prepareStringForApi(str) { return str && !str.startsWith("'") ? `'${str}` : str; }
    function splitMkString(str, elThn, elBln) {
        if (!str) return;
        const p = str.split(' ');
        elThn.value = parseInt(p[0]) || 0;
        elBln.value = parseInt(p[2]) || 0;
    }
    function formatCurrency(num) { return "Rp. " + new Intl.NumberFormat('id-ID').format(Number(num)||0); }

    // Logic Dropdown
    function onStatusChanged(s) {
        formFields.kodeGolongan.innerHTML = "";
        const map = (s === "PNS") ? masterPangkatPNS : masterPangkatPPPK;
        Object.keys(map).forEach(k => formFields.kodeGolongan.add(new Option(k, k)));
        onKodeGolonganChanged(formFields.kodeGolongan.value);
    }
    function onKodeGolonganChanged(k) {
        formFields.pangkat.innerHTML = ""; formFields.golongan.innerHTML = "";
        if (!k) return;
        const s = formFields.status.value;
        const map = (s === "PNS") ? masterPangkatPNS : masterPangkatPPPK;
        m_currentPangkatMap = new Map(Object.entries(map[k] || {}));
        for (const [g, p] of m_currentPangkatMap) {
            formFields.golongan.add(new Option(g, g));
            formFields.pangkat.add(new Option(p, p));
        }
    }
    function onGolonganChanged(g) { 
        const p = m_currentPangkatMap.get(g); 
        if(p) formFields.pangkat.value = p; 
    }
    function onPangkatChanged(p) {
        for (const [g, val] of m_currentPangkatMap) {
            if(val === p) { formFields.golongan.value = g; break; }
        }
    }

    // Logic Otomatis
    function updateTglLahir() {
        const n = formFields.nip.value;
        if (n.length >= 8) {
            const t = n.substring(0, 4), b = n.substring(4, 6), h = n.substring(6, 8);
            const bn = BULAN_CETAK_MAP[parseInt(b)-1];
            formFields.tglLahir.value = bn ? `${h} ${bn} ${t}` : "";
        }
    }
    function updateDasarPejabat() {
        const d = formFields.dasar.value;
        formFields.dasarPejabat.value = (d === "Pangkat" || d === "Kenaikan Gaji Berkala") ? "BUPATI BANGKA" : (d === "Perpres" ? "PRESIDEN REPUBLIK INDONESIA" : "");
    }
    function findGaji(g, mk) {
        const f = masterGaji.find(i => i.golongan == g && parseInt(i.mkg) == mk);
        return f ? f.gaji : 0;
    }
    function updateGajiLama() {
        formFields.dasarGajiLama.value = findGaji(formFields.golongan.value, parseInt(formFields.dasarMkTahun.value)||0) || "";
    }
    function updateGajiBaru() {
        formFields.gajiBaru.value = findGaji(formFields.golongan.value, parseInt(formFields.mkBaruTahun.value)||0) || "";
    }

    // --- 10. CETAK (DOCXTEMPLATER) ---
    async function handleCetak(pegawai) {
        statusLabel.textContent = "Myiapkan dokumen...";
        try {
            // Deteksi Status (sederhana)
            const isPns = ["I", "II", "III", "IV"].some(g => pegawai.kode_golongan.includes(g));
            let tKey = isPns ? "pns" : "pppk";
            
            if (isPns) {
                const p = prompt("Ketik '1' (Reguler) atau '2' (Impassing)", "1");
                if (p === "2") tKey = "impassing";
                else if (p !== "1") return;
            }

            const blob = await fetch(`templates/${tKey}.docx`).then(r => r.blob());
            const zip = new PizZip(await blob.arrayBuffer());
            const doc = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

            // Prepare Data Cetak
            const mkLama = parseInt(pegawai.dasar_mk_lama) || 0;
            const mkBaru = parseInt(pegawai.mk_baru) || 0;
            const gLama = findGaji(pegawai.golongan, mkLama);
            const gBaru = findGaji(pegawai.golongan, mkBaru);
            const kop = masterSuratConfig.kop_surat?.[pegawai.kode_golongan] || "";
            const almt_kop = masterSuratConfig.alamat_kop?.[pegawai.kode_golongan] || "";
            // Format Tanggal Cetak (Huruf Kapital Awal)
            const fmtDate = (s) => {
                const c = cleanStringForDisplay(s);
                if(!c) return "";
                const p = c.split(' ');
                if(p.length===3) p[1] = p[1].charAt(0).toUpperCase() + p[1].slice(1).toLowerCase();
                return p.join(' ');
            };

            doc.setData({
                KOP: kop,
                ALAMAT_KOP: almt_kop,
                DASAR_HUKUM: masterSuratConfig.dasar_text?.[pegawai.dasar] || "",
                TANGGAL_NASKAH: '{tanggal_naskah}', // Placeholder untuk diisi manual
                SIFAT: '{sifat}', // Placeholder untuk diisi manual
                NOMOR_NASKAH: '{nomor_naskah}', // Placeholder untuk diisi manual
                JABATAN_PENGIRIM : '{jabatan_pengirim}', // Placeholder untuk diisi manual
                TTD_PENGIRIM : '{ttd_pengirim}', // Placeholder untuk diisi manual
                NAMA_PENGIRIM : '{nama_pengirim}', // Placeholder untuk diisi manual
                NIP_PENGIRIM : '{nip_pengirim}', // Placeholder untuk diisi manual
                NAMA: pegawai.nama,
                NIP: pegawai.nip,
                PANGKAT: pegawai.pangkat,
                GOLONGAN: pegawai.golongan,
                JABATAN: pegawai.jabatan,
                UNIT_KERJA: pegawai.unit_kerja,
                GAJI_BARU: formatCurrency(gBaru),
                DASAR_GAJI_LAMA: formatCurrency(gLama),
                MK_BARU: pegawai.mk_baru,
                DASAR_MK_LAMA: pegawai.dasar_mk_lama,
                TMT_SEKARANG: fmtDate(pegawai.tmt_sekarang),
                TMT_SELANJUTNYA: fmtDate(pegawai.tmt_selanjutnya),
                DASAR_NOMOR: pegawai.dasar_nomor,
                DASAR_TANGGAL: fmtDate(pegawai.dasar_tanggal),
                DASAR_PEJABAT: pegawai.dasar_pejabat,
                TEMPAT_LAHIR: pegawai.tempatLahir,
                TGL_LAHIR: fmtDate(pegawai.tglLahir),
                DASAR_TMT : fmtDate(pegawai.dasar_tmt)
            });

            doc.render();
            // ✅ PERBAIKAN UTAMA DI SINI (KOMPRESI)
            const out = doc.getZip().generate({
                type: "blob",
                compression: "DEFLATE",          // Mengaktifkan kompresi
                compressionOptions: { level: 9 } // Level maksimal (1-9)
            });

            saveAs(out, `SPT_KGB_${pegawai.nama.replace(/\s+/g, '_')}.docx`);
            statusLabel.textContent = "Dokumen siap.";
        } catch (e) {
            alert("Gagal cetak: " + e.message);
        }
    }

    init();

});
