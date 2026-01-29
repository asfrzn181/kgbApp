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

export const downloadSrikandiBookmartlet = `javascript:(function(){
    if(document.getElementById('bot-status-box')) document.getElementById('bot-status-box').remove();
    var statusBox = document.createElement('div');
    statusBox.id = 'bot-status-box';
    statusBox.style.cssText = "position:fixed; bottom:20px; right:20px; background:#000; color:#0f0; padding:15px; border-radius:8px; z-index:999999; font-family:monospace; width:400px; box-shadow:0 10px 40px rgba(0,0,0,0.8); border:1px solid #333; font-size:11px;";
    statusBox.innerHTML = "<div><strong>🤖 KGB ROBOT (ORIGINAL NAME)</strong></div><div id='bot-log' style='height:120px; overflow-y:auto; margin-top:10px; border-top:1px solid #333; padding-top:5px; color:#ccc;'>Waiting...</div><div style='background:#333; height:5px; margin-top:5px;'><div id='bot-bar' style='width:0%; height:100%; background:#0f0;'></div></div>";
    document.body.appendChild(statusBox);

    function log(msg) { 
        var l = document.getElementById('bot-log');
        var time = new Date().toLocaleTimeString().split(' ')[0];
        l.innerHTML = "<div><span style='color:#666'>["+time+"]</span> " + msg + "</div>" + l.innerHTML;
    }
    function setProgress(percent) { document.getElementById('bot-bar').style.width = percent + '%'; }
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function loadLib(url) {
        return new Promise(resolve => {
            if(document.querySelector("script[src='" + url + "']")) return resolve();
            var s = document.createElement('script'); s.src = url; s.onload = resolve;
            document.head.appendChild(s);
        });
    }

    async function smartType(element, text) {
        element.focus();
        var proto = window.HTMLInputElement.prototype;
        var setter = Object.getOwnPropertyDescriptor(proto, "value").set;
        setter.call(element, "");
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(50);
        setter.call(element, text);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(200);
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        element.blur();
    }

    async function scrapPdfFromHiddenFrame(url) {
        return new Promise(resolve => {
            var frame = document.createElement('iframe');
            frame.style.cssText = "width:1px;height:1px;opacity:0;position:absolute;left:-9999px;";
            frame.src = url;
            document.body.appendChild(frame);

            var attempts = 0;
            var interval = setInterval(() => {
                attempts++;
                try {
                    var doc = frame.contentDocument || frame.contentWindow.document;
                    if (doc) {
                        var pdfFrame = doc.querySelector('iframe[src*=".pdf"]');
                        if (pdfFrame && pdfFrame.src) {
                            clearInterval(interval);
                            var result = pdfFrame.src;
                            document.body.removeChild(frame); 
                            resolve(result);
                            return;
                        }
                        
                        var directLink = doc.querySelector('a[href*=".pdf"]');
                        if(directLink && directLink.href) {
                            clearInterval(interval);
                            var result = directLink.href;
                            document.body.removeChild(frame);
                            resolve(result);
                            return;
                        }
                    }
                } catch (e) { }

                if (attempts > 30) {
                    clearInterval(interval);
                    document.body.removeChild(frame);
                    resolve(null);
                }
            }, 500);
        });
    }

    function cleanText(str) { return str ? str.replace(/\\s+/g, ' ').trim() : ""; }

    (async function(){
        await loadLib('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        await loadLib('https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js');

        if (!window.opener) { log("❌ Error: Buka dari tombol Download!"); return; }

        log("📡 Handshake...");
        window.opener.postMessage("SRIKANDI_BOT_READY", "*");

        window.addEventListener("message", async function(event) {
            if (event.data && event.data.type === 'DATA_NASKAH_KGB') {
                var list = event.data.list;
                if(!list || list.length === 0) { log("⚠️ Data kosong."); return; }
                log("✅ Start: " + list.length + " antrian.");
                await processQueue(list);
            }
        });

        async function processQueue(targetList) {
            var zip = new JSZip();
            var folder = zip.folder("SK_KGB_DOWNLOAD");
            var searchInput = document.querySelector('input[placeholder="Cari Nomor Naskah"]');

            if(!searchInput) { log("❌ Input Pencarian tidak ketemu!"); return; }

            for (var i = 0; i < targetList.length; i++) {
                var noNaskah = targetList[i].trim();
                
                log("🔍 ["+(i+1)+"] Cari: " + noNaskah);
                setProgress((i / targetList.length) * 100);

                await smartType(searchInput, noNaskah);
                
                var linkUrl = null;
                var attempts = 0;
                
                while(attempts < 20) { 
                    await sleep(500); 
                    var rows = document.querySelectorAll('table tbody tr');
                    var foundRow = false;

                    for(var r=0; r<rows.length; r++){
                        var row = rows[r];
                        if(row.querySelector('input')) continue; 

                        var cols = row.querySelectorAll('td');
                        if(cols.length < 3) continue;

                        var colText = cleanText(cols[2].innerText); 
                        if(colText.includes("Tidak ada data") || colText.includes("Loading")) { break; }

                        if(colText.includes(cleanText(noNaskah))) {
                            var btn = row.querySelector('a[href*="detail"]');
                            if(btn) { 
                                linkUrl = btn.href;
                                foundRow = true;
                            }
                            break; 
                        }
                    }
                    if(foundRow) break;
                    attempts++;
                }

                if(linkUrl) {
                    log("⏳ Rendering...");
                    var pdfUrl = await scrapPdfFromHiddenFrame(linkUrl);

                    if(pdfUrl) {
                        try {
                            if(pdfUrl.startsWith('/')) pdfUrl = window.location.origin + pdfUrl;
                            pdfUrl = pdfUrl.replace(/&amp;/g, '&');

                            var originalName = pdfUrl.split('?')[0].split('/').pop();
                            originalName = decodeURIComponent(originalName);
                            if(!originalName.toLowerCase().endsWith('.pdf')) originalName += ".pdf";

                            log("⬇️ " + originalName);
                            var blob = await (await fetch(pdfUrl)).blob();
                            
                            if(blob.size > 500) {
                                folder.file(originalName, blob);
                                log("💾 Tersimpan.");
                            } else {
                                log("⚠️ File 0KB.");
                                folder.file("ERROR_" + noNaskah.replace(/[^a-zA-Z0-9]/g, "_") + ".txt", "Size: " + blob.size);
                            }
                        } catch(e) {
                            log("❌ Err Download: " + e.message);
                            folder.file("ERROR_NET.txt", e.message);
                        }
                    } else {
                        log("⚠️ Gagal Render PDF.");
                        folder.file("MISSING_PDF_" + noNaskah.replace(/[^a-zA-Z0-9]/g, "_") + ".txt", "Gagal scrape.");
                    }
                } else {
                    log("⛔ Timeout. Data tidak muncul.");
                    folder.file("NOT_FOUND_" + noNaskah.replace(/[^a-zA-Z0-9]/g, "_") + ".txt", "Not Found");
                }
            }

            log("📦 Zipping...");
            setProgress(100);
            var zipBlob = await zip.generateAsync({type:"blob"});
            saveAs(zipBlob, "Arsip_KGB_" + new Date().toISOString().slice(0,10) + ".zip");
            alert("Selesai! Cek Download.");
        }
    })();
})()`.replace(/(\r\n|\n|\r)/gm, "");