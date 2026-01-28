export const srikandiBookmarklet = `javascript:(function(){
    function getParam(name){
        name = name.replace(/[\\[]/, "\\\\[").replace(/[\\]]/, "\\\\]");
        var regex = new RegExp("[\\\\?&]" + name + "=([^&#]*)");
        var results = regex.exec(window.location.search);
        return results === null ? "" : decodeURIComponent(results[1].replace(/\\+/g, " "));
    }

    var action = getParam('action');
    if(action !== 'autofill_magic'){ alert('Buka dari Aplikasi dulu!'); return; }

    var d = {
        hal: getParam('fill_hal'),
        ring: getParam('fill_ringkasan'),
        no: getParam('fill_nomor'),
        ttd: getParam('fill_penandatangan'),
        ver: getParam('fill_verifikator'),
        tuj: getParam('fill_tujuan'),
        mode: getParam('transfer_mode')
    };

    if(d.mode === 'direct_post_message'){
        if(window.opener){
            window.opener.postMessage("SRIKANDI_READY_TO_RECEIVE", "*");
            window.addEventListener("message", function(event){
                if(event.data && event.data.type === 'FILE_TRANSFER'){
                    (async function(){
                        try {
                            var base64 = event.data.fileData;
                            var name = event.data.fileName;
                            var res = await fetch(base64);
                            var blob = await res.blob();
                            var inp = null;
                            for(var k=0; k<20; k++){
                                inp = document.querySelector('input[type="file"]');
                                if(inp) break;
                                await new Promise(r => setTimeout(r, 500));
                            }
                            if(inp){
                                var mime = name.toLowerCase().indexOf('.docx') !== -1 ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
                                var file = new File([blob], name, { type: mime });
                                var dt = new DataTransfer();
                                dt.items.add(file);
                                inp.files = dt.files;
                                inp.dispatchEvent(new Event('change', {bubbles: true}));
                            }
                        } catch(e) {}
                    })();
                }
            });
        }
    }

    function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }

    function s(el, val){
        if(!el) return false;
        el.focus();
        var ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        var ts = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        var setter = el.tagName.toLowerCase() === 'textarea' ? ts : ns;
        if(setter){ setter.call(el, val); } else { el.value = val; }
        el.dispatchEvent(new Event('input', {bubbles: true}));
        el.dispatchEvent(new Event('change', {bubbles: true}));
        return true;
    }

    async function waitForValue(el, expectedValue, maxWait){
        var startTime = Date.now();
        while(Date.now() - startTime < maxWait){
            if(el.value === expectedValue) return true;
            await sleep(50);
        }
        return false;
    }

    async function waitForOptions(maxWait){
        var startTime = Date.now();
        while(Date.now() - startTime < maxWait){
            var opts = document.querySelectorAll('div[id*="react-select"][id*="option"]');
            if(opts.length > 0) return true;
            await sleep(50);
        }
        return false;
    }
    async function fJenisNaskah(){
        try {
            var labels = Array.prototype.slice.call(document.querySelectorAll('label'));
            var targetLabel = null;
            for(var i=0; i<labels.length; i++){
                if(labels[i].textContent.toLowerCase().indexOf("jenis naskah") !== -1){ targetLabel = labels[i]; break; }
            }
            if(!targetLabel) return;
            var container = targetLabel.closest('.MuiGrid-root');
            if(!container) return;
            var inp = container.querySelector('input[id*="react-select"]');
            if(!inp) return;

            inp.focus(); await sleep(100); inp.click(); await sleep(200);
            s(inp, "NASKAH DINAS");
            
            var hasOptions = await waitForOptions(5000);
            if(!hasOptions) return;
            await sleep(300);

            var option = null;
            var attempts = 0;
            while(attempts < 20 && !option){
                var opts = Array.prototype.slice.call(document.querySelectorAll('div[id*="react-select"][id*="option"]'));
                /* Prioritas 1: Exact Match NASKAH DINAS (Case Sensitive) */
                for(var j=0; j<opts.length; j++){
                    var optText = opts[j].textContent.trim();
                    if(optText.toLowerCase().indexOf("bupati") !== -1) continue;
                    if(optText === "NASKAH DINAS"){ option = opts[j]; break; }
                }
                /* Prioritas 2: Upper Match (Case Insensitive) */
                if(!option){
                    for(var j=0; j<opts.length; j++){
                        var optText = opts[j].textContent.trim();
                        if(optText.toLowerCase().indexOf("bupati") !== -1) continue;
                        if(optText.toUpperCase() === "NASKAH DINAS"){ option = opts[j]; break; }
                    }
                }
                if(!option) await sleep(100);
                attempts++;
            }

            if(option){
                option.scrollIntoView({block: "center"});
                await sleep(100);
                option.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, view: window}));
                await sleep(50);
                option.click();
                await sleep(200);
                return true;
            }
        } catch(e){}
        return false;
    }

    async function f(label, text){
        if(!text) return;
        try {
            var labels = Array.prototype.slice.call(document.querySelectorAll('label'));
            var targetLabel = null;
            for(var i=0; i<labels.length; i++){
                if(labels[i].textContent.toLowerCase().indexOf(label.toLowerCase()) !== -1){ targetLabel = labels[i]; break; }
            }
            if(!targetLabel) return;
            var container = targetLabel.closest('.MuiGrid-root');
            if(!container) return;
            var inp = container.querySelector('input[id*="react-select"]');
            if(!inp) return;

            inp.focus(); inp.click(); s(inp, text);
            
            var hasOptions = await waitForOptions(3000);
            if(!hasOptions) return;
            
            var option = null;
            var opts = Array.prototype.slice.call(document.querySelectorAll('div[id*="react-select"][id*="option"]'));
            
            for(var j=0; j<opts.length; j++){
                var optText = opts[j].textContent.trim();
                if(optText.toUpperCase() === text.toUpperCase()){ option = opts[j]; break; }
            }
            if(!option){
                for(var j=0; j<opts.length; j++){
                    var optText = opts[j].textContent.trim();
                    if(optText.toLowerCase().indexOf(text.toLowerCase()) !== -1){ option = opts[j]; break; }
                }
            }
            if(option){
                option.scrollIntoView({block: "center"});
                option.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, view: window}));
                option.click();
                await sleep(100);
                return true;
            }
        } catch(e){}
        return false;
    }

    async function fMulti(label, rawString){
        if(!rawString) return;
        var items = rawString.split('|');
        for(var i=0; i<items.length; i++){ await f(label, items[i]); }
    }

    /* 6. EXECUTION BLOCK */
    (async function(){
        try {
            var r1 = document.querySelector('input[name="is_naskah_final"][value="NASKAH KELUAR"]');
            if(r1) r1.click();
            var r2 = document.querySelector('input[name="ttd"][value="TTE"]');
            if(r2) r2.click();
            var r3 = document.querySelector('input[name="tipe_tte"][value="VISIBLE"]');
            if(r3) r3.click();

            await f("Dikirimkan melalui", "Badan Kepegawaian dan Pengembangan Sumber Daya Manusia");
            await fJenisNaskah(); /* Khusus Jenis Naskah */
            await f("Sifat Naskah", "Biasa");
            await f("Klasifikasi", "800.1.11.13");
            await f("Diberkaskan Oleh", "BIDANG MUTASI");
            await f("Utama (Internal", d.tuj);
            await fMulti("Verifikator", d.ver);
            if(d.ttd) await f("Penandatangan", d.ttd);

            if(d.no){
                var inputNo = document.querySelector('input[name="nomor"]');
                if(inputNo){ s(inputNo, d.no); await waitForValue(inputNo, d.no, 2000); }
            }
            if(d.hal){
                var txtHal = document.querySelector('textarea[name="hal"]');
                if(txtHal){ s(txtHal, d.hal); await waitForValue(txtHal, d.hal, 2000); }
            }
            if(d.ring){
                var txtRing = document.querySelector('textarea[name="ringkasan"]');
                if(txtRing){ s(txtRing, d.ring); await waitForValue(txtRing, d.ring, 2000); }
            }
            alert("Selesai.");
        } catch(err){
            alert("Error: " + err.message);
        }
    })();
})();`.replace(/(\r\n|\n|\r)/gm, "");