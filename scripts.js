document.addEventListener('DOMContentLoaded', () => {
    const sDiv = document.getElementById('status'), 
          cDiv = document.getElementById('weather-content'),
          fCon = document.getElementById('forecast-container'),
          card = document.getElementById('weather-card'),
          sIn = document.getElementById('search-input'), 
          sBtn = document.getElementById('search-btn'),
          fsBtn = document.getElementById('fullscreen-btn'),
          lBtn = document.getElementById('layout-btn'),
          tDisp = document.getElementById('timer-display'),
          uBtn = document.getElementById('update-now-btn'),
          clk = document.getElementById('hub-time');

    let coords = { lat: 33.72, lon: -116.21, lbl: "INDIO, CA" },
        timeRem = 15 * 60,
        cache = [];

    function extract(arr, idx) { return Array.prototype.at.call(arr, idx); }

    // Safe clock ticker that checks if element exists
    function tick() { 
        if (!clk) return;
        const n = new Date(); 
        let h = n.getHours(); 
        const m = String(n.getMinutes()).padStart(2,'0'), 
              a = h >= 12 ? 'PM' : 'AM'; 
        h = h % 12 || 12; 
        clk.textContent = `${h}:${m} ${a}`; 
    } 
    setInterval(tick, 1000); 
    tick(); 

    function parseCond(c) { 
        if (c === 0) return { e: "☀️", t: "Clear Sky" }; 
        if (c <= 3) return { e: "⛅", t: "Partly Cloudy" }; 
        if (c <= 48) return { e: "🌫️", t: "Foggy" }; 
        if (c <= 55) return { e: "🌦️", t: "Light Drizzle" }; 
        if (c <= 67) return { e: "🌧️", t: "Rain Showers" }; 
        if (c <= 77) return { e: "❄️", t: "Snow Fall" }; 
        return { e: "⛈️", t: "Thunderstorm" }; 
    } 

    function drawGraph(fData) { 
        const canvas = document.getElementById('line-graph-canvas'); 
        if (!canvas || !canvas.parentElement) return; 
        const ctx = canvas.getContext('2d'); 
        canvas.width = canvas.parentElement.clientWidth || 550; 
        canvas.height = canvas.parentElement.clientHeight || 160; 
        const px = 40, py = 35, gw = canvas.width - (px * 2), gh = canvas.height - (py * 2); 
        const max = Math.max(...fData.map(i => i.hi)) + 5, min = Math.min(...fData.map(i => i.lo)) - 5, rng = (max - min) || 1; 
        const getY = (t) => py + (gh - ((t - min) / rng) * gh), getX = (i) => px + (i * (gw / 4)); 
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        ctx.strokeStyle = '#282830'; ctx.lineWidth = 1; 
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(getX(i), py); ctx.lineTo(getX(i), canvas.height - py); ctx.stroke(); } 
        ctx.beginPath(); ctx.lineWidth = 4; ctx.strokeStyle = '#f28b82'; 
        fData.forEach((item, i) => { if (i === 0) ctx.moveTo(getX(i), getY(item.hi)); else ctx.lineTo(getX(i), getY(item.hi)); }); ctx.stroke(); 
        ctx.beginPath(); ctx.lineWidth = 4; ctx.strokeStyle = '#8ab4f8'; 
        fData.forEach((item, i) => { if (i === 0) ctx.moveTo(getX(i), getY(item.lo)); else ctx.lineTo(getX(i), getY(item.lo)); }); ctx.stroke(); 
        ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; 
        fData.forEach((item, i) => { 
            const x = getX(i), yh = getY(item.hi), yl = getY(item.lo); 
            ctx.fillStyle = '#f28b82'; ctx.beginPath(); ctx.arc(x, yh, 6, 0, Math.PI * 2); ctx.fill(); 
            ctx.fillStyle = '#fff'; ctx.fillText(`${item.hi}°`, x, yh - 12); 
            ctx.fillStyle = '#8ab4f8'; ctx.beginPath(); ctx.arc(x, yl, 6, 0, Math.PI * 2); ctx.fill(); 
            ctx.fillStyle = '#a3a3a8'; ctx.fillText(`${item.lo}°`, x, yl + 20); 
            ctx.fillStyle = '#e3e3e7'; ctx.fillText(item.day, x, canvas.height - 5); 
        }); 
    } 

    async function loadWeather(city) {
        if (sDiv) sDiv.classList.remove('hidden'); 
        if (cDiv) cDiv.classList.add('hidden'); 
        if (sDiv) sDiv.textContent = 'Connecting to weather satellites...'; 

        try {
            const geoRes = await fetch(`https://open-meteo.com{encodeURIComponent(city)}&count=1&language=en&format=json`);
            const geoData = await geoRes.json();
            
            if (!geoData.results || geoData.results.length === 0) {
                if (sDiv) sDiv.textContent = `Location "${city}" not found.`;
                return;
            }
            
            const loc = extract(geoData.results, 0);
            const finalLabel = `${loc.name}${loc.admin1 ? ', ' + loc.admin1 : ''}, ${loc.country_code.toUpperCase()}`;
            coords = { lat: loc.latitude, lon: loc.longitude, lbl: finalLabel };

            const weaRes = await fetch(`https://open-meteo.com{loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`);
            const d = await weaRes.json();

            const cc = parseCond(d.current.weather_code);
            document.getElementById('location').textContent = finalLabel;
            document.getElementById('emoji').textContent = cc.e;
            document.getElementById('temp').textContent = `${Math.round(d.current.temperature_2m)}°F`;
            
            // Failsafe checks for High/Low template metrics text nodes
            const hiEl = document.getElementById('high-temp');
            const loEl = document.getElementById('low-temp');
            if (hiEl) hiEl.textContent = Math.round(extract(d.daily.temperature_2m_max, 0));
            if (loEl) loEl.textContent = Math.round(extract(d.daily.temperature_2m_min, 0));
            
            document.getElementById('desc').textContent = cc.t;
            document.getElementById('humidity').textContent = d.current.relative_humidity_2m;
            document.getElementById('wind').textContent = Math.round(d.current.wind_speed_10m);

            if (fCon) fCon.innerHTML = ''; 
            cache = []; 
            const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

            d.daily.time.slice(1, 6).forEach((timeStr, idx) => {
                const offset = idx + 1;
                const cd = parseCond(Number(extract(d.daily.weather_code, offset)));
                const safeDate = timeStr.replace(/-/g, '/');
                const dn = days[new Date(safeDate).getDay()];
                const mx = Math.round(Number(extract(d.daily.temperature_2m_max, offset)));
                const mn = Math.round(Number(extract(d.daily.temperature_2m_min, offset)));
                
                cache.push({ day: dn, hi: mx, lo: mn });

                const b = document.createElement('div');
                b.className = 'forecast-day';
                b.innerHTML = `<div class="day-name">${dn}</div><div class="day-emoji">${cd.e}</div><div class="day-temps">${mx}° / ${mn}°</div>`;
                if (fCon) fCon.appendChild(b);
            });

            setTimeout(() => { if (card && !card.classList.contains('portrait')) drawGraph(cache); }, 80);
            if (sDiv) sDiv.classList.add('hidden'); 
            if (cDiv) cDiv.classList.remove('hidden'); 
            timeRem = 15 * 60;
        } catch (e) {
            if (sDiv) sDiv.textContent = "Live Feed Unstable. Check internet connection.";
        }
    }

    if (sBtn) sBtn.addEventListener('click', () => loadWeather(sIn.value)); 
    if (sIn) sIn.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadWeather(sIn.value); }); 
    if (uBtn) uBtn.addEventListener('click', () => loadWeather(sIn.value || 'Indio')); 

    if (lBtn) {
        lBtn.addEventListener('click', () => { 
            card.classList.toggle('portrait'); 
            if (!card.classList.contains('portrait') && cache.length) setTimeout(() => { drawGraph(cache); }, 150); 
        }); 
    }

    if (fsBtn) {
        fsBtn.addEventListener('click', () => { 
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); 
            else document.exitFullscreen(); 
            setTimeout(() => { if (cache.length) drawGraph(cache); }, 150); 
        }); 
    }

    setInterval(() => { 
        timeRem--; 
        if (timeRem <= 0) { timeRem = 15 * 60; loadWeather(sIn.value || 'Indio'); } 
        const mins = Math.floor(timeRem / 60), secs = String(timeRem % 60).padStart(2, '0'); 
        if (tDisp) tDisp.textContent = `Refreshes In: ${mins}:${secs}`; 
    }, 1000); 

    loadWeather('Indio'); 
});
