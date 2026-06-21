// ============================================================
// SIASN Bookmarklet — dibuat sebagai JS module terpisah
// agar tidak ada masalah escaping nested di template literal
// ============================================================

// Kode bookmarklet ditulis sebagai fungsi biasa, lalu dikonversi ke string
function buildSiasnBookmarklet() {
    // PERHATIAN: Fungsi ini di-toString() lalu dieksekusi sebagai bookmarklet.
    // Jangan gunakan arrow function atau syntax ES6+ yang tidak semua browser support.
    // Semua string di sini adalah string biasa — tidak ada masalah escaping.

    function bookmarkletCode() {
        var p = new URLSearchParams(window.location.search);
        var nip = p.get('kgb_nip');
        var origin = p.get('kgb_origin') || '*';

        if (!nip) {
            alert('Buka dari KGB App dulu!\nKlik tombol Cek SIASN di form SK Fungsional, jangan buka SIASN manual.');
            return;
        }

        // Set value ke elemen input (Vue/React friendly)
        function setVal(el, v) {
            if (!el) return;
            var ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            ns.call(el, v);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Ambil teks dari elemen berdasarkan teks label
        function getVal(lbl) {
            var ls = document.querySelectorAll('label');
            for (var i = 0; i < ls.length; i++) {
                if (ls[i].textContent.trim().toLowerCase().indexOf(lbl.toLowerCase()) !== -1) {
                    var pe = ls[i].parentElement;
                    if (pe) {
                        var el = pe.querySelector('p');
                        if (el) return el.textContent.trim();
                    }
                }
            }
            return '';
        }

        // Parse tanggal Indonesia "1 Agustus 2001" ke "2001-08-01"
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

        // Ekstrak data dari halaman SIASN dan kirim ke KGB App
        function extract() {
            var nama = getVal('Nama');
            var golR = getVal('Golongan Ruang Akhir') || getVal('Golongan Ruang') || getVal('Golongan');
            var tmtG = getVal('TMT Golongan') || getVal('TMT Gol');
            var unit = getVal('Unit Organisasi') || getVal('Unit Kerja');
            var induk = getVal('Unit Organisasi Induk') || getVal('Perangkat Daerah') || getVal('Satuan Kerja');
            var pkt = getVal('Pangkat');

            // Match pola golongan: III/b, IV/a, dst
            var gm = golR.match(new RegExp('([IVX]+[/][a-d])', 'i'));
            var gk = gm ? gm[1].toUpperCase() : golR;
            var pg = (pkt && gk) ? (pkt + ' / ' + gk) : golR;

            var payload = {
                nama: nama,
                unit_kerja: unit,
                perangkat_daerah: induk,
                pangkat_golongan: pg,
                golongan_kode: gk,
                tmt_pangkat_golongan: parseDate(tmtG)
            };

            if (window.opener) {
                window.opener.postMessage({ type: 'KGBAPP_SIASN_DATA', payload: payload }, decodeURIComponent(origin));
                alert('\u2705 Data dikirim ke KGB App!\n\nNama: ' + nama + '\nGolongan: ' + pg + '\nUnit: ' + unit + '\n\nTab ini bisa ditutup.');
            } else {
                navigator.clipboard.writeText(JSON.stringify(payload)).then(function () {
                    alert('Data disalin ke clipboard (window.opener tidak tersedia).');
                }).catch(function () {
                    alert('Payload:\n' + JSON.stringify(payload));
                });
            }
        }

        // Cari field NIP di halaman SIASN
        var nipInp = document.querySelector('input[name="nip_nama"]') || document.querySelector('input[placeholder*="NIP"]');
        if (!nipInp) {
            alert('Field NIP tidak ditemukan di halaman ini. Pastikan Anda di halaman SIASN yang benar.');
            return;
        }

        // Klik tombol mode NIP jika ada
        var btnNip = Array.from(document.querySelectorAll('button')).find(function (b) {
            return b.textContent.trim() === 'NIP';
        });
        if (btnNip && !btnNip.className.includes('bg-secondaryBkn')) btnNip.click();

        // Isi NIP dan klik Cari
        setVal(nipInp, nip);
        setTimeout(function () {
            var btnCari = Array.from(document.querySelectorAll('button')).find(function (b) {
                return b.textContent.trim() === 'Cari';
            });
            if (btnCari) {
                btnCari.click();
                setTimeout(extract, 2800);
            } else {
                alert('Tombol Cari tidak ditemukan. Klik Cari manual lalu jalankan bookmarklet lagi.');
                extract();
            }
        }, 400);
    }

    // Konversi fungsi ke string lalu bungkus sebagai IIFE
    var fnBody = bookmarkletCode.toString();
    // Ambil isi fungsi saja (antara { dan } terluar)
    var body = fnBody.substring(fnBody.indexOf('{') + 1, fnBody.lastIndexOf('}'));
    // Hapus newline dan spasi berlebih untuk meminimalkan ukuran
    var minified = body.replace(/\s+/g, ' ').trim();
    return 'javascript:(function(){' + minified + '})();';
}

export const siasnBookmarklet = buildSiasnBookmarklet();
