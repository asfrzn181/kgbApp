/**
 * ============================================================
 * BOOKMARKLET: SIASN Auto-Fill untuk KGB App
 * ============================================================
 * CARA PAKAI:
 * 1. Buka browser, buat bookmark baru
 * 2. Di field URL/Address, paste SELURUH isi blok javascript: di bawah ini
 * 3. Simpan bookmark dengan nama misalnya "SIASN → KGB"
 *
 * PENGGUNAAN:
 * 1. Di KGB App, isi NIP lalu klik "Cek SIASN"
 * 2. Setelah halaman SIASN terbuka, klik bookmark "SIASN → KGB"
 * 3. Bookmarklet akan otomatis: isi NIP, klik Cari, ambil data, kirim balik ke KGB App
 * ============================================================
 *
 * PASTE URL BOOKMARK BERIKUT INI (satu baris):
 */

// ============================================================
// VERSI BOOKMARKLET (1 baris, untuk di-paste sebagai URL bookmark)
// ============================================================
const BOOKMARKLET_URL = `javascript:(function(){
  /* === KGBAPP SIASN BOOKMARKLET v1.0 === */
  var nip = localStorage.getItem('KGBAPP_SIASN_NIP');
  var origin = localStorage.getItem('KGBAPP_SIASN_ORIGIN') || '*';
  if(!nip){ alert('NIP tidak ditemukan.\\nBuka KGB App dulu, isi NIP, lalu klik tombol Cek SIASN sebelum menjalankan bookmarklet ini.'); return; }

  /* Bantu: querySelector dengan label text */
  function getElByLabel(labelText){
    var labels = document.querySelectorAll('label');
    for(var i=0;i<labels.length;i++){
      if(labels[i].textContent.trim().toLowerCase().includes(labelText.toLowerCase())){
        var id=labels[i].htmlFor||labels[i].getAttribute('for');
        if(id) return document.getElementById(id);
        var p=labels[i].parentElement;
        if(p){ var inp=p.querySelector('p,span[class*="font-medium"]'); if(inp) return inp; }
        return labels[i].nextElementSibling;
      }
    }
    return null;
  }

  /* Ambil teks dari elemen label berdasarkan teks label */
  function getVal(labelText){
    var el=getElByLabel(labelText);
    return el ? el.textContent.trim() : '';
  }

  /* Helper: Parse tanggal Indonesia "1 Agustus 2001" ke "2001-08-01" */
  function parseIndonesiaDate(str){
    if(!str || str==='-') return '';
    var bulan={'januari':'01','februari':'02','maret':'03','april':'04','mei':'05','juni':'06',
               'juli':'07','agustus':'08','september':'09','oktober':'10','november':'11','desember':'12'};
    var parts=str.toLowerCase().trim().split(/\s+/);
    if(parts.length<3) return '';
    var d=parts[0].padStart(2,'0');
    var m=bulan[parts[1]]||'01';
    var y=parts[2];
    return y+'-'+m+'-'+d;
  }

  /* === STEP 1: ISI NIP DAN KLIK CARI === */
  function doSearch(){
    /* Cari input NIP (name="nip_nama" atau placeholder Masukkan NIP) */
    var nipInput = document.querySelector('input[name="nip_nama"]')
                || document.querySelector('input[placeholder*="NIP"]')
                || document.querySelector('input[placeholder*="nip"]');
    if(!nipInput){ alert('Field NIP tidak ditemukan di halaman ini. Pastikan Anda berada di halaman SIASN yang benar.'); return; }

    /* Set nilai NIP dengan Vue/React-friendly event */
    var nativeInputSetter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    nativeInputSetter.call(nipInput, nip);
    nipInput.dispatchEvent(new Event('input',{bubbles:true}));
    nipInput.dispatchEvent(new Event('change',{bubbles:true}));

    /* Pastikan mode pencarian adalah NIP (klik tombol NIP jika ada) */
    var btnNip = Array.from(document.querySelectorAll('button')).find(function(b){
      return b.textContent.trim()==='NIP';
    });
    if(btnNip && !btnNip.classList.contains('bg-secondaryBkn')) btnNip.click();

    /* Klik tombol Cari */
    setTimeout(function(){
      var btnCari = Array.from(document.querySelectorAll('button')).find(function(b){
        return b.textContent.trim()==='Cari' || b.textContent.trim().includes('Cari');
      });
      if(btnCari){ btnCari.click(); }
      else { alert('Tombol Cari tidak ditemukan. Coba klik Cari secara manual lalu jalankan bookmarklet lagi.'); return; }

      /* Tunggu hasil load lalu ambil data */
      setTimeout(doExtract, 2500);
    }, 300);
  }

  /* === STEP 2: EKSTRAK DATA DARI HALAMAN === */
  function doExtract(){
    /* Coba klik tab Data Utama dulu */
    var btnDataUtama = Array.from(document.querySelectorAll('button')).find(function(b){
      return b.textContent.includes('Data Utama') || b.textContent.includes('Data Pribadi');
    });
    if(btnDataUtama) btnDataUtama.click();

    setTimeout(function(){
      var nama         = getVal('Nama');
      var golonganRaw  = getVal('Golongan Ruang Akhir') || getVal('Golongan Ruang') || getVal('Golongan');
      var tmtGolongan  = getVal('TMT Golongan') || getVal('TMT Gol');
      var unitOrg      = getVal('Unit Organisasi') || getVal('Unit Kerja') || getVal('Unit Organisasi (UPT)');
      var unitInduk    = getVal('Unit Organisasi Induk') || getVal('Perangkat Daerah') || getVal('Satuan Kerja');
      var jabatanAktif = getVal('Jabatan') || getVal('Nama Jabatan');
      var pangkat      = getVal('Pangkat');

      /* Parse kode golongan (misal: "III/b" → "III/b", "Penata Muda Tk. I / III-b" → "III/b") */
      var golonganKode = golonganRaw;
      var golMatch = golonganRaw.match(/([IVX]+\/[a-d])/i);
      if(golMatch) golonganKode = golMatch[1].toUpperCase();

      /* Gabung pangkat + golongan */
      var pangkatGolongan = '';
      if(pangkat && golonganKode) pangkatGolongan = pangkat + ' / ' + golonganKode;
      else if(golonganRaw) pangkatGolongan = golonganRaw;

      var payload = {
        nama             : nama,
        unit_kerja       : unitOrg,
        perangkat_daerah : unitInduk,
        pangkat_golongan : pangkatGolongan,
        golongan_kode    : golonganKode,
        tmt_pangkat_golongan : parseIndonesiaDate(tmtGolongan),
        jabatan_aktif    : jabatanAktif,
        raw              : { golongan: golonganRaw, tmt: tmtGolongan, unit: unitOrg, induk: unitInduk }
      };

      console.log('[KGBAPP] Data SIASN:', payload);

      /* Kirim ke aplikasi KGB via postMessage (ke semua tab opener) */
      if(window.opener){
        window.opener.postMessage({ type: 'KGBAPP_SIASN_DATA', payload: payload }, origin);
        alert('✅ Data berhasil dikirim ke KGB App!\n\nNama: ' + nama + '\nGolongan: ' + pangkatGolongan + '\nUnit Kerja: ' + unitOrg + '\n\nTab ini bisa ditutup.');
      } else {
        /* Fallback: salin ke clipboard */
        var json = JSON.stringify(payload, null, 2);
        navigator.clipboard.writeText(json).then(function(){
          alert('Data disalin ke clipboard (window.opener tidak tersedia):\n\n' + json.substring(0, 300) + '...');
        }).catch(function(){
          alert('Data ekstraksi:\n' + json.substring(0, 500));
        });
      }
    }, 1000);
  }

  doSearch();
})();`;

// ============================================================
// VERSI READABLE (untuk referensi/debugging - BUKAN untuk bookmark)
// ============================================================
console.log('=== KGBAPP SIASN BOOKMARKLET ===');
console.log('Paste URL bookmark berikut ke address bar bookmark browser Anda:');
console.log(BOOKMARKLET_URL);
