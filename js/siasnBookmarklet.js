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
            // Tidak return agar tetap bisa manual jika sudah dicari
        }

        function setVal(el, v) {
            if (!el || !v) return;
            var ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            ns.call(el, v);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function getVal(lbl) {
            // Sifat global: cari berdasarkan elemen label secara luas
            var ls = document.querySelectorAll('label, div.font-semibold, span.font-semibold');
            for (var i = 0; i < ls.length; i++) {
                var text = ls[i].textContent.trim().toLowerCase();
                var tag = ls[i].tagName;
                if (text === lbl.toLowerCase() || (tag === 'LABEL' && text.indexOf(lbl.toLowerCase()) !== -1)) {
                    var pe = ls[i].parentElement;
                    if (pe) {
                        var el = pe.querySelector('p, h4, div.font-medium, span.font-medium');
                        if (el && el !== ls[i]) return el.textContent.trim();
                    }
                    if (ls[i].nextElementSibling) return ls[i].nextElementSibling.textContent.trim();
                }
            }
            return '';
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

        var payload = {};

        function getTab(name) {
            return Array.from(document.querySelectorAll('button, a, div')).find(function (b) {
                return b.textContent && b.textContent.trim().toLowerCase().indexOf(name.toLowerCase()) !== -1 && (b.tagName === 'BUTTON' || b.tagName === 'A');
            });
        }

        function step1() {
            var tab = getTab('Data Pribadi') || getTab('Data Utama');
            if (tab) tab.click();
            setTimeout(step2, 1200);
        }

        function step2() {
            payload.nama = getVal('Nama') || getVal('Nama KTP');
            var nipBaru = getVal('NIP Baru') || getVal('NIP');
            if (nipBaru) payload.nip = nipBaru;

            var tab = getTab('Posisi & Jabatan') || getTab('Riwayat Jabatan');
            if (tab) {
                tab.click();
                setTimeout(step3, 1200);
            } else {
                step3();
            }
        }

        function step3() {
            var golRaw = getVal('Golongan Ruang Akhir') || getVal('Golongan Ruang') || getVal('Golongan');
            var tmtGol = getVal('TMT Golongan') || getVal('TMT Gol');
            var unit = getVal('Unit Organisasi') || getVal('Unit Kerja') || getVal('Instansi Induk');
            var induk = getVal('Unit Organisasi Induk') || getVal('Perangkat Daerah') || getVal('Satuan Kerja') || getVal('Instansi Daerah');
            var pangkat = getVal('Pangkat');
            var jabatan = getVal('Jabatan') || getVal('Nama Jabatan');

            var golMatch = golRaw.match(new RegExp('([IVX]+[/][a-d])', 'i'));
            var golKode = golMatch ? golMatch[1].toUpperCase() : golRaw;
            var pangkatGol = (pangkat && golKode) ? (pangkat + ' / ' + golKode) : golRaw;

            payload.unit_kerja = unit;
            payload.perangkat_daerah = induk;
            payload.pangkat_golongan = pangkatGol;
            payload.golongan_kode = golKode;
            payload.tmt_pangkat_golongan = parseDate(tmtGol);
            if (jabatan) payload.jabatan = jabatan;

            if (window.opener) {
                window.opener.postMessage({ type: 'KGBAPP_SIASN_DATA', payload: payload }, decodeURIComponent(origin));
                alert('\u2705 Data dikirim ke KGB App!\n\nNama: ' + (payload.nama || '-') + '\nGolongan: ' + pangkatGol + '\nUnit: ' + unit + '\n\nTab ini bisa ditutup.');
            } else {
                navigator.clipboard.writeText(JSON.stringify(payload)).then(function () {
                    alert('Data disalin ke clipboard.\n\nNama: ' + (payload.nama || '-'));
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
            // Jika sudah di-Cari sebelumnya, atau tidak ada field NIP
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
