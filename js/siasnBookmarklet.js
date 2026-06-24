// ============================================================
// SIASN Bookmarklet — dibuat sebagai JS module terpisah
// agar tidak ada masalah escaping nested di template literal
// ============================================================

function buildSiasnBookmarklet() {
    function bookmarkletCode() {
        var p = new URLSearchParams(window.location.search);
        var nip = p.get('kgb_nip') || localStorage.getItem('KGBAPP_SIASN_NIP');
        var origin = p.get('kgb_origin') || localStorage.getItem('KGBAPP_SIASN_ORIGIN') || '*';

        if (!nip) {
            alert('Buka dari KGB App dulu!\nAtau isi NIP Anda, klik Cari, dan jalankan ulang bookmarklet.');
        }

        function setVal(el, v) {
            if (!el || !v) return;
            var ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            ns.call(el, v);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function parseDate(str) {
            if (!str || str === '-') return '';
            var bln = {
                'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
                'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
                'september': '09', 'oktober': '10', 'november': '11', 'desember': '12'
            };
            var pts = str.toLowerCase().trim().split(' ').filter(function (x) { return x.length > 0; });
            if (pts.length < 3) return '';
            var d = pts[0].length < 2 ? '0' + pts[0] : pts[0];
            return pts[2] + '-' + (bln[pts[1]] || '01') + '-' + d;
        }

        var allData = {};
        var payload = {};

        function extractCurrentTab() {
            var ls = document.querySelectorAll('label, div.font-semibold, span.font-semibold');
            for (var i = 0; i < ls.length; i++) {
                var el = ls[i];
                var key = el.textContent.trim();
                if (!key) continue;

                var pe = el.parentElement;
                var valEl = pe ? pe.querySelector('p, h4, div.font-medium, span.font-medium') : null;

                if (valEl && valEl !== el) {
                    allData[key] = valEl.textContent.trim();
                } else if (el.nextElementSibling) {
                    allData[key] = el.nextElementSibling.textContent.trim();
                }
            }
        }

        function getSafeVal(keys) {
            for (var i = 0; i < keys.length; i++) {
                var exactKey = Object.keys(allData).find(function(k) { 
                    return k.toLowerCase() === keys[i].toLowerCase(); 
                });
                if (exactKey && allData[exactKey] && allData[exactKey] !== '-') {
                    return allData[exactKey];
                }
            }
            return '';
        }

        function getTab(name) {
            return Array.from(document.querySelectorAll('button, a, div')).find(function (b) {
                return b.textContent && b.textContent.trim().toLowerCase().indexOf(name.toLowerCase()) !== -1 && (b.tagName === 'BUTTON' || b.tagName === 'A');
            });
        }

        function step1() {
            var tab = getTab('Data Pribadi') || getTab('Data Utama');
            if (tab) tab.click();
            setTimeout(step2, 1500);
        }

        function step2() {
            extractCurrentTab(); // Ambil data dari tab Data Pribadi
            var tab = getTab('Posisi & Jabatan') || getTab('Riwayat Jabatan');
            if (tab) {
                tab.click();
                setTimeout(step3, 1500);
            } else {
                step3();
            }
        }

        function step3() {
            extractCurrentTab(); // Ambil data dari tab Posisi & Jabatan

            // DEBUG: Console log semua data yang diekstrak
            console.log('=== SEMUA DATA SIASN YANG DIEKSTRAK ===');
            console.log(allData);

            var nipBaru = getSafeVal(['NIP Baru', 'NIP']);
            var namaAsli = getSafeVal(['Nama', 'Nama KTP']);
            var gelarDepan = getSafeVal(['Gelar Depan']);
            var gelarBelakang = getSafeVal(['Gelar Belakang']);

            // Susun nama lengkap dengan gelar
            var namaLengkap = namaAsli;
            if (gelarDepan) namaLengkap = gelarDepan + ' ' + namaLengkap;
            if (gelarBelakang) {
                if (namaLengkap.indexOf(',') === -1) namaLengkap += ',';
                namaLengkap += ' ' + gelarBelakang;
            }

            var golRaw = getSafeVal(['Golongan Ruang Akhir', 'Golongan Ruang', 'Golongan']);
            var tmtGol = getSafeVal(['TMT Golongan', 'TMT Gol']);
            var unit = getSafeVal(['Unit Organisasi', 'Unit Kerja', 'Instansi Induk']);
            var induk = getSafeVal(['Unit Organisasi Induk', 'Perangkat Daerah', 'Satuan Kerja', 'Instansi Daerah']);
            var pangkat = getSafeVal(['Pangkat']);
            var jabatan = getSafeVal(['Jabatan', 'Nama Jabatan']);

            var golMatch = golRaw.match(new RegExp('([IVX]+)[/]([a-d])', 'i'));
            var golKode = golMatch ? (golMatch[1].toUpperCase() + '/' + golMatch[2].toLowerCase()) : golRaw;
            var pangkatGol = (pangkat && golKode) ? (pangkat + ' / ' + golKode) : golRaw;

            // Masukkan data tambahan yang mungkin berguna
            payload.nip = nipBaru;
            payload.nama = namaLengkap;
            payload.unit_kerja = unit;
            payload.perangkat_daerah = induk;
            payload.pangkat_golongan = pangkatGol;
            payload.golongan_kode = golKode;
            payload.tmt_pangkat_golongan = parseDate(tmtGol);
            payload.jabatan = jabatan;
            
            // Simpan seluruh raw data untuk referensi
            payload.raw_data = allData;

            if (window.opener) {
                window.opener.postMessage({ type: 'KGBAPP_SIASN_DATA', payload: payload }, decodeURIComponent(origin));
                alert('\u2705 Data dikirim ke KGB App!\n\nNama Lengkap: ' + (payload.nama || '-') + '\nGolongan: ' + pangkatGol + '\nUnit: ' + unit + '\n\nCek Console browser (F12) untuk melihat seluruh data yang diekstrak. Tab ini bisa ditutup.');
            } else {
                navigator.clipboard.writeText(JSON.stringify(payload)).then(function () {
                    alert('Data disalin ke clipboard.\n\nNama Lengkap: ' + (payload.nama || '-') + '\n\nCek Console browser (F12) untuk melihat seluruh data yang diekstrak.');
                }).catch(function () {
                    alert('Payload:\n' + JSON.stringify(payload));
                });
            }
        }

        var nipInp = document.querySelector('input[name="nip_nama"]') || document.querySelector('input[placeholder*="NIP"]');
        if (nipInp && nip) {
            var btnNip = Array.from(document.querySelectorAll('button')).find(function (b) {
                return b.textContent.trim() === 'NIP';
            });
            if (btnNip && !btnNip.className.includes('bg-secondaryBkn')) btnNip.click();
            setVal(nipInp, nip);
            setTimeout(function () {
                var btnCari = Array.from(document.querySelectorAll('button')).find(function (b) {
                    return b.textContent.trim() === 'Cari';
                });
                if (btnCari) {
                    btnCari.click();
                    setTimeout(step1, 3000);
                } else {
                    alert('Tombol Cari tidak ditemukan. Klik Cari secara manual.');
                    step1();
                }
            }, 600);
        } else {
            step1();
        }
    }

    var fnBody = bookmarkletCode.toString();
    var body = fnBody.substring(fnBody.indexOf('{') + 1, fnBody.lastIndexOf('}'));
    var minified = body
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map(function (line) { return line.replace(/\/\/.*$/, ''); })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    return 'javascript:(function(){' + minified + '})();';
}

export const siasnBookmarklet = buildSiasnBookmarklet();
