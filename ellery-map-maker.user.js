// ==UserScript==
// @name         Openguessr Location (Ellery Ultra-Smooth)
// @namespace    https://openguessr.com/
// @version      41.7
// @description  Hızlı mouse hareketlerinde takılma sorunu giderildi. Global Drag & Resize sistemi.
// @author       emrellery
// @match        https://openguessr.com/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    let currentLocation = null;
    let isSatellite = false;
    let isDarkTheme = false;

    // --- [BÖLÜM 1] KOORDİNAT SİSTEMİ ---
    const extractLocation = () => { try { for (const f of document.querySelectorAll('iframe[src*="google.com/maps"]')) { const u = new URL(f.src); if (u.searchParams.has('pb')) { const m = u.searchParams.get('pb').match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/); if (m) return `${m[1]},${m[2]}`; } if (u.searchParams.has('location')) return u.searchParams.get('location'); } return null; } catch (e) { return null; } };
    const getMapUrl = (loc, satellite) => `https://maps.google.com/maps?q=${loc}&ll=${loc}&t=${satellite ? 'k' : 'm'}&z=5&output=embed`;

    // --- [BÖLÜM 2] GEO MOTORU ---
    const updateGeoInfo = async (loc) => {
        const [lat, lon] = loc.split(',');
        const geoVal = document.getElementById('geo-info-val');
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
            const data = await response.json();
            const city = data.address.city || data.address.town || data.address.village || data.address.province || "Unknown";
            const country = data.address.country || "Unknown";
            if (geoVal) geoVal.innerText = `${country} / ${city}`;
        } catch (e) { if (geoVal) geoVal.innerText = "Searching..."; }
    };

    // --- [BÖLÜM 3] TASARIM SİSTEMİ ---
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;800&family=JetBrains+Mono:wght@500&display=swap');

        :root {
            --glass-bg: rgba(255, 255, 255, 0.08);
            --glass-border: rgba(255, 255, 255, 0.22);
            --card-bg: rgba(255, 255, 255, 0.05);
            --text-p: #FFFFFF;
            --text-s: rgba(255, 255, 255, 0.4);
        }

        .dark-mode {
            --glass-bg: rgba(0, 0, 0, 0.45);
            --glass-border: rgba(255, 255, 255, 0.1);
            --card-bg: rgba(0, 0, 0, 0.2);
            --text-s: rgba(255, 255, 255, 0.3);
        }

        .ellery-panel {
            position: fixed; display: none; flex-direction: column;
            background: var(--glass-bg);
            backdrop-filter: blur(35px) saturate(180%); -webkit-backdrop-filter: blur(35px) saturate(180%);
            border: 1px solid var(--glass-border); border-radius: 36px;
            z-index: 999999; font-family: 'Plus Jakarta Sans', sans-serif;
            box-shadow: 0 30px 70px rgba(0,0,0,0.5);
            transition: background 0.4s ease, border 0.4s ease, opacity 0.3s;
        }

        #ellery-root { width: 440px; height: 520px; bottom: 180px; left: 30px; }
        #ellery-geo-root { width: 440px; height: 110px; bottom: 50px; left: 30px; }

        .h-bar { height: 60px; padding: 0 25px; display: flex; align-items: center; justify-content: space-between; cursor: grab; user-select: none; }
        .h-title { color: var(--text-p); font-weight: 800; font-size: 13px; letter-spacing: -0.3px; opacity: 0.8; }
        
        .theme-toggle { font-size: 10px; font-weight: 800; color: var(--text-p); background: rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 12px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); text-transform: uppercase; }

        .p-body { padding: 0 20px 20px 20px; flex-grow: 1; display: flex; flex-direction: column; gap: 10px; }
        .p-card { background: var(--card-bg); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 22px; padding: 14px 20px; }
        .p-label { color: var(--text-s); font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.8px; }
        .p-value { color: var(--text-p); font-size: 13px; font-family: 'JetBrains Mono'; font-weight: 600; }
        
        #geo-info-val { color: var(--text-p); font-weight: 700; font-size: 15px; letter-spacing: -0.2px; }

        .map-box { flex-grow: 1; border-radius: 22px; overflow: hidden; background: #000; border: 1px solid rgba(255, 255, 255, 0.1); }
        iframe { width: 100%; height: 100%; border: none; pointer-events: none; } /* Sürüklerken iframe takılmasını önler */
        .dragging iframe { pointer-events: none; }
    `);

    // --- [BÖLÜM 4] UI VE ULTRA-SMOOTH SÜRÜKLEME ---
    let root, geoRoot;

    const initInteraction = (el, handle) => {
        let isDragging = false;
        let oX, oY;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('theme-toggle')) return;
            isDragging = true;
            oX = e.clientX - el.offsetLeft;
            oY = e.clientY - el.offsetTop;
            el.classList.add('dragging');
            document.body.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            // requestAnimationFrame ile senkronize akıcı hareket
            window.requestAnimationFrame(() => {
                el.style.left = (e.clientX - oX) + 'px';
                el.style.top = (e.clientY - oY) + 'px';
                el.style.bottom = 'auto';
            });
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            el.classList.remove('dragging');
            document.body.style.cursor = 'default';
        });
    };

    const setupUI = () => {
        if (root) return;
        root = document.createElement('div');
        root.id = 'ellery-root';
        root.className = 'ellery-panel';
        root.innerHTML = `<div class="h-bar" id="m-drag"><span class="h-title">Ellery Map Marker</span><div id="theme-btn" class="theme-toggle">Dark Glass</div></div><div class="p-body"><div class="p-card" id="copy-coord" style="cursor:pointer"><div class="p-label">Live Signal</div><div id="val-text" class="p-value">Hunting...</div></div><div class="map-box"><iframe id="view-frame"></iframe></div></div>`;

        geoRoot = document.createElement('div');
        geoRoot.id = 'ellery-geo-root';
        geoRoot.className = 'ellery-panel';
        geoRoot.innerHTML = `<div class="h-bar" id="g-drag"><span class="h-title">Country / City</span><div style="width:30px; height:4px; background:rgba(255,255,255,0.1); border-radius:10px;"></div></div><div class="p-body"><div class="p-card"><div class="p-label">Discovered Region</div><div id="geo-info-val">Scanning...</div></div></div>`;

        document.body.appendChild(root);
        document.body.appendChild(geoRoot);

        initInteraction(root, document.getElementById('m-drag'));
        initInteraction(geoRoot, document.getElementById('g-drag'));

        document.getElementById('theme-btn').onclick = () => {
            isDarkTheme = !isDarkTheme;
            root.classList.toggle('dark-mode', isDarkTheme);
            geoRoot.classList.toggle('dark-mode', isDarkTheme);
            document.getElementById('theme-btn').innerText = isDarkTheme ? "Pearl Mode" : "Dark Glass";
        };

        document.getElementById('copy-coord').onclick = () => {
            if (currentLocation) { 
                GM_setClipboard(currentLocation);
                const val = document.getElementById('val-text');
                const orig = val.innerText;
                val.innerText = "SIGNAL COPIED";
                setTimeout(() => val.innerText = orig, 1200);
            }
        };
    };

    // --- [BÖLÜM 5] DÖNGÜ VE TETİKLEME ---
    setInterval(() => {
        const loc = extractLocation();
        if (loc) {
            const isChanged = loc !== currentLocation;
            currentLocation = loc;
            const text = document.getElementById('val-text');
            if (text) text.innerText = loc;
            if (isChanged) updateGeoInfo(loc);
            const iframe = document.getElementById('view-frame');
            if (iframe && root.style.display === 'flex') {
                const target = getMapUrl(loc, false);
                if (iframe.src !== target) iframe.src = target;
            }
        }
    }, 1500);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Insert') {
            setupUI();
            const show = root.style.display === 'none' || !root.style.display;
            root.style.display = geoRoot.style.display = show ? 'flex' : 'none';
            if (show && currentLocation) {
                document.getElementById('view-frame').src = getMapUrl(currentLocation, false);
                updateGeoInfo(currentLocation);
            }
        }
    });


})();
