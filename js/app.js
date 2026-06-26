const App = {
  trip: null,
  currentDayIdx: null,
  routeType: 'long',
  overviewRouteType: 'long',
  gpxCache: {},

  init() {
    this._applyTheme();
    document.getElementById('btn-theme')?.addEventListener('click', () => this._toggleTheme());
    this._renderHome();
    this._bindHomeEvents();
  },

  // ─── THEME ───────────────────────────────────────────────────────────────
  _applyTheme() {
    const t = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    const b = document.getElementById('btn-theme');
    if (b) b.textContent = t === 'light' ? '☀️' : '🌙';
  },
  _toggleTheme() {
    const cur = localStorage.getItem('theme') || 'dark';
    localStorage.setItem('theme', cur === 'light' ? 'dark' : 'light');
    this._applyTheme();
  },

  // ─── HOME ────────────────────────────────────────────────────────────────

  _renderHome() {
    this._showScreen('home');
    document.getElementById('nav').classList.add('hidden');
    const list = document.getElementById('trip-list');
    const trips = Object.keys(window).filter(k => k.startsWith('TRIP_')).map(k => window[k]).sort((a, b) => b.year - a.year);
    list.innerHTML = trips.map(t => {
      const riding = t.days.filter(d => d.longRoute || d.shortRoute).length;
      const totalKm  = t.days.reduce((s, d) => s + (d.longRoute?.km  || 0), 0);
      const totalHm  = t.days.reduce((s, d) => s + (d.longRoute?.hm  || 0), 0);
      return `<div class="trip-card" onclick="App.loadTrip(${t.year})">
        <div class="trip-card-year">${t.year}</div>
        <div class="trip-card-dest">${t.destination}</div>
        <div class="trip-card-meta">
          <span>${riding} ritdagen</span><span>${Math.round(totalKm)} km</span><span>${totalHm.toLocaleString()} hm</span>
        </div></div>`;
    }).join('') || '<p class="no-trips">Geen trips gevonden.</p>';
  },

  _bindHomeEvents() {
    document.getElementById('btn-load-trip').addEventListener('click', () => document.getElementById('file-trip').click());
    document.getElementById('file-trip').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = ev => {
        try { const d = JSON.parse(ev.target.result); window[`TRIP_${d.year}`] = d; this.loadTrip(d.year); }
        catch { alert('Ongeldig trip JSON bestand.'); }
      };
      r.readAsText(f);
    });
  },

  // ─── OVERVIEW ────────────────────────────────────────────────────────────

  loadTrip(year) {
    this.trip = window[`TRIP_${year}`];
    if (!this.trip) return;
    this.gpxCache = {};
    this._loadAllBundledGpx();
    this._renderOverview();
  },

  // Parse every bundled route upfront so overview map and day pages are instant
  _loadAllBundledGpx() {
    const bundle = window.GPX_BUNDLE;
    if (!bundle) return;
    Object.keys(bundle).forEach(key => {
      if (!this.gpxCache[key]) this.gpxCache[key] = GPXParser.fromBundle(bundle[key]);
    });
  },

  _renderOverview() {
    this._showScreen('overview');
    this._setupNav('Fietsweek ' + this.trip.year, () => this._renderHome());

    const riding  = this.trip.days.filter(d => d.longRoute || d.shortRoute);
    const totalKm = riding.reduce((s, d) => s + (d.longRoute?.km || 0), 0);
    const totalHm = riding.reduce((s, d) => s + (d.longRoute?.hm || 0), 0);

    const overviewTitle = document.getElementById('overview-title');
    const defaultTitle = `Fietsweek ${this.trip.year} — ${this.trip.destination}`;
    const savedTitle = localStorage.getItem(`trip-title-${this.trip.year}`);
    overviewTitle.textContent = savedTitle || defaultTitle;
    overviewTitle.contentEditable = true;
    overviewTitle.className = 'editable-title';
    overviewTitle.addEventListener('blur', () => {
      const val = overviewTitle.textContent.trim();
      if (val) localStorage.setItem(`trip-title-${this.trip.year}`, val);
      else overviewTitle.textContent = defaultTitle;
    });
    overviewTitle.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); overviewTitle.blur(); }
    });

    document.getElementById('overview-stats').innerHTML = `
      <div class="stat-pill">🚴 ${riding.length} ritdagen</div>
      <div class="stat-pill">📏 ${Math.round(totalKm)} km</div>
      <div class="stat-pill">⛰️ ${totalHm.toLocaleString()} hm</div>
      <div class="stat-pill">📍 ${this.trip.basecamp}</div>`;

    this._renderWeekScore();

    // Day cards
    document.getElementById('overview-days').innerHTML = this.trip.days.map((day, i) => {
      const hasRide = !!(day.longRoute || day.shortRoute);
      const L = day.longRoute, S = day.shortRoute;
      const dotColor = MapView.DAY_COLORS[i] || '#FC4C02';
      return `<div class="day-card ${hasRide ? 'clickable' : 'rest-day'}" ${hasRide ? `onclick="App.openDay(${i})"` : ''}>
        <div class="day-card-top">
          <div class="day-card-left">
            <div class="day-card-emoji" style="${hasRide ? `border-left: 3px solid ${dotColor}; padding-left:6px` : ''}">${day.emoji}</div>
            <div class="day-card-label">
              <span class="day-name">${day.label}</span>
              <span class="day-theme">${day.theme}</span>
            </div>
          </div>
          ${hasRide ? '<div class="day-card-arrow">›</div>' : ''}
        </div>
        ${hasRide ? `<div class="day-card-routes">
          ${L ? `<div class="day-route-row"><span class="route-badge long">Lang</span>
            <span class="route-name-sm">${L.name}</span>
            <span class="route-stats-sm">${L.km} km · ${(L.hm||0).toLocaleString()} hm · ${L.hmPerKm} hm/km${L.duration ? ' · '+L.duration : ''}</span>
          </div>` : ''}
          ${S ? `<div class="day-route-row"><span class="route-badge short">Kort</span>
            <span class="route-name-sm">${S.name}</span>
            <span class="route-stats-sm">${S.km} km · ${(S.hm||0).toLocaleString()} hm · ${S.hmPerKm} hm/km${S.duration ? ' · '+S.duration : ''}</span>
          </div>` : ''}
        </div>` : `<div class="day-card-rest">${day.comments || 'Rustdag'}</div>`}
      </div>`;
    }).join('');

    this._renderGpxDownloadHelper();

    const printBtn = document.getElementById('btn-print');
    if (printBtn) printBtn.onclick = () => window.print();

    const bakeBtn = document.getElementById('btn-bake');
    if (bakeBtn) bakeBtn.onclick = () => this._exportBakedClimbs();

    // Map: init then show all routes
    this.overviewRouteType = 'long';
    MapView.init('overview-map', this.trip.center, this.trip.defaultZoom);
    MapView.map.on('load', () => {
      MapView.showAllRoutes(this.gpxCache, this.overviewRouteType, this.trip);
    });
    this._bindOverviewMapEvents();
  },

  // Climbs for an arbitrary day/route (honours overrides) — used for week stats
  _climbsForDay(dayIdx, routeType) {
    const gpx = this.gpxCache[`${dayIdx}-${routeType}`];
    if (!gpx) return [];
    const raw = localStorage.getItem(`climbs-${this.trip.year}-${dayIdx}-${routeType}`);
    let defs = null;
    try { const d = JSON.parse(raw); if (Array.isArray(d)) defs = d; } catch (e) {}
    if (!defs) {
      const baked = this.trip.bakedClimbs?.[`${dayIdx}-${routeType}`];
      if (Array.isArray(baked)) defs = baked;
    }
    if (defs) {
      return defs.map(def => {
        const cl = GPXParser.buildClimbFromDist(gpx.points, def.startDistKm, def.endDistKm);
        return { ...cl, colName: def.colName || null, cat: def.cat || null };
      });
    }
    return gpx.climbs.map((c, idx) => {
      const cat = localStorage.getItem(`colcat-${this.trip.year}-${dayIdx}-${routeType}-${idx}`);
      return { ...c, cat: cat || null };
    });
  },

  // Tour-style climbing points for the whole week + per-category counts
  _weekStats() {
    const pts = { HC: 10, '1': 6, '2': 4, '3': 2, '4': 1 };
    const counts = { HC: 0, '1': 0, '2': 0, '3': 0, '4': 0 };
    let total = 0, n = 0;
    this.trip.days.forEach((day, i) => {
      if (!(day.longRoute || day.shortRoute)) return;
      const rt = day.longRoute ? 'long' : 'short';
      this._climbsForDay(i, rt).forEach(c => {
        const cat = this._climbCategory(c);
        if (cat) { total += pts[cat] || 0; counts[cat]++; n++; }
      });
    });
    return { total, counts, n };
  },

  _renderWeekScore() {
    const hero = document.querySelector('.overview-hero');
    if (!hero) return;
    let el = document.getElementById('overview-score');
    if (!el) { el = document.createElement('div'); el.id = 'overview-score'; el.className = 'week-score'; hero.appendChild(el); }

    const ws = this._weekStats();
    if (!ws.n) { el.innerHTML = ''; return; }
    const order = ['HC', '1', '2', '3', '4'];
    const badges = order.filter(k => ws.counts[k]).map(k =>
      `<span class="week-badge cat-${k}">${ws.counts[k]}× ${ChartView.catLabel(k)}</span>`
    ).join('');
    el.innerHTML = `
      <div class="week-score-head">
        <span class="ws-pts">${ws.total}</span>
        <span class="ws-pts-label">klimpunten · ${ws.n} cols deze week</span>
      </div>
      <div class="week-badges">${badges}</div>`;
  },

  _bindOverviewMapEvents() {
    const btnLong    = document.getElementById('ov-btn-long');
    const btnShort   = document.getElementById('ov-btn-short');
    const btnAnimate = document.getElementById('ov-btn-animate');

    btnLong.onclick = () => {
      this.overviewRouteType = 'long';
      btnLong.classList.add('active'); btnShort.classList.remove('active');
      MapView.stopAnimation(); btnAnimate.textContent = '▶ Animeer week';
      MapView.showAllRoutes(this.gpxCache, 'long', this.trip);
    };
    btnShort.onclick = () => {
      this.overviewRouteType = 'short';
      btnShort.classList.add('active'); btnLong.classList.remove('active');
      MapView.stopAnimation(); btnAnimate.textContent = '▶ Animeer week';
      MapView.showAllRoutes(this.gpxCache, 'short', this.trip);
    };
    btnAnimate.onclick = () => {
      if (MapView._isAnimating) {
        MapView.stopAnimation();
        btnAnimate.textContent = '▶ Animeer week';
        MapView.showAllRoutes(this.gpxCache, this.overviewRouteType, this.trip);
      } else {
        btnAnimate.textContent = '⏹ Stop';
        MapView.animateAllRoutes(this.gpxCache, this.overviewRouteType, this.trip, state => {
          if (state === 'done') {
            btnAnimate.textContent = '▶ Animeer week';
            MapView.showAllRoutes(this.gpxCache, this.overviewRouteType, this.trip);
          }
        });
      }
    };
  },

  _renderGpxDownloadHelper() {
    const el = document.getElementById('overview-history');
    const routes = [];
    this.trip.days.forEach(day => {
      if (day.longRoute?.strava)  routes.push({ label: `${day.label} – Lang`, name: day.longRoute.name,  strava: day.longRoute.strava });
      if (day.shortRoute?.strava) routes.push({ label: `${day.label} – Kort`, name: day.shortRoute.name, strava: day.shortRoute.strava });
    });
    const links = routes.map(r => {
      const id = r.strava.match(/routes\/(\d+)/)?.[1];
      const gpxUrl = id ? `https://www.strava.com/routes/${id}/export_gpx` : null;
      return `<div class="gpx-dl-row">
        <span class="gpx-dl-label">${r.label}</span>
        <span class="gpx-dl-name">${r.name}</span>
        ${gpxUrl ? `<a href="${gpxUrl}" target="_blank" class="gpx-dl-btn">↓ GPX</a>` : ''}
      </div>`;
    }).join('');
    el.innerHTML = `<h2>GPX bestanden downloaden</h2>
      <p class="gpx-dl-hint">Log eerst in op Strava, klik dan ↓ GPX, sleep daarna het bestand naar de routepagina.</p>
      <div class="gpx-dl-list">${links}</div>`;
  },

  // ─── DAY PAGE ────────────────────────────────────────────────────────────

  openDay(idx) {
    this.currentDayIdx = idx;
    this.routeType = 'long';
    // Ensure this day's GPX is parsed (already done in loadAllBundledGpx, but safe to call again)
    this._loadBundledGpx(idx);
    this._renderDay();
  },

  _loadBundledGpx(idx) {
    const bundle = window.GPX_BUNDLE;
    if (!bundle) return;
    ['long', 'short'].forEach(type => {
      const key = `${idx}-${type}`;
      if (bundle[key] && !this.gpxCache[key]) this.gpxCache[key] = GPXParser.fromBundle(bundle[key]);
    });
  },

  _renderDay() {
    const day = this.trip.days[this.currentDayIdx];
    this._showScreen('day');
    this._setupNav(`Dag ${day.dayNum} — ${day.label}`, () => this._renderOverview());
    document.getElementById('btn-long').style.display  = day.longRoute  ? '' : 'none';
    document.getElementById('btn-short').style.display = day.shortRoute ? '' : 'none';
    this._updateRouteToggle();
    this._renderDayContent(day);
    this._initDayMap();
    this._bindDayEvents();
  },

  _renderDayContent(day) {
    const route = day[this.routeType === 'long' ? 'longRoute' : 'shortRoute'] || day.longRoute;

    document.getElementById('day-header').innerHTML = `
      <div class="day-big-emoji">${day.emoji}</div>
      <div>
        <div class="day-theme-label">${day.theme}${day.funName ? ' — ' + day.funName : ''}</div>
        <h2 class="day-route-name">${route?.name || day.label}</h2>
        <div class="day-dayname">${day.label} · Dag ${day.dayNum}</div>
      </div>`;

    document.getElementById('day-stats').innerHTML = route ? `
      <div class="stat-box"><div class="stat-value">${route.km}</div><div class="stat-label">km</div></div>
      <div class="stat-box"><div class="stat-value">${(route.hm||0).toLocaleString()}</div><div class="stat-label">hoogtemeters</div></div>
      <div class="stat-box"><div class="stat-value">${route.hmPerKm}</div><div class="stat-label">hm/km</div></div>
      ${route.duration ? `<div class="stat-box"><div class="stat-value">${route.duration}</div><div class="stat-label">duur</div></div>` : ''}
      <a href="${route.strava}" target="_blank" class="strava-link">Bekijk op Strava ↗</a>` : '';

    // Description + timed segment + alternative
    let notesHtml = '';
    if (day.description)
      notesHtml += `<div class="notes-box"><span class="notes-icon">📖</span><span>${day.description}</span></div>`;
    if (day.timedSegment)
      notesHtml += `<div class="notes-box timed-seg"><span class="notes-icon">⏱</span>
        <span><strong>Getimed segment:</strong> ${day.timedSegment.name} · ${day.timedSegment.km} km · ${day.timedSegment.gradient}%
        ${day.timedSegment.stravaUrl ? `<a href="${day.timedSegment.stravaUrl}" target="_blank" class="seg-link">↗</a>` : ''}</span></div>`;
    if (day.alternative)
      notesHtml += `<div class="notes-box"><span class="notes-icon">🔀</span><span><strong>Alternatief:</strong> ${day.alternative}</span></div>`;
    if (day.comments)
      notesHtml += `<div class="notes-box"><span class="notes-icon">📝</span><span>${day.comments}</span></div>`;
    document.getElementById('day-notes').innerHTML = notesHtml;

    const cacheKey = `${this.currentDayIdx}-${this.routeType}`;
    const gpx = this.gpxCache[cacheKey];
    const timedSeg = this._getTimedSegment();
    this._namedClimbs = this._computeClimbs(gpx);
    ChartView.render('altitude-chart', gpx || null, timedSeg, point => MapView.showHoverMarker(point), this._namedClimbs);
    this._renderClimbs(this._namedClimbs);

    const gpxEl = document.getElementById('day-gpx-upload');
    const isBundled = !!(window.GPX_BUNDLE?.[cacheKey]);
    if (gpx) {
      gpxEl.querySelector('.gpx-drop-zone p').textContent = isBundled
        ? `✅ GPX automatisch geladen (${(gpx.totalDistM/1000).toFixed(1)} km, ${gpx.totalGain} hm stijging)`
        : `✅ GPX geladen (${(gpx.totalDistM/1000).toFixed(1)} km, ${gpx.totalGain} hm stijging)`;
      gpxEl.querySelector('.gpx-icon').textContent = '✅';
    } else {
      gpxEl.querySelector('.gpx-drop-zone p').textContent = 'Sleep GPX bestand hierheen of klik om te uploaden';
      gpxEl.querySelector('.gpx-icon').textContent = '📂';
    }
  },

  // Build named climbs: match by closest summit elevation, then check localStorage overrides
  _getNamedClimbs(climbs) {
    const route = this.trip.days[this.currentDayIdx]?.[this.routeType === 'long' ? 'longRoute' : 'shortRoute']
                || this.trip.days[this.currentDayIdx]?.longRoute;
    const knownCols = route?.cols || [];

    // Initialize result with no names
    const result = climbs.map(c => ({ ...c, colName: null, colUrl: null, cat: null }));

    // Apply name overrides first (they block auto-matching for that climb)
    climbs.forEach((c, idx) => {
      const saved = localStorage.getItem(this._climbKey(idx));
      if (saved) result[idx].colName = saved;
    });

    // For each known col, find the closest unmatched climb and assign it
    knownCols.forEach(col => {
      let bestIdx = -1, bestDiff = 200;
      for (let i = 0; i < climbs.length; i++) {
        // Skip if already matched or has localStorage override
        if (result[i].colName !== null) continue;
        const diff = Math.abs(climbs[i].endEle - col.summitEle);
        if (diff < bestDiff) {
          bestIdx = i;
          bestDiff = diff;
        }
      }
      // Assign the best match if found
      if (bestIdx >= 0) {
        result[bestIdx].colName = col.name;
        result[bestIdx].colUrl = col.cyclingcolsUrl;
      }
    });

    // Manual URL + category overrides win last
    climbs.forEach((c, idx) => {
      const u = localStorage.getItem(this._colUrlKey(idx));
      if (u) result[idx].colUrl = u;
      const cat = localStorage.getItem(this._colCatKey(idx));
      if (cat) result[idx].cat = cat;
    });

    return result;
  },

  _colUrlKey(idx) { return `colurl-${this.trip.year}-${this.currentDayIdx}-${this.routeType}-${idx}`; },
  _colCatKey(idx) { return `colcat-${this.trip.year}-${this.currentDayIdx}-${this.routeType}-${idx}`; },

  // Effective category: manual override on the climb wins, else auto-computed.
  // cat === 'none' means the user explicitly cleared the category.
  _climbCategory(c) {
    if (!c) return null;
    if (c.cat) return c.cat === 'none' ? null : c.cat;
    return ChartView.categorize(c);
  },

  _climbKey(idx) {
    return `col-${this.trip.year}-${this.currentDayIdx}-${this.routeType}-${idx}`;
  },

  // ─── EDITABLE CLIMBS ─────────────────────────────────────────────────────
  // When the user adjusts/merges/adds/deletes climbs we store a full override
  // (an array of {startDistKm, endDistKm, colName, colUrl}) that replaces auto-detection.

  _climbsOverrideKey() {
    return `climbs-${this.trip.year}-${this.currentDayIdx}-${this.routeType}`;
  },

  _loadClimbDefs() {
    const raw = localStorage.getItem(this._climbsOverrideKey());
    if (!raw) return null;
    try { const d = JSON.parse(raw); return Array.isArray(d) ? d : null; } catch(e) { return null; }
  },

  _saveClimbDefs(defs) {
    defs.sort((a, b) => a.startDistKm - b.startDistKm);
    localStorage.setItem(this._climbsOverrideKey(), JSON.stringify(defs));
  },

  // Snapshot the current named climbs into an editable definitions array
  _materializeClimbDefs() {
    return (this._namedClimbs || []).map(c => ({
      startDistKm: c.startDistKm,
      endDistKm:   c.endDistKm,
      colName:     c.colName || null,
      colUrl:      c.colUrl || null,
      cat:         c.cat || null
    }));
  },

  // Baked climb defs for the current day/route (permanent, committed in trip.js)
  _bakedClimbDefs() {
    const b = this.trip.bakedClimbs?.[`${this.currentDayIdx}-${this.routeType}`];
    return Array.isArray(b) ? b : null;
  },

  // Effective climbs for current day/route.
  // Priority: personal localStorage override → baked trip.js climbs → auto-detect + match.
  _computeClimbs(gpx) {
    if (!gpx) return [];
    const defs = this._loadClimbDefs() || this._bakedClimbDefs();
    if (defs) {
      return defs.map(def => {
        const climb = GPXParser.buildClimbFromDist(gpx.points, def.startDistKm, def.endDistKm);
        return { ...climb, colName: def.colName || null, colUrl: def.colUrl || null, cat: def.cat || null };
      });
    }
    return this._getNamedClimbs(gpx.climbs);
  },

  // Export every route the user has actually edited into a JSON file that can be
  // baked into trip.js (so the data is permanent and identical for everyone).
  _exportBakedClimbs() {
    const out = {};
    const saveDay = this.currentDayIdx, saveRt = this.routeType;
    let edited = 0;
    this.trip.days.forEach((day, di) => {
      ['long', 'short'].forEach(rt => {
        const key = `${di}-${rt}`;
        const gpx = this.gpxCache[key];
        if (!gpx) return;
        this.currentDayIdx = di; this.routeType = rt;
        const climbs = this._computeClimbs(gpx);
        const hasEdits = !!localStorage.getItem(this._climbsOverrideKey()) ||
          climbs.some((c, idx) =>
            localStorage.getItem(this._climbKey(idx)) ||
            localStorage.getItem(this._colUrlKey(idx)) ||
            localStorage.getItem(this._colCatKey(idx)) ||
            localStorage.getItem(this._noteKey(idx)));
        if (!hasEdits) return;
        edited++;
        out[key] = climbs.map((c, idx) => {
          const def = {
            startDistKm: +c.startDistKm.toFixed(3),
            endDistKm: +c.endDistKm.toFixed(3),
            colName: c.colName || null,
            colUrl: c.colUrl || null,
            cat: c.cat || null
          };
          const note = this._loadClimbNote(idx);
          if (note) def.note = note;
          return def;
        });
      });
    });
    this.currentDayIdx = saveDay; this.routeType = saveRt;

    if (!edited) {
      alert('Geen klim-aanpassingen gevonden om te bakken.');
      return;
    }
    const json = JSON.stringify(out, null, 2);
    console.log('[bake] klim-edits:\n' + json);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `klim-bake-${this.trip.year}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    alert(`${edited} route(s) met aanpassingen geëxporteerd naar Downloads als klim-bake-${this.trip.year}.json.`);
  },

  // Apply an edit to the climb definitions, persist, and refresh pills + markers
  _applyClimbEdit(mutator) {
    const gpx = this.gpxCache[`${this.currentDayIdx}-${this.routeType}`];
    if (!gpx) return;
    const defs = this._loadClimbDefs() || this._materializeClimbDefs();
    mutator(defs);
    this._saveClimbDefs(defs);
    this._namedClimbs = this._computeClimbs(gpx);
    this._renderClimbs(this._namedClimbs);
    this._refreshChart();
    MapView.showClimbMarkers(this._namedClimbs, gpx.points, idx => this._showClimbPopup(idx));
  },

  // Map → chart hover: highlight the altitude chart as the cursor follows the route
  _enableChartSync(gpx) {
    MapView.enableChartSync(gpx, km => {
      if (km == null) ChartView.clearHover();
      else ChartView.showHoverAtDistanceKm(km);
    });
  },

  // Re-render the stage altitude chart (keeps KOM + climb category labels in sync)
  _refreshChart() {
    const gpx = this.gpxCache[`${this.currentDayIdx}-${this.routeType}`];
    const timedSeg = this._getTimedSegment();
    ChartView.render('altitude-chart', gpx || null, timedSeg, point => MapView.showHoverMarker(point), this._namedClimbs);
  },

  _toggleGeomEdit() {
    document.getElementById('popup-geom-row')?.classList.toggle('hidden');
  },

  _saveClimbGeometry(idx) {
    const startKm = parseFloat(document.getElementById('popup-start-input').value);
    const endKm   = parseFloat(document.getElementById('popup-end-input').value);
    if (isNaN(startKm) || isNaN(endKm) || endKm <= startKm) {
      alert('Ongeldige waarden: de top (eind) moet ná de start liggen.');
      return;
    }
    this._applyClimbEdit(defs => {
      if (defs[idx]) { defs[idx].startDistKm = startKm; defs[idx].endDistKm = endKm; }
    });
    // Re-open the popup at the (possibly re-sorted) new position
    const newIdx = this._namedClimbs.findIndex(c => Math.abs(c.startDistKm - startKm) < 0.05);
    if (newIdx >= 0) this._showClimbPopup(newIdx); else this._closePopup();
  },

  _deleteClimb(idx) {
    if (!confirm('Deze klim verwijderen?')) return;
    this._applyClimbEdit(defs => { defs.splice(idx, 1); });
    this._closePopup();
  },

  _mergeClimbWithNext(idx) {
    this._applyClimbEdit(defs => {
      const a = defs[idx], b = defs[idx + 1];
      if (!b) return;
      defs[idx] = {
        startDistKm: Math.min(a.startDistKm, b.startDistKm),
        endDistKm:   Math.max(a.endDistKm, b.endDistKm),
        colName:     a.colName || b.colName || null,
        colUrl:      a.colUrl || b.colUrl || null
      };
      defs.splice(idx + 1, 1);
    });
    // Merged climb keeps the lower start index → same idx
    if (this._namedClimbs[idx]) this._showClimbPopup(idx); else this._closePopup();
  },

  _addClimb() {
    const gpx = this.gpxCache[`${this.currentDayIdx}-${this.routeType}`];
    if (!gpx) return;
    const totalKm = gpx.totalDistM / 1000;
    const start = 0, end = Math.min(2, totalKm);
    this._applyClimbEdit(defs => {
      defs.push({ startDistKm: start, endDistKm: end, colName: null, colUrl: null });
    });
    const newIdx = this._namedClimbs.findIndex(c => Math.abs(c.startDistKm - start) < 0.05);
    if (newIdx >= 0) { this._showClimbPopup(newIdx); this._toggleGeomEdit(); }
  },

  _resetClimbs() {
    if (!confirm('Klimmen terugzetten naar automatisch gedetecteerd?')) return;
    localStorage.removeItem(this._climbsOverrideKey());
    const gpx = this.gpxCache[`${this.currentDayIdx}-${this.routeType}`];
    this._namedClimbs = this._computeClimbs(gpx);
    this._renderClimbs(this._namedClimbs);
    this._refreshChart();
    if (gpx) MapView.showClimbMarkers(this._namedClimbs, gpx.points, idx => this._showClimbPopup(idx));
    this._closePopup();
  },

  _closePopup() {
    document.getElementById('climb-popup').classList.add('hidden');
  },

  // Difficulty score (same basis as categorisation) — for picking the queen climb
  _climbScore(c) { return (c.lengthKm || 0) * (c.avgGrad || 0) * (c.avgGrad || 0); },

  // Index of the hardest categorised climb of the day, or -1
  _queenIdx(climbs) {
    const rankOf = { HC: 5, '1': 4, '2': 3, '3': 2, '4': 1 };
    let best = -1, bestRank = 0, bestScore = -1;
    (climbs || []).forEach((c, i) => {
      const rank = rankOf[this._climbCategory(c)] || 0;
      if (!rank) return;
      const sc = this._climbScore(c);
      if (rank > bestRank || (rank === bestRank && sc > bestScore)) {
        bestRank = rank; bestScore = sc; best = i;
      }
    });
    return best;
  },

  _heroHtml(c, idx) {
    const cat = this._climbCategory(c);
    const color = ChartView._catColor(cat);
    return `<div class="day-hero" onclick="App._showClimbPopup(${idx})" style="--cat-color:${color}" title="Bekijk klimdetails">
      <div class="day-hero-top">
        <span class="day-hero-tag">👑 Koning van de dag</span>
        ${cat ? `<span class="cat-badge cat-${cat}">${ChartView.catLabel(cat)}</span>` : ''}
      </div>
      <div class="day-hero-name">${c.colName || `Klim ${idx + 1}`}</div>
      <div class="day-hero-stats">
        <span><strong>${c.lengthKm.toFixed(1)}</strong> km</span>
        <span><strong>${c.gain}</strong> hm</span>
        <span><strong>${c.avgGrad}%</strong> gem.</span>
        <span><strong>${c.maxGrad}%</strong> max</span>
      </div>
      <div id="day-hero-profile" class="day-hero-profile"></div>
    </div>`;
  },

  // Compact pill list — profiles live in the map popup
  _renderClimbs(namedClimbs) {
    const el = document.getElementById('day-climbs');
    const gpx = this.gpxCache[`${this.currentDayIdx}-${this.routeType}`];
    if (!gpx) { el.innerHTML = ''; return; }

    const hasOverride = !!this._loadClimbDefs();
    const pills = (namedClimbs || []).map((c, i) => {
      const label = c.colName || `Klim ${i + 1}`;
      const unnamed = !c.colName;
      const cat = this._climbCategory(c);
      const badge = cat ? `<span class="col-pill-cat cat-${cat}">${cat === 'HC' ? 'HC' : cat}</span>` : '';
      return `<button class="col-pill${unnamed ? ' unnamed' : ''}" onclick="App._showClimbPopup(${i})" title="${c.endEle}m top">
        ${badge}<span class="col-pill-tri">▲</span>${label}
      </button>`;
    }).join('');

    const qi = this._queenIdx(namedClimbs);
    const heroHtml = qi >= 0 ? this._heroHtml(namedClimbs[qi], qi) : '';

    el.innerHTML = heroHtml + `<div class="climbs-bar">
      <span class="climbs-bar-label">Klimmen</span>
      <div class="col-pills">${pills || '<span class="climbs-empty">Geen klimmen gedetecteerd</span>'}</div>
      <div class="climbs-bar-actions">
        <button class="climb-action-btn" onclick="App._addClimb()" title="Nieuwe klim toevoegen">➕ Toevoegen</button>
        ${hasOverride ? `<button class="climb-action-btn" onclick="App._resetClimbs()" title="Terug naar automatisch gedetecteerd">↺ Auto</button>` : ''}
      </div>
    </div>`;

    if (qi >= 0) ChartView.renderClimbProfile(document.getElementById('day-hero-profile'), namedClimbs[qi]);
  },

  _showClimbPopup(idx) {
    const c = this._namedClimbs?.[idx];
    if (!c) return;

    const label = c.colName || `Klim ${idx + 1}`;
    const popup = document.getElementById('climb-popup');

    document.getElementById('popup-col-name').textContent = label;
    document.getElementById('popup-col-name').dataset.idx = idx;
    document.getElementById('popup-name-input').value = label;
    document.getElementById('popup-edit-row').classList.add('hidden');
    document.getElementById('popup-name-input').classList.add('hidden');

    const hasNext = idx < (this._namedClimbs?.length || 0) - 1;
    const autoCat = ChartView.categorize(c);
    const effCat  = this._climbCategory(c);
    const savedNote = this._loadClimbNote(idx);

    // C8: colour the popup accent + header chip by category
    popup.style.setProperty('--cat-color', ChartView._catColor(effCat));
    const chip = document.getElementById('popup-cat-chip');
    if (chip) {
      chip.textContent = effCat ? ChartView.catLabel(effCat) : '';
      chip.className = 'popup-cat-chip' + (effCat ? ` cat-${effCat}` : ' hidden');
    }

    document.getElementById('popup-stats').innerHTML = `
      <div class="popup-stat-row">
        <div class="popup-stat"><span class="pv">${c.lengthKm.toFixed(1)}</span><span class="pl">km</span></div>
        <div class="popup-stat"><span class="pv">${c.gain}</span><span class="pl">hm</span></div>
        <div class="popup-stat"><span class="pv">${c.avgGrad}%</span><span class="pl">gem.</span></div>
        <div class="popup-stat"><span class="pv">${c.maxGrad}%</span><span class="pl">max</span></div>
        <div class="popup-stat"><span class="pv">${c.startEle}m</span><span class="pl">start</span></div>
        <div class="popup-stat"><span class="pv">${c.endEle}m</span><span class="pl">top</span></div>
      </div>
      <div class="popup-edit-tools">
        <button class="popup-tool-btn" onclick="App._toggleGeomEdit()" title="Start- en eindpunt aanpassen">✏️ Start/Top</button>
        ${hasNext ? `<button class="popup-tool-btn" onclick="App._mergeClimbWithNext(${idx})" title="Samenvoegen met volgende klim">🔗 Samenvoegen</button>` : ''}
        <button class="popup-tool-btn danger" onclick="App._deleteClimb(${idx})" title="Klim verwijderen">🗑 Verwijderen</button>
      </div>
      <div id="popup-geom-row" class="popup-geom-row hidden">
        <label class="popup-geom-label">Start <input id="popup-start-input" type="number" step="0.1" min="0" value="${c.startDistKm.toFixed(1)}" class="popup-geom-input"> km</label>
        <label class="popup-geom-label">Top <input id="popup-end-input" type="number" step="0.1" min="0" value="${c.endDistKm.toFixed(1)}" class="popup-geom-input"> km</label>
        <button class="popup-save-btn" onclick="App._saveClimbGeometry(${idx})">Opslaan</button>
      </div>
      <div class="popup-cat-row">
        <span class="popup-cat-label">Categorie</span>
        <span class="cat-badge cat-${effCat || 'none'}">${effCat ? ChartView.catLabel(effCat) : 'n.v.t.'}</span>
        <select class="popup-cat-select" onchange="App._setClimbCategory(${idx}, this.value)">
          <option value="auto"${!c.cat ? ' selected' : ''}>Auto${autoCat ? ` (${ChartView.catLabel(autoCat)})` : ''}</option>
          <option value="HC"${c.cat === 'HC' ? ' selected' : ''}>HC</option>
          <option value="1"${c.cat === '1' ? ' selected' : ''}>Cat 1</option>
          <option value="2"${c.cat === '2' ? ' selected' : ''}>Cat 2</option>
          <option value="3"${c.cat === '3' ? ' selected' : ''}>Cat 3</option>
          <option value="4"${c.cat === '4' ? ' selected' : ''}>Cat 4</option>
          <option value="none"${c.cat === 'none' ? ' selected' : ''}>Geen</option>
        </select>
      </div>
      <button class="btn-promote-kom" onclick="App._promoteClimbToKom(${idx})" title="Stel in als KOM segment">⏱ Stel in als KOM</button>
      <div class="popup-link-row">
        ${c.colUrl
          ? `<a href="${c.colUrl}" target="_blank" class="cyclingcols-link">Bekijk op cyclingcols.com ↗</a>
             <button class="popup-link-edit" onclick="App._toggleUrlEdit()" title="Link wijzigen">✏️</button>`
          : `<button class="popup-tool-btn" onclick="App._toggleUrlEdit()" title="Cyclingcols-link toevoegen">🔗 Link toevoegen</button>`}
      </div>
      <div id="popup-url-row" class="popup-geom-row hidden">
        <input id="popup-url-input" type="url" placeholder="https://www.cyclingcols.com/col/..." value="${c.colUrl || ''}" class="popup-url-input">
        <button class="popup-save-btn" onclick="App._saveClimbUrl(${idx})">Opslaan</button>
      </div>
      <div class="popup-note">
        <label class="popup-note-label">📝 Notitie</label>
        <textarea id="popup-note-input" class="popup-note-input" placeholder="bijv. café bovenaan, mooi uitzicht, lastige bocht..." oninput="App._saveClimbNote(${idx})">${savedNote}</textarea>
      </div>`;

    ChartView.renderClimbProfile(document.getElementById('popup-profile'), c);
    ChartView.renderLegend(document.getElementById('popup-legend'));

    popup.classList.remove('hidden');
    popup.dataset.idx = idx;
  },

  _saveClimbName() {
    const popup = document.getElementById('climb-popup');
    const idx = parseInt(popup.dataset.idx);
    const name = document.getElementById('popup-name-input').value.trim();
    if (!name) return;

    if (this._namedClimbs[idx]) this._namedClimbs[idx].colName = name;

    // If a climb override is active, store the name inside it; else use the legacy per-climb key
    const defs = this._loadClimbDefs();
    if (defs) {
      if (defs[idx]) { defs[idx].colName = name; this._saveClimbDefs(defs); }
    } else {
      localStorage.setItem(this._climbKey(idx), name);
    }

    document.getElementById('popup-col-name').textContent = name;
    document.getElementById('popup-edit-row').classList.add('hidden');
    MapView.updateClimbMarkerLabel(idx, name);
    // Refresh pills
    this._renderClimbs(this._namedClimbs);
  },

  _noteKey(idx) { return `note-${this.trip.year}-${this.currentDayIdx}-${this.routeType}-${idx}`; },
  _loadClimbNote(idx) { return localStorage.getItem(this._noteKey(idx)) || ''; },
  _saveClimbNote(idx) {
    const v = document.getElementById('popup-note-input')?.value || '';
    if (v.trim()) localStorage.setItem(this._noteKey(idx), v);
    else localStorage.removeItem(this._noteKey(idx));
  },

  _toggleUrlEdit() {
    document.getElementById('popup-url-row')?.classList.toggle('hidden');
    document.getElementById('popup-url-input')?.focus();
  },

  _saveClimbUrl(idx) {
    let url = document.getElementById('popup-url-input').value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (this._namedClimbs[idx]) this._namedClimbs[idx].colUrl = url || null;

    const defs = this._loadClimbDefs();
    if (defs) {
      if (defs[idx]) { defs[idx].colUrl = url || null; this._saveClimbDefs(defs); }
    } else {
      if (url) localStorage.setItem(this._colUrlKey(idx), url);
      else     localStorage.removeItem(this._colUrlKey(idx));
    }
    this._showClimbPopup(idx);
  },

  _setClimbCategory(idx, val) {
    // val: 'auto' (clear override) | 'HC' | '1'..'4' | 'none' (explicitly no category)
    const cat = val === 'auto' ? null : val;
    if (this._namedClimbs[idx]) this._namedClimbs[idx].cat = cat;

    const defs = this._loadClimbDefs();
    if (defs) {
      if (defs[idx]) { defs[idx].cat = cat; this._saveClimbDefs(defs); }
    } else {
      if (cat) localStorage.setItem(this._colCatKey(idx), cat);
      else     localStorage.removeItem(this._colCatKey(idx));
    }
    this._renderClimbs(this._namedClimbs);
    this._refreshChart();
    this._showClimbPopup(idx);
  },

  _promoteClimbToKom(idx) {
    const c = this._namedClimbs?.[idx];
    if (!c) return;

    // Save as timedSegment in localStorage
    const komKey = `kom-${this.trip.year}-${this.currentDayIdx}-${this.routeType}`;
    const komData = {
      name: c.colName || `Klim ${idx + 1}`,
      startDistKm: c.startDistKm,
      km: c.lengthKm,
      gradient: c.avgGrad,
      stravaUrl: null
    };
    localStorage.setItem(komKey, JSON.stringify(komData));

    // Re-render the altitude chart with the new KOM
    const cacheKey = `${this.currentDayIdx}-${this.routeType}`;
    const gpx = this.gpxCache[cacheKey];
    ChartView.render('altitude-chart', gpx, komData, point => MapView.showHoverMarker(point), this._namedClimbs);

    // Close popup
    document.getElementById('climb-popup').classList.add('hidden');

    // Visual feedback
    alert(`${komData.name} geselecteerd als KOM segment!`);
  },

  _getTimedSegment() {
    // Check for saved KOM first (from promoted climb)
    const komKey = `kom-${this.trip.year}-${this.currentDayIdx}-${this.routeType}`;
    const saved = localStorage.getItem(komKey);
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    // Fall back to trip data
    return this.trip.days[this.currentDayIdx]?.timedSegment;
  },

  _initDayMap() {
    MapView.init('day-map', this.trip.center, this.trip.defaultZoom);
    const cacheKey = `${this.currentDayIdx}-${this.routeType}`;
    const dayIdx   = this.currentDayIdx;
    MapView.map.on('load', () => {
      MapView.map.resize(); // ensure container dimensions are final
      const gpx = this.gpxCache[cacheKey];
      if (gpx) {
        MapView.showRoute(gpx);
        MapView.showClimbMarkers(this._namedClimbs, gpx.points, idx => this._showClimbPopup(idx));
        this._enableChartSync(gpx);
      }
      // Restore saved lunch marker for this day
      const saved = this._loadLunch(dayIdx);
      if (saved) MapView.showLunchMarker(saved, () => this._removeLunch(dayIdx));
    });
  },

  _bindDayEvents() {
    // Climb popup events
    document.getElementById('popup-close-btn').onclick = () =>
      document.getElementById('climb-popup').classList.add('hidden');
    document.getElementById('popup-edit-btn').onclick = () => {
      document.getElementById('popup-edit-row').classList.remove('hidden');
      document.getElementById('popup-name-input').focus();
      document.getElementById('popup-name-input').select();
    };
    document.getElementById('popup-save-btn').onclick = () => this._saveClimbName();
    document.getElementById('popup-name-input').onkeydown = e => {
      if (e.key === 'Enter') this._saveClimbName();
      if (e.key === 'Escape') document.getElementById('popup-edit-row').classList.add('hidden');
    };
    document.getElementById('climb-popup').onclick = e => e.stopPropagation();
    document.getElementById('day-map').addEventListener('click', () =>
      document.getElementById('climb-popup').classList.add('hidden'), { passive: true });

    // Lunch marker
    document.getElementById('btn-lunch').onclick = () => this._startLunchPlacement();

    // Share day as image
    document.getElementById('btn-share').onclick = () => this._shareDayImage();

    // GPX replace
    document.getElementById('btn-replace-gpx').onclick = () =>
      document.getElementById('file-replace-gpx').click();
    document.getElementById('file-replace-gpx').onchange = e => {
      if (e.target.files[0]) { this._loadGpxFile(e.target.files[0]); e.target.value = ''; }
    };

    document.getElementById('btn-animate').onclick = () => {
      const gpx = this.gpxCache[`${this.currentDayIdx}-${this.routeType}`];
      if (!gpx) { alert('Upload eerst een GPX bestand.'); return; }
      const btn = document.getElementById('btn-animate');
      if (MapView._isAnimating) { MapView.stopAnimation(); btn.textContent = '▶ Animeer'; }
      else {
        btn.textContent = '⏹ Stop';
        MapView.animate(gpx, p => { if (p === 1) btn.textContent = '▶ Animeer'; });
      }
    };
    document.getElementById('btn-reset-cam').onclick = () =>
      MapView.resetCamera(this.gpxCache[`${this.currentDayIdx}-${this.routeType}`], this.trip);

    document.getElementById('btn-long').onclick  = () => { this.routeType = 'long';  this._switchRoute(); };
    document.getElementById('btn-short').onclick = () => { this.routeType = 'short'; this._switchRoute(); };

    const dropZone = document.getElementById('gpx-drop-zone');
    const fileInput = document.getElementById('file-gpx');
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => { if (e.target.files[0]) this._loadGpxFile(e.target.files[0]); });
    dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) this._loadGpxFile(e.dataTransfer.files[0]);
    });
  },

  _switchRoute() {
    this._updateRouteToggle();
    const day = this.trip.days[this.currentDayIdx];
    this._renderDayContent(day);
    MapView.stopAnimation();
    document.getElementById('btn-animate').textContent = '▶ Animeer';
    MapView._clearRoute(false); // keep lunch marker
    const gpx = this.gpxCache[`${this.currentDayIdx}-${this.routeType}`];
    if (gpx) {
      MapView.showRoute(gpx);
      MapView.showClimbMarkers(this._namedClimbs, gpx.points, idx => this._showClimbPopup(idx));
      this._enableChartSync(gpx);
    }
    // Restore lunch if saved
    const lunch = this._loadLunch(this.currentDayIdx);
    if (lunch && !MapView._lunchMarker)
      MapView.showLunchMarker(lunch, () => this._removeLunch(this.currentDayIdx));
  },

  _updateRouteToggle() {
    document.getElementById('btn-long').classList.toggle('active',  this.routeType === 'long');
    document.getElementById('btn-short').classList.toggle('active', this.routeType === 'short');
  },

  // ─── LUNCH SPOTS ─────────────────────────────────────────────────────────

  _lunchKey(dayIdx) { return `lunch-${this.trip.year}-${dayIdx}`; },

  _loadLunch(dayIdx) {
    const raw = localStorage.getItem(this._lunchKey(dayIdx));
    return raw ? JSON.parse(raw) : null;
  },

  _saveLunch(dayIdx, lngLat) {
    localStorage.setItem(this._lunchKey(dayIdx), JSON.stringify(lngLat));
  },

  _removeLunch(dayIdx) {
    localStorage.removeItem(this._lunchKey(dayIdx));
    MapView.removeLunchMarker();
    document.getElementById('btn-lunch').textContent = '🍽️ Lunch';
    document.getElementById('btn-lunch').title = 'Klik op kaart om lunchplek te plaatsen';
  },

  _startLunchPlacement() {
    const btn = document.getElementById('btn-lunch');
    btn.textContent = '📍 Klik op kaart...';
    btn.classList.add('active');
    MapView.enableLunchPlacement(lngLat => {
      btn.textContent = '🍽️ Lunch ✓';
      btn.classList.remove('active');
      this._saveLunch(this.currentDayIdx, lngLat);
      MapView.showLunchMarker(lngLat, () => this._removeLunch(this.currentDayIdx));
    });
  },

  // ─── GPX REPLACE ─────────────────────────────────────────────────────────

  _loadGpxFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const gpx = GPXParser.parse(e.target.result);
      if (!gpx) { alert('Kon GPX bestand niet lezen.'); return; }
      const key = `${this.currentDayIdx}-${this.routeType}`;
      this.gpxCache[key] = gpx;
      // New GPX = different route data → discard any climb edits for this slot
      localStorage.removeItem(this._climbsOverrideKey());
      // Re-render everything with new GPX
      this._namedClimbs = this._computeClimbs(gpx);
      const timedSeg = this._getTimedSegment();
      ChartView.render('altitude-chart', gpx, timedSeg, point => MapView.showHoverMarker(point), this._namedClimbs);
      this._renderClimbs(this._namedClimbs);
      MapView._clearRoute();
      MapView.showRoute(gpx);
      MapView.showClimbMarkers(this._namedClimbs, gpx.points, idx => this._showClimbPopup(idx));
      this._enableChartSync(gpx);
      const gpxEl = document.getElementById('day-gpx-upload');
      gpxEl.querySelector('.gpx-drop-zone p').textContent =
        `✅ GPX vervangen (${(gpx.totalDistM/1000).toFixed(1)} km, ${gpx.totalGain} hm)`;
      gpxEl.querySelector('.gpx-icon').textContent = '✅';
    };
    reader.readAsText(file);
  },

  // ─── SHARE DAY AS IMAGE ──────────────────────────────────────────────────

  _shareDayImage() {
    const day = this.trip.days[this.currentDayIdx];
    const route = day[this.routeType === 'long' ? 'longRoute' : 'shortRoute'] || day.longRoute;
    const chart = document.getElementById('altitude-chart');

    const W = 1080, H = 620;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1c1c1c'); bg.addColorStop(1, '#0b0b0b');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FC4C02'; ctx.fillRect(0, 0, W, 8);

    ctx.textBaseline = 'top';
    ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#FC4C02';
    ctx.fillText(`${day.emoji} ${day.theme}${day.funName ? ' — ' + day.funName : ''}`, 40, 36);
    ctx.font = 'bold 40px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(this._truncate(ctx, route?.name || day.label, W - 80), 40, 72);

    ctx.font = '600 23px sans-serif'; ctx.fillStyle = '#cccccc';
    const stats = `${route?.km || 0} km    •    ${(route?.hm || 0).toLocaleString()} hm    •    ${route?.hmPerKm || 0} hm/km`;
    ctx.fillText(stats, 40, 132);

    const cw = W - 80, chH = 320, chY = 184;
    ctx.fillStyle = '#141414'; ctx.fillRect(40, chY, cw, chH);
    if (chart) { try { ctx.drawImage(chart, 40, chY, cw, chH); } catch (e) {} }

    ctx.font = '600 18px sans-serif'; ctx.fillStyle = '#888';
    ctx.fillText(`Fietsweek ${this.trip.year} — ${this.trip.destination}`, 40, H - 44);

    cv.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dag-${day.dayNum}-${day.label}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  },

  _truncate(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  },

  // ─── SHARED ──────────────────────────────────────────────────────────────

  _showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');
    if (name === 'overview' || name === 'day') setTimeout(() => MapView.map?.resize(), 50);
  },

  _setupNav(title, backFn) {
    document.getElementById('nav').classList.remove('hidden');
    document.getElementById('nav-title').textContent = title;
    document.getElementById('btn-back').onclick = backFn;
    document.getElementById('btn-home').onclick = () => this._renderHome();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
