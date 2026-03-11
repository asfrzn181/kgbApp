const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const indexFile = path.join(__dirname, 'index.html');
const assetsDir = path.join(__dirname, 'assets');
const vendorDir = path.join(assetsDir, 'vendor');

if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);
if (!fs.existsSync(vendorDir)) fs.mkdirSync(vendorDir);

function download(urlStr, destPath, options = {}) {
    return new Promise((resolve, reject) => {
        const client = urlStr.startsWith('https') ? https : http;

        let reqOptions = { headers: {} };
        // Impersonate modern Chrome for Google Fonts to get WOFF2
        if (urlStr.includes('fonts.googleapis.com')) {
            reqOptions.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        }

        client.get(urlStr, reqOptions, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                // Handle redirects
                let newUrl = response.headers.location;
                if (!newUrl.startsWith('http')) {
                    const baseUrl = new URL(urlStr);
                    newUrl = `${baseUrl.origin}${newUrl.startsWith('/') ? '' : '/'}${newUrl}`;
                }
                console.log(`Redirecting to: ${newUrl}`);
                return download(newUrl, destPath, options).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed with status code: ${response.statusCode}`));
            }

            // Check if we just want content as string (for CSS parsing)
            if (options.returnText) {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => resolve(data));
                return;
            }

            const file = fs.createWriteStream(destPath);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', err => {
            fs.unlink(destPath, () => reject(err));
        });
    });
}

function getFilenameFromUrl(urlStr) {
    const parsed = new URL(urlStr);
    let base = path.basename(parsed.pathname);
    if (!base || base === '/') base = 'index.js';
    return base;
}

async function processCss(cssContent, baseUrl, basePath) {
    // Find url(...) in CSS
    const urlRegex = /url\((['"]?)(.*?)\1\)/g;
    let match;
    let modifiedCss = cssContent;
    let replaces = [];

    while ((match = urlRegex.exec(cssContent)) !== null) {
        let assetUrl = match[2];
        if (assetUrl.startsWith('data:')) continue;

        // resolve absolute url
        let absoluteUrl = assetUrl;
        if (!assetUrl.startsWith('http')) {
            absoluteUrl = new URL(assetUrl, baseUrl).href;
        }

        const filename = getFilenameFromUrl(absoluteUrl);
        // Create subfolder for CSS assets (like fonts)
        const assetDestDir = path.join(path.dirname(basePath), 'fonts');
        if (!fs.existsSync(assetDestDir)) fs.mkdirSync(assetDestDir, { recursive: true });
        const assetDestFile = path.join(assetDestDir, filename);

        console.log(`    -> Background fetching CSS asset: ${filename}`);
        await download(absoluteUrl, assetDestFile);

        replaces.push({
            original: assetUrl,
            replacement: `./fonts/${filename}`
        });
    }

    // reverse replace to avoid index shifting if any
    for (const rep of replaces) {
        modifiedCss = modifiedCss.split(rep.original).join(rep.replacement);
    }
    return modifiedCss;
}

async function main() {
    console.log("Starting CDN Download Process...");
    let html = fs.readFileSync(indexFile, 'utf8');

    // Make backup
    fs.writeFileSync(indexFile + '.backup_cdn', html);

    // Regex to match scripts and links
    const scriptRegex = /<script\s+[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*><\/script>/g;
    const linkRegex = /<link\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/g;
    const importmapRegex = /"([^"]+)":\s*"(https?:\/\/[^"]+)"/g;

    let match;
    let downloads = [];

    // 1. Process regular Scripts
    while ((match = scriptRegex.exec(html)) !== null) {
        const url = match[1];
        const filename = getFilenameFromUrl(url);
        const dest = path.join(vendorDir, filename);
        const localUrl = `assets/vendor/${filename}`;

        downloads.push({ type: 'js', url, dest, localUrl, originalContent: url });
    }

    // 2. Process Links (CSS)
    while ((match = linkRegex.exec(html)) !== null) {
        const fullTag = match[0];
        // skip if not stylesheet (except fonts maybe, but usually stylesheet)
        if (!fullTag.includes('rel="stylesheet"')) continue;

        const url = match[1];
        let filename = getFilenameFromUrl(url);
        if (!filename.endsWith('.css') && !url.includes('fonts.googleapis')) filename += '.css';
        if (url.includes('fonts.googleapis.com')) filename = 'google-fonts.css';

        const dest = path.join(vendorDir, filename);
        const localUrl = `assets/vendor/${filename}`;

        downloads.push({ type: 'css', url, dest, localUrl, originalContent: url });
    }

    // 3. Process Import Maps
    while ((match = importmapRegex.exec(html)) !== null) {
        const pkgName = match[1];
        const url = match[2];
        let filename = getFilenameFromUrl(url);
        if (!filename.endsWith('.js')) filename += '.js';

        const dest = path.join(vendorDir, filename);
        const localUrl = `./assets/vendor/${filename}`;

        downloads.push({ type: 'importmap', url, dest, localUrl, originalContent: url });
    }

    // Remove duplicates
    const uniqueMap = new Map();
    for (const d of downloads) {
        uniqueMap.set(d.url, d);
    }
    const uniqueDownloads = Array.from(uniqueMap.values());

    for (let i = 0; i < uniqueDownloads.length; i++) {
        const task = uniqueDownloads[i];
        console.log(`[${i + 1}/${uniqueDownloads.length}] Downloading ${task.url}...`);

        try {
            if (task.type === 'css') {
                // Download as text, parse, save
                let css = await download(task.url, null, { returnText: true });
                css = await processCss(css, task.url, task.dest);
                fs.writeFileSync(task.dest, css);
            } else {
                // Direct file
                await download(task.url, task.dest);
            }

            // Replace in HTML
            html = html.split(task.originalContent).join(task.localUrl);
        } catch (e) {
            console.error(`Error downloading ${task.url}:`, e.message);
        }
    }

    fs.writeFileSync(indexFile, html);
    console.log("Done! index.html updated.");
}

main().catch(console.error);
