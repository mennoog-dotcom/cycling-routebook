const App = {
  trip: null,
  currentDayIdx: null,
  routeType: 'long',
  overviewRouteType: 'long',
  gpxCache: {},

  isEditor: false,

  init() {
    this._initEditorMode();
    this._applyTheme();
    document.getElementById('btn-theme')?.addEventListener('click', () => this._toggleTheme());
    document.getElementById('btn-competition')?.addEventListener('click', () => { if (this.trip) this._renderCompetition(); });
    this._renderHome();
    this._bindHomeEvents();
  },

  // ─── EDITOR MODE ─────────────────────────────────────────────────────────
  // Editing is URL-only: it is unlocked ONLY when the current URL has ?edit=1,
  // and is never persisted. So the normal link is always fully read-only for
  // everyone — no drag-to-reorder, no editable text fields, no editor buttons.
  // The owner adds ?edit=1 to the URL to edit. This is a UI gate, not security:
  // a static site has no backend, so any change only touches that browser.
  _initEditorMode() {
    const params = new URLSearchParams(location.search);
    this.isEditor = params.get('edit') === '1';
    // Remove the legacy persisted flag from older builds so it can't "stick".
    localStorage.removeItem('editor');
    document.documentElement.classList.toggle('editor', this.isEditor);
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
    this.competition = window[`COMPETITION_${year}`] || null;
    document.getElementById('btn-competition').style.display = this.competition ? '' : 'none';
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

  // ─── DAY ORDER (calendar slots vs. ride content) ─────────────────────────
  // The `days` array holds the ride CONTENT (routes, climbs, notes, lunch).
  // All per-day storage is keyed by a day's index in that array, so content
  // never moves. Reordering only changes which calendar SLOT each ride sits
  // in: `dayOrder[slotPosition] = contentIndex`. Slot position p borrows its
  // calendar identity (weekday label + day number) from days[p].
  _dayOrderKey() { return `dayorder-${this.trip.year}`; },

  _dayOrder() {
    const n = this.trip.days.length;
    const identity = Array.from({ length: n }, (_, i) => i);
    const ok = a => Array.isArray(a) && a.length === n &&
      a.every(x => Number.isInteger(x) && x >= 0 && x < n) && new Set(a).size === n;
    const raw = localStorage.getItem(this._dayOrderKey());
    if (raw) { try { const a = JSON.parse(raw); if (ok(a)) return a; } catch (e) {} }
    if (ok(this.trip.bakedDayOrder)) return this.trip.bakedDayOrder.slice();
    return identity;
  },

  _saveDayOrder(order) {
    localStorage.setItem(this._dayOrderKey(), JSON.stringify(order));
  },

  _resetDayOrder() {
    localStorage.removeItem(this._dayOrderKey());
    this._renderDayCards();
  },

  // Calendar slot (label/dayNum/id) for a given content-day index.
  _slotFor(contentIdx) {
    const pos = this._dayOrder().indexOf(contentIdx);
    return this.trip.days[pos >= 0 ? pos : contentIdx];
  },

  _reorderDays(fromPos, toPos) {
    const order = this._dayOrder();
    if (fromPos === toPos || fromPos < 0 || toPos < 0) return;
    const [moved] = order.splice(fromPos, 1);
    order.splice(toPos, 0, moved);
    this._saveDayOrder(order);
    this._renderDayCards();
  },

  // Icon for a day: custom inline SVG (e.g. the Tour de France yellow jersey
  // for the day we visit the race) with the emoji as fallback.
  _dayIcon(day) {
    if (day && day.icon === 'jersey-yellow') {
      return `<span class="day-svg-icon" title="Maillot Jaune — we bezoeken de Tour vandaag" aria-label="Gele trui">` +
        `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" role="img">` +
        `<path d="M8.6 2.5 3.2 5.4 5 9.6l2.2-1.1V21.2h9.6V8.5L19 9.6l1.8-4.2-5.4-2.9a3.4 3.4 0 0 1-6.8 0Z" ` +
        `fill="#FFD400" stroke="#d9a400" stroke-width="0.7" stroke-linejoin="round"/>` +
        `<path d="M8.6 2.5a3.4 3.4 0 0 0 6.8 0" fill="none" stroke="#d9a400" stroke-width="0.7"/>` +
        `<rect x="10.4" y="12" width="3.2" height="5.2" rx="0.4" fill="#111" opacity="0.18"/>` +
        `</svg></span>`;
    }
    return day?.emoji || '';
  },

  // ─── TOUGHNESS RATING (1–5 stars) ────────────────────────────────────────
  // GPX-driven so it adapts automatically when routes change. Raw effort =
  // elevation gain + 10 per km. Stars are scaled within each route pool (long /
  // short) so the hardest long route AND the hardest short route both hit 5★.
  _routeRaw(dayIdx, routeType) {
    const gpx = this.gpxCache[`${dayIdx}-${routeType}`];
    if (gpx && gpx.totalDistM) return gpx.totalGain + (gpx.totalDistM / 1000) * 10;
    const day = this.trip.days[dayIdx];
    const r = routeType === 'long' ? day?.longRoute : day?.shortRoute;
    return r ? (r.hm || 0) + (r.km || 0) * 10 : 0;
  },

  _maxRouteRaw(routeType) {
    let m = 0;
    this.trip.days.forEach((d, i) => { const r = this._routeRaw(i, routeType); if (r > m) m = r; });
    return m || 1;
  },

  _toughKey(dayIdx, routeType) { return `tough-${this.trip.year}-${dayIdx}-${routeType}`; },

  // Manual rating override (editor): localStorage → baked → null (= auto).
  _loadToughOverride(dayIdx, routeType) {
    const raw = localStorage.getItem(this._toughKey(dayIdx, routeType));
    if (raw != null) { const n = parseFloat(raw); if (!isNaN(n)) return n; }
    const baked = this.trip.bakedToughness?.[`${dayIdx}-${routeType}`];
    return (typeof baked === 'number') ? baked : null;
  },

  _saveToughOverride(dayIdx, routeType, val) {
    const key = this._toughKey(dayIdx, routeType);
    if (val == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(val));
  },

  // Auto toughness from GPX (distance + climbing), scaled within the route pool.
  _autoToughnessStars(dayIdx, routeType) {
    const raw = this._routeRaw(dayIdx, routeType);
    if (!raw) return 0;
    let s = raw / this._maxRouteRaw(routeType) * 5;
    s = Math.round(s * 2) / 2;
    return Math.min(5, Math.max(0.5, s));
  },

  _toughnessStars(dayIdx, routeType) {
    const override = this._loadToughOverride(dayIdx, routeType);
    if (override != null) return Math.min(5, Math.max(0.5, override));
    return this._autoToughnessStars(dayIdx, routeType);
  },

  // Editable star widget (editor mode): click a star half to set the rating,
  // ↺ resets to the automatic value.
  _editableStarsHtml(dayIdx, routeType) {
    const cur = this._toughnessStars(dayIdx, routeType);
    const isOverride = this._loadToughOverride(dayIdx, routeType) != null;
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      const fill = Math.max(0, Math.min(1, cur - (i - 1))) * 100;
      stars += `<span class="te-star">` +
        `<span class="te-bg">★</span>` +
        `<span class="te-fill" style="width:${fill}%">★</span>` +
        `<span class="te-half te-left" data-val="${i - 0.5}"></span>` +
        `<span class="te-half te-right" data-val="${i}"></span>` +
      `</span>`;
    }
    return `<span class="tough-edit" data-day="${dayIdx}" data-rt="${routeType}" title="Klik om de zwaarte aan te passen">` +
      stars +
      `<button class="te-clear${isOverride ? ' active' : ''}" title="${isOverride ? 'Terug naar automatische zwaarte' : 'Automatisch berekend'}">↺</button>` +
    `</span>`;
  },

  _bindToughEdit() {
    document.querySelectorAll('.tough-edit').forEach(widget => {
      const dayIdx = +widget.dataset.day, rt = widget.dataset.rt;
      widget.querySelectorAll('.te-half').forEach(half => {
        half.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          this._saveToughOverride(dayIdx, rt, parseFloat(half.dataset.val));
          this._renderDayContent(this.trip.days[this.currentDayIdx]);
        });
      });
      const clear = widget.querySelector('.te-clear');
      if (clear) clear.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        this._saveToughOverride(dayIdx, rt, null);
        this._renderDayContent(this.trip.days[this.currentDayIdx]);
      });
    });
  },

  _starsHtml(stars, extraClass = '') {
    if (!stars) return '';
    const pct = (stars / 5) * 100;
    const label = (Number.isInteger(stars) ? stars : stars.toFixed(1)).toString().replace('.', ',');
    return `<span class="tough-stars ${extraClass}" title="Zwaarte ${label} / 5">` +
      `<span class="tough-stars-bg">★★★★★</span>` +
      `<span class="tough-stars-fg" style="width:${pct}%">★★★★★</span></span>`;
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
    const baseTitle = this.trip.bakedTitle || defaultTitle;
    overviewTitle.textContent = savedTitle || baseTitle;
    if (this.isEditor && !overviewTitle.dataset.editBound) {
      overviewTitle.contentEditable = true;
      overviewTitle.className = 'editable-title';
      overviewTitle.dataset.editBound = '1';
      overviewTitle.addEventListener('blur', () => {
        const val = overviewTitle.textContent.trim();
        if (val) localStorage.setItem(`trip-title-${this.trip.year}`, val);
        else overviewTitle.textContent = baseTitle;
      });
      overviewTitle.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); overviewTitle.blur(); }
      });
    }

    document.getElementById('overview-stats').innerHTML = `
      <div class="stat-pill">🚴 ${riding.length} ritdagen</div>
      <div class="stat-pill">📏 ${Math.round(totalKm)} km</div>
      <div class="stat-pill">⛰️ ${totalHm.toLocaleString()} hm</div>
      <div class="stat-pill">📍 ${this.trip.basecamp}</div>`;

    this.overviewRouteType = 'long';

    // Combined klimpunten box + climbers' ranking (collapsible)
    this._renderClassement();

    // Day cards (in calendar-slot order; draggable to reorder in editor mode)
    this._renderDayCards();

    this._renderGpxDownloadHelper();

    const printBtn = document.getElementById('btn-print');
    if (printBtn) printBtn.onclick = () => this._printRoadbook();

    const bakeBtn = document.getElementById('btn-bake');
    if (bakeBtn) bakeBtn.onclick = () => this._exportBaked();

    // Map: init then show all routes
    MapView.init('overview-map', this.trip.center, this.trip.defaultZoom);
    MapView.map.on('load', () => {
      MapView.showAllRoutes(this.gpxCache, this.overviewRouteType, this.trip);
    });
    this._bindOverviewMapEvents();
    // Hover/click a route on the map → spotlight its card, open the day on click
    MapView.enableOverviewHover({
      onEnter: idx => this._spotlightDay(idx),
      onLeave: () => this._spotlightDay(null),
      onClick: idx => this.openDay(idx, this.overviewRouteType)
    });
  },

  _renderDayCards() {
    const ed = this.isEditor;
    const order = this._dayOrder();
    const reordered = order.some((c, p) => c !== p);

    const rt = this.overviewRouteType || 'long';
    const html = order.map((contentIdx, pos) => {
      const day  = this.trip.days[contentIdx];  // ride content
      const slot = this.trip.days[pos];          // calendar identity for this slot
      const hasRide = !!(day.longRoute || day.shortRoute);
      const L = day.longRoute, S = day.shortRoute;
      const dotColor = MapView.DAY_COLORS[contentIdx] || '#FC4C02';
      const dragAttrs = ed ? `draggable="true" data-pos="${pos}"` : '';
      const click = hasRide ? `onclick="App.openDay(${contentIdx})"` : '';
      // Toughness for the toggled route type, falling back to the day's other route
      const starRt = (rt === 'short' ? S : L) ? rt : (L ? 'long' : 'short');
      const stars = hasRide ? this._toughnessStars(contentIdx, starRt) : 0;
      return `<div class="day-card ${hasRide ? 'clickable' : 'rest-day'}${ed ? ' draggable-card' : ''}" data-content="${contentIdx}" ${dragAttrs} ${click}>
        <div class="day-card-top">
          <div class="day-card-left">
            ${ed ? '<span class="day-drag-handle" title="Sleep om dagen te wisselen">⠿ sleep</span>' : ''}
            <div class="day-card-emoji" style="${hasRide ? `border-left: 3px solid ${dotColor}; padding-left:6px` : ''}">${this._dayIcon(day)}</div>
            <div class="day-card-label">
              <span class="day-name">Dag ${slot.dayNum} · ${slot.label}</span>
              <span class="day-theme">${day.theme}</span>
            </div>
          </div>
          ${hasRide ? `<div class="day-card-right">${this._starsHtml(stars)}<span class="day-card-arrow">›</span></div>` : ''}
        </div>
        ${hasRide ? `<div class="day-card-routes">
          ${L ? `<div class="day-route-row"><span class="route-badge long">Lang</span>
            <span class="route-name-sm">${this._esc(this._loadRouteName(contentIdx, 'long'))}</span>
            <span class="route-stats-sm">${L.km} km · ${(L.hm||0).toLocaleString()} hm · ${L.hmPerKm} hm/km${L.duration ? ' · '+L.duration : ''}</span>
          </div>` : ''}
          ${S ? `<div class="day-route-row"><span class="route-badge short">Kort</span>
            <span class="route-name-sm">${this._esc(this._loadRouteName(contentIdx, 'short'))}</span>
            <span class="route-stats-sm">${S.km} km · ${(S.hm||0).toLocaleString()} hm · ${S.hmPerKm} hm/km${S.duration ? ' · '+S.duration : ''}</span>
          </div>` : ''}
        </div>` : `<div class="day-card-rest">${day.comments || 'Rustdag'}</div>`}
      </div>`;
    }).join('');

    const editorHint = ed
      ? `<div class="day-reorder-bar">
           <span class="day-reorder-hint">↕ Sleep dagen om ritten van dag te wisselen (weekdagen blijven staan).</span>
           ${reordered ? '<button class="day-reorder-reset" onclick="App._resetDayOrder()">↺ Standaardvolgorde</button>' : ''}
         </div>`
      : '';

    document.getElementById('overview-days').innerHTML = editorHint + html;
    if (ed) this._bindDayReorder();
    this._bindDayCardHover();
  },

  // Hover a day card → spotlight its route on the map and dim the others.
  _bindDayCardHover() {
    const container = document.getElementById('overview-days');
    if (!container) return;
    container.querySelectorAll('.day-card[data-content]').forEach(card => {
      const idx = +card.dataset.content;
      card.addEventListener('mouseenter', () => this._spotlightDay(idx));
      card.addEventListener('mouseleave', () => this._spotlightDay(null));
    });
  },

  // Single source of truth for the overview spotlight: highlights one day's
  // route on the map and the matching card(s) in the list. Pass null to clear.
  _spotlightDay(contentIdx) {
    MapView.highlightOverviewRoute(contentIdx);
    document.querySelectorAll('#overview-days .day-card[data-content]').forEach(card => {
      const match = +card.dataset.content === contentIdx;
      card.classList.toggle('spotlight', contentIdx != null && match);
      card.classList.toggle('dimmed', contentIdx != null && !match);
    });
    document.querySelectorAll('.rank-row[data-content]').forEach(row => {
      row.classList.toggle('spotlight', contentIdx != null && +row.dataset.content === contentIdx);
    });
  },

  _bindDayReorder() {
    const container = document.getElementById('overview-days');
    if (!container) return;
    let dragPos = null;
    container.querySelectorAll('.draggable-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        dragPos = +card.dataset.pos;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(dragPos)); } catch (_) {}
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        container.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
        dragPos = null;
      });
      card.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (+card.dataset.pos !== dragPos) card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        let from = dragPos;
        if (from == null) { const d = +e.dataTransfer.getData('text/plain'); from = isNaN(d) ? null : d; }
        const to = +card.dataset.pos;
        card.classList.remove('drag-over');
        if (from != null) this._reorderDays(from, to);
      });
    });
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

  // Switch the whole overview (map + cards + classement) to a route type.
  _setOverviewRouteType(rt) {
    this.overviewRouteType = rt;
    const btnLong = document.getElementById('ov-btn-long');
    const btnShort = document.getElementById('ov-btn-short');
    const btnAnimate = document.getElementById('ov-btn-animate');
    btnLong?.classList.toggle('active', rt === 'long');
    btnShort?.classList.toggle('active', rt === 'short');
    MapView.stopAnimation();
    if (btnAnimate) btnAnimate.textContent = '▶ Animeer week';
    MapView.showAllRoutes(this.gpxCache, rt, this.trip);
    this._renderDayCards();    // toughness stars depend on route type
    this._renderClassement();  // klimpunten + ranking depend on route type
  },

  // Combined klimpunten box + climbers' ranking (Bergklassement). The summary
  // (points · cols · badges) is the always-visible header; clicking it expands
  // a dropdown with the full per-climb ranking. GPX-driven and toggles with the
  // overview long/short switch.
  _renderClassement() {
    const hero = document.querySelector('.overview-hero');
    if (!hero) return;
    let box = document.getElementById('overview-score');
    if (!box) { box = document.createElement('div'); box.id = 'overview-score'; box.className = 'week-score'; hero.appendChild(box); }

    const rt = this.overviewRouteType || 'long';
    const PTS = { HC: 10, '1': 6, '2': 4, '3': 2, '4': 1 };
    const order = this._dayOrder();
    const entries = [];

    this.trip.days.forEach((day, idx) => {
      const hasRoute = rt === 'long' ? day.longRoute : day.shortRoute;
      if (!hasRoute) return;
      const slot = this.trip.days[order.indexOf(idx)] || day;
      this._climbsForDay(idx, rt).forEach(c => {
        const cat = this._climbCategory(c);
        if (!cat) return;
        entries.push({
          idx, cat, points: PTS[cat] || 0,
          name: c.colName || 'Naamloze klim',
          lengthKm: c.lengthKm || 0, avgGrad: c.avgGrad || 0,
          slotLabel: slot.label,
          slotShort: (slot.id || '').replace(/^(\w)(\w).*/, (m, a, b) => a.toUpperCase() + b),
          color: MapView.DAY_COLORS[idx] || '#FC4C02'
        });
      });
    });

    entries.sort((a, b) => b.points - a.points ||
      (b.lengthKm * b.avgGrad * b.avgGrad) - (a.lengthKm * a.avgGrad * a.avgGrad));
    const total = entries.reduce((s, e) => s + e.points, 0);
    const n = entries.length;
    const rtLabel = rt === 'long' ? 'lange' : 'korte';
    const open = !!this._classementOpen;

    const counts = {};
    entries.forEach(e => counts[e.cat] = (counts[e.cat] || 0) + 1);
    const badges = ['HC', '1', '2', '3', '4'].filter(k => counts[k]).map(k =>
      `<span class="week-badge cat-${k}">${counts[k]}× ${ChartView.catLabel(k)}</span>`).join('');

    const rows = entries.map((e, i) => `
      <div class="rank-row" data-content="${e.idx}" onclick="App.openDay(${e.idx}, '${rt}')" title="Open ${this._esc(e.slotLabel)}">
        <span class="rank-pos">${i + 1}</span>
        <span class="rank-cat cat-${e.cat}">${ChartView.catLabel(e.cat)}</span>
        <span class="rank-name">${this._esc(e.name)}</span>
        <span class="rank-day" style="--day-color:${e.color}">${e.slotShort}</span>
        <span class="rank-stats">${e.lengthKm.toFixed(1)} km · ${e.avgGrad}%</span>
        <span class="rank-pts">${e.points}</span>
      </div>`).join('');

    const dropdown = n
      ? `<div class="ranking-list">
          <div class="rank-row rank-header">
            <span class="rank-pos">#</span><span class="rank-cat">Cat</span>
            <span class="rank-name">Klim</span><span class="rank-day">Dag</span>
            <span class="rank-stats">Lengte · %</span><span class="rank-pts">Pt</span>
          </div>
          ${rows}
        </div>`
      : `<div class="ranking-empty">Geen gecategoriseerde klimmen op de ${rtLabel} routes.</div>`;

    box.innerHTML = `
      <button class="ws-toggle" aria-expanded="${open}" title="Klik voor het volledige bergklassement">
        <span class="ws-pts">${total}</span>
        <span class="ws-pts-label">klimpunten · ${n} cols · ${rtLabel} routes</span>
        <span class="ws-caret">${open ? '▴' : '▾'}</span>
      </button>
      <div class="week-badges">${badges}</div>
      <div class="ws-dropdown${open ? ' open' : ''}">${dropdown}</div>`;

    box.querySelector('.ws-toggle').addEventListener('click', () => {
      this._classementOpen = !this._classementOpen;
      this._renderClassement();
    });
    box.querySelectorAll('.rank-row[data-content]').forEach(row => {
      const idx = +row.dataset.content;
      row.addEventListener('mouseenter', () => this._spotlightDay(idx));
      row.addEventListener('mouseleave', () => this._spotlightDay(null));
    });
  },

  _bindOverviewMapEvents() {
    const btnLong    = document.getElementById('ov-btn-long');
    const btnShort   = document.getElementById('ov-btn-short');
    const btnAnimate = document.getElementById('ov-btn-animate');

    btnLong.onclick  = () => this._setOverviewRouteType('long');
    btnShort.onclick = () => this._setOverviewRouteType('short');
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
    this._dayOrder().forEach((contentIdx, pos) => {
      const day = this.trip.days[contentIdx];
      const slot = this.trip.days[pos];
      if (day.longRoute?.strava)  routes.push({ label: `${slot.label} – Lang`, name: day.longRoute.name,  strava: day.longRoute.strava });
      if (day.shortRoute?.strava) routes.push({ label: `${slot.label} – Kort`, name: day.shortRoute.name, strava: day.shortRoute.strava });
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

  // ─── PRINTABLE ROADBOOK (A3 landscape) ───────────────────────────────────

  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  // Compute named climbs (with profiles, honouring overrides/baked edits) for
  // an arbitrary day/route without disturbing the currently open day.
  _climbsForPrint(dayIdx, routeType, gpx) {
    const sd = this.currentDayIdx, st = this.routeType;
    this.currentDayIdx = dayIdx; this.routeType = routeType;
    let climbs = [];
    try { climbs = this._computeClimbs(gpx) || []; } catch (e) {}
    this.currentDayIdx = sd; this.routeType = st;
    return climbs;
  },

  async _printRoadbook() {
    const overlay = this._showPrintOverlay('Roadbook voorbereiden… kaart van de week renderen');
    try {
      const pages = [];

      // 1) Overview page (week map + summary)
      const ovImg = await MapView.captureAllRoutesImage(this.gpxCache, 'long', this.trip, { width: 1500, height: 560 });
      pages.push(this._roadbookOverviewPage(ovImg));

      // 2) One page per existing route (long + short)
      const printOrder = this._dayOrder();
      for (let p = 0; p < printOrder.length; p++) {
        const i = printOrder[p];
        const day = this.trip.days[i];
        const slot = this.trip.days[p];
        for (const rt of ['long', 'short']) {
          const route = rt === 'long' ? day.longRoute : day.shortRoute;
          const gpx = this.gpxCache[`${i}-${rt}`];
          if (!route || !gpx) continue;
          this._updatePrintOverlay(overlay,
            `Kaart Dag ${slot.dayNum} — ${slot.label} (${rt === 'long' ? 'lang' : 'kort'})…`);
          const img = await MapView.captureRouteImage(gpx, { width: 1500, height: 620 });
          const climbs = this._climbsForPrint(i, rt, gpx);
          pages.push(this._roadbookStagePage(day, rt, route, gpx, img, climbs, slot));
        }
      }

      let root = document.getElementById('print-root');
      if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
      root.innerHTML = pages.join('');

      document.body.classList.add('printing-roadbook');
      const cleanup = () => {
        document.body.classList.remove('printing-roadbook');
        root.innerHTML = '';
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);

      this._removePrintOverlay(overlay);
      // Let layout settle (images decode) before opening the print dialog
      await new Promise(r => setTimeout(r, 350));
      window.print();
    } catch (e) {
      this._removePrintOverlay(overlay);
      alert('Roadbook maken is mislukt: ' + (e?.message || e));
    }
  },

  _roadbookOverviewPage(ovImg) {
    const trip = this.trip;
    const title = localStorage.getItem(`trip-title-${trip.year}`) || trip.bakedTitle || `Fietsweek ${trip.year} — ${trip.destination}`;
    const riding = trip.days.filter(d => d.longRoute || d.shortRoute);
    const totalKm = riding.reduce((s, d) => s + (d.longRoute?.km || 0), 0);
    const totalHm = riding.reduce((s, d) => s + (d.longRoute?.hm || 0), 0);
    const ws = this._weekStats();
    const order = ['HC', '1', '2', '3', '4'];
    const badges = order.filter(k => ws.counts[k]).map(k =>
      `<span class="pr-badge cat-${k}">${ws.counts[k]}× ${ChartView.catLabel(k)}</span>`).join('');

    const rows = this._dayOrder().map((contentIdx, pos) => {
      const day = trip.days[contentIdx];
      const slot = trip.days[pos];
      const r = day.longRoute || day.shortRoute;
      if (!r) return `<tr class="pr-rest"><td>${slot.dayNum}</td><td>${this._esc(slot.label)}</td>
        <td colspan="4">${this._esc(day.comments || day.theme || 'Rustdag')}</td></tr>`;
      const climbs = this._climbsForPrint(contentIdx, day.longRoute ? 'long' : 'short',
        this.gpxCache[`${contentIdx}-${day.longRoute ? 'long' : 'short'}`]);
      const named = climbs.filter(c => this._climbCategory(c)).length;
      return `<tr>
        <td>${slot.dayNum}</td>
        <td>${this._esc(slot.label)}</td>
        <td class="pr-rt">${this._esc(r.name || day.theme || '')}</td>
        <td class="pr-num">${r.km} km</td>
        <td class="pr-num">${(r.hm || 0).toLocaleString()} hm</td>
        <td class="pr-num">${named} cols</td>
      </tr>`;
    }).join('');

    const mapHtml = ovImg
      ? `<img class="pr-ov-map" src="${ovImg}" alt="Overzichtskaart">`
      : `<div class="pr-map-missing">Kaart kon niet worden geladen</div>`;

    return `<section class="print-page pr-overview">
      <header class="pr-head">
        <h1>${this._esc(title)}</h1>
        <div class="pr-sub">📍 ${this._esc(trip.basecamp || '')} · ${riding.length} ritdagen · ${Math.round(totalKm)} km · ${totalHm.toLocaleString()} hm</div>
      </header>
      <div class="pr-ov-grid">
        <div class="pr-ov-left">
          <div class="pr-score"><span class="pr-score-pts">${ws.total}</span> klimpunten · ${ws.n} cols deze week</div>
          <div class="pr-badges">${badges}</div>
          <table class="pr-table">
            <thead><tr><th>Dag</th><th></th><th>Route</th><th>Afstand</th><th>Klim</th><th>Cols</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="pr-ov-right">${mapHtml}</div>
      </div>
      <footer class="pr-foot">${this._esc(title)} · gegenereerd ${new Date().toLocaleDateString('nl-NL')}</footer>
    </section>`;
  },

  _roadbookStagePage(day, rt, route, gpx, img, climbs, slot) {
    slot = slot || this._slotFor(this.trip.days.indexOf(day));
    const rtLabel = rt === 'long' ? 'Lange route' : 'Korte route';
    const stageSvg = ChartView.stageProfileSVG(gpx, climbs, { width: 1000, height: 210 });
    const legend = `<div class="pr-legend">
      ${[['<3%', '#6b7280'], ['3–5%', '#22c55e'], ['5–8%', '#eab308'], ['8–11%', '#f97316'], ['11–15%', '#ef4444'], ['>15%', '#7c3aed']]
        .map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>`;

    const cat = climbs.filter(c => this._climbCategory(c));
    const climbCards = (climbs || []).map((c, i) => {
      const ccat = this._climbCategory(c);
      const badge = ccat ? `<span class="pr-cc-badge cat-${ccat}">${ChartView.catLabel(ccat)}</span>` : '';
      const name = this._esc(c.colName || `Klim ${i + 1}`);
      const note = this._loadClimbNoteFor(this.trip.days.indexOf(day), rt, i);
      return `<div class="pr-climb">
        <div class="pr-climb-head">${badge}<span class="pr-climb-name">${name}</span></div>
        <div class="pr-climb-stats">${c.lengthKm.toFixed(1)} km · ${c.gain} hm · ${c.avgGrad}% gem · ${c.maxGrad}% max · top ${c.endEle} m</div>
        <div class="pr-climb-prof">${ChartView.climbProfileSVG(c)}</div>
        ${note ? `<div class="pr-climb-note">📝 ${this._esc(note)}</div>` : ''}
      </div>`;
    }).join('');

    const mapHtml = img
      ? `<img class="pr-stage-map" src="${img}" alt="Routekaart">`
      : `<div class="pr-map-missing">Kaart kon niet worden geladen</div>`;

    const dayIdx = this.trip.days.indexOf(day);
    const y = this.trip.year;
    const bs = this.trip.bakedStage?.[`${dayIdx}-${rt}`] || {};

    let desc = localStorage.getItem(`stagedesc-${y}-${dayIdx}-${rt}`);
    if (desc == null) desc = bs.description != null ? bs.description : day.description;

    let seg = bs.timedSegment || day.timedSegment;
    const segRaw = localStorage.getItem(`kom-${y}-${dayIdx}-${rt}`);
    if (segRaw) { try { seg = JSON.parse(segRaw); } catch (e) {} }

    let coffee = bs.coffee || null;
    const coffeeRaw = localStorage.getItem(`coffee-${y}-${dayIdx}-${rt}`);
    if (coffeeRaw) { try { coffee = JSON.parse(coffeeRaw); } catch (e) {} }

    const notes = [];
    if (desc) notes.push(`📖 ${this._esc(desc)}`);
    if (seg) notes.push(`⏱ Getimed: ${this._esc(seg.name)}${seg.km != null ? ' · ' + seg.km + ' km' : ''}${seg.gradient != null ? ' · ' + seg.gradient + '%' : ''}`);
    if (coffee && (coffee.text || coffee.mapsUrl)) notes.push(`☕ Koffie/lunch: ${this._esc(coffee.text || '')}`);
    if (day.alternative) notes.push(`🔀 ${this._esc(day.alternative)}`);

    return `<section class="print-page pr-stage">
      <header class="pr-head">
        <h1>${this._dayIcon(day)} Dag ${slot.dayNum} — ${this._esc(slot.label)} <span class="pr-rt-tag">${rtLabel}</span></h1>
        <div class="pr-sub">${this._esc(this._loadRouteName(dayIdx, rt) || day.theme || '')}${day.funName ? ' · ' + this._esc(day.funName) : ''}</div>
      </header>
      <div class="pr-stage-stats">
        <span><b>${route.km}</b> km</span>
        <span><b>${(route.hm || 0).toLocaleString()}</b> hm</span>
        <span><b>${route.hmPerKm}</b> hm/km</span>
        ${route.duration ? `<span><b>${this._esc(route.duration)}</b> duur</span>` : ''}
        <span><b>${cat.length}</b> cols</span>
      </div>
      <div class="pr-stage-grid">
        <div class="pr-stage-map-wrap">${mapHtml}</div>
        <div class="pr-stage-prof-wrap">
          <div class="pr-prof-title">Hoogteprofiel</div>
          ${stageSvg}
          ${legend}
          ${notes.length ? `<div class="pr-notes">${notes.map(n => `<div>${n}</div>`).join('')}</div>` : ''}
        </div>
      </div>
      ${climbCards ? `<div class="pr-climbs-title">Klimmen</div><div class="pr-climbs">${climbCards}</div>` : ''}
    </section>`;
  },

  _loadClimbNoteFor(dayIdx, routeType, idx) {
    return localStorage.getItem(`note-${this.trip.year}-${dayIdx}-${routeType}-${idx}`) || '';
  },

  _showPrintOverlay(msg) {
    const el = document.createElement('div');
    el.id = 'print-overlay';
    el.innerHTML = `<div class="print-overlay-box">
      <div class="print-spinner"></div>
      <div class="print-overlay-msg">${this._esc(msg)}</div>
    </div>`;
    document.body.appendChild(el);
    return el;
  },
  _updatePrintOverlay(el, msg) {
    const m = el?.querySelector('.print-overlay-msg');
    if (m) m.textContent = msg;
  },
  _removePrintOverlay(el) { el?.remove(); },

  // ─── DAY PAGE ────────────────────────────────────────────────────────────

  openDay(idx, routeType) {
    this.currentDayIdx = idx;
    const day = this.trip.days[idx];
    // Honour the requested route type when it exists for this day, else fall back
    this.routeType = (routeType === 'short' && day?.shortRoute) ? 'short'
      : (routeType === 'long' && day?.longRoute) ? 'long'
      : (day?.longRoute ? 'long' : 'short');
    MapView.highlightOverviewRoute(null);
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
    const slot = this._slotFor(this.currentDayIdx);
    this._showScreen('day');
    this._setupNav(`Dag ${slot.dayNum} — ${slot.label}`, () => this._renderOverview());
    document.getElementById('btn-long').style.display  = day.longRoute  ? '' : 'none';
    document.getElementById('btn-short').style.display = day.shortRoute ? '' : 'none';
    this._updateRouteToggle();
    this._renderDayContent(day);
    this._initDayMap();
    this._bindDayEvents();
  },

  // ─── EDITABLE STAGE NAME (route name per day+route type) ─────────────────
  _routeNameKey(dayIdx, rt) { return `routename-${this.trip.year}-${dayIdx}-${rt}`; },

  _routeDefaultName(dayIdx, rt) {
    const day = this.trip.days[dayIdx];
    const r = rt === 'long' ? day?.longRoute : day?.shortRoute;
    return r?.name || '';
  },

  // Priority: localStorage override → baked trip.js routeName → route default.
  _loadRouteName(dayIdx, rt) {
    const ls = localStorage.getItem(this._routeNameKey(dayIdx, rt));
    if (ls != null) return ls;
    const baked = this.trip.bakedStage?.[`${dayIdx}-${rt}`]?.routeName;
    if (baked != null) return baked;
    return this._routeDefaultName(dayIdx, rt);
  },

  _saveRouteName(dayIdx, rt, val) {
    const key = this._routeNameKey(dayIdx, rt);
    const def = this._routeDefaultName(dayIdx, rt);
    const baked = this.trip.bakedStage?.[`${dayIdx}-${rt}`]?.routeName;
    // Clear the override when it matches the default and there's no baked name
    if (!val || (val === def && baked == null)) localStorage.removeItem(key);
    else localStorage.setItem(key, val);
  },

  _bindRouteNameEdit() {
    const el = document.getElementById('day-route-name-el');
    if (!el) return;
    el.addEventListener('blur', () => {
      this._saveRouteName(this.currentDayIdx, this.routeType, el.textContent.trim());
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    });
  },

  // ─── EDITABLE SUBHEADER (theme — funName, per day) ───────────────────────
  _subheaderKey(dayIdx) { return `subheader-${this.trip.year}-${dayIdx}`; },

  _subheaderDefault(dayIdx) {
    const day = this.trip.days[dayIdx];
    if (!day) return '';
    return `${day.theme || ''}${day.funName ? ' — ' + day.funName : ''}`;
  },

  // Priority: localStorage override → baked trip.js subheader → theme — funName.
  _loadSubheader(dayIdx) {
    const ls = localStorage.getItem(this._subheaderKey(dayIdx));
    if (ls != null) return ls;
    const baked = this.trip.bakedSubheader?.[dayIdx];
    if (baked != null) return baked;
    return this._subheaderDefault(dayIdx);
  },

  _saveSubheader(dayIdx, val) {
    const key = this._subheaderKey(dayIdx);
    const def = this._subheaderDefault(dayIdx);
    const baked = this.trip.bakedSubheader?.[dayIdx];
    if (!val || (val === def && baked == null)) localStorage.removeItem(key);
    else localStorage.setItem(key, val);
  },

  _bindSubheaderEdit() {
    const el = document.getElementById('day-sub-el');
    if (!el) return;
    el.addEventListener('blur', () => {
      this._saveSubheader(this.currentDayIdx, el.textContent.trim());
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    });
  },

  _renderDayContent(day) {
    const route = day[this.routeType === 'long' ? 'longRoute' : 'shortRoute'] || day.longRoute;
    const slot = this._slotFor(this.currentDayIdx);

    const stars = this._toughnessStars(this.currentDayIdx, this.routeType);
    const toughHtml = this.isEditor
      ? `<span class="day-tough">Zwaarte ${this._editableStarsHtml(this.currentDayIdx, this.routeType)}</span>`
      : (stars ? `<span class="day-tough">Zwaarte ${this._starsHtml(stars)}</span>` : '');
    const routeName = this._loadRouteName(this.currentDayIdx, this.routeType) || slot.label;
    const nameAttrs = this.isEditor ? ' id="day-route-name-el" contenteditable="true" spellcheck="false" title="Klik om de etappenaam aan te passen"' : '';
    const subheader = this._loadSubheader(this.currentDayIdx);
    const subAttrs = this.isEditor ? ' id="day-sub-el" contenteditable="true" spellcheck="false" title="Klik om de ondertitel aan te passen"' : '';
    document.getElementById('day-header').innerHTML = `
      <div class="day-big-emoji">${this._dayIcon(day)}</div>
      <div>
        <div class="day-theme-label${this.isEditor ? ' editable-sub' : ''}"${subAttrs}>${this._esc(subheader)}</div>
        <h2 class="day-route-name${this.isEditor ? ' editable-route' : ''}"${nameAttrs}>${this._esc(routeName)}</h2>
        <div class="day-dayname">${slot.label} · Dag ${slot.dayNum}${toughHtml ? ' · ' + toughHtml : ''}</div>
      </div>`;
    if (this.isEditor) {
      this._bindToughEdit();
      this._bindRouteNameEdit();
      this._bindSubheaderEdit();
    }

    document.getElementById('day-stats').innerHTML = route ? `
      <div class="stat-box"><div class="stat-value">${route.km}</div><div class="stat-label">km</div></div>
      <div class="stat-box"><div class="stat-value">${(route.hm||0).toLocaleString()}</div><div class="stat-label">hoogtemeters</div></div>
      <div class="stat-box"><div class="stat-value">${route.hmPerKm}</div><div class="stat-label">hm/km</div></div>
      ${route.duration ? `<div class="stat-box"><div class="stat-value">${route.duration}</div><div class="stat-label">duur</div></div>` : ''}
      <a href="${route.strava}" target="_blank" class="strava-link">Bekijk op Strava ↗</a>` : '';

    // Description + timed segment + coffee/lunch + alternative + comments
    this._renderDayNotes(day);

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

  // ─── EDITABLE STAGE NOTES (description / timed segment / coffee-lunch) ─────
  // Editor sees inline editable fields; visitors see read-only display.
  // Values persist per day+route in localStorage, falling back to trip.js data.

  _stageDescKey() { return `stagedesc-${this.trip.year}-${this.currentDayIdx}-${this.routeType}`; },
  _komKey()       { return `kom-${this.trip.year}-${this.currentDayIdx}-${this.routeType}`; },
  _coffeeKey()    { return `coffee-${this.trip.year}-${this.currentDayIdx}-${this.routeType}`; },

  // Baked stage edits for the current day/route (permanent, committed in trip.js).
  _bakedStage() {
    return this.trip.bakedStage?.[`${this.currentDayIdx}-${this.routeType}`] || null;
  },

  // Priority: personal localStorage override → baked trip.js value → trip.js day default.
  _loadStageDesc() {
    const s = localStorage.getItem(this._stageDescKey());
    if (s != null) return s;
    const baked = this._bakedStage();
    if (baked && baked.description != null) return baked.description;
    return this.trip.days[this.currentDayIdx]?.description || '';
  },
  _saveStageDesc() {
    const v = document.getElementById('stage-desc-input')?.value ?? '';
    localStorage.setItem(this._stageDescKey(), v);
  },

  _loadCoffee() {
    const raw = localStorage.getItem(this._coffeeKey());
    if (raw) { try { return JSON.parse(raw); } catch (e) {} }
    const baked = this._bakedStage();
    if (baked && baked.coffee) return baked.coffee;
    return null;
  },
  _saveCoffee() {
    const text = (document.getElementById('coffee-text')?.value || '').trim();
    let url = (document.getElementById('coffee-url')?.value || '').trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (!text && !url) localStorage.removeItem(this._coffeeKey());
    else localStorage.setItem(this._coffeeKey(), JSON.stringify({ text, mapsUrl: url || null }));
    this._renderDayNotes(this.trip.days[this.currentDayIdx]);
  },

  _saveTimedSegment() {
    const name = (document.getElementById('seg-name')?.value || '').trim();
    const km   = parseFloat(document.getElementById('seg-km')?.value);
    const grad = parseFloat(document.getElementById('seg-grad')?.value);
    let url    = (document.getElementById('seg-url')?.value || '').trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;

    if (!name && isNaN(km) && isNaN(grad) && !url) {
      localStorage.removeItem(this._komKey());
    } else {
      const existing = this._getTimedSegment() || {};
      const seg = {
        name: name || existing.name || 'Getimed segment',
        km: isNaN(km) ? (existing.km ?? null) : km,
        gradient: isNaN(grad) ? (existing.gradient ?? null) : grad,
        stravaUrl: url || null
      };
      if (existing.startDistKm != null) seg.startDistKm = existing.startDistKm;
      localStorage.setItem(this._komKey(), JSON.stringify(seg));
    }
    this._refreshChart();
    this._renderDayNotes(this.trip.days[this.currentDayIdx]);
  },

  _renderDayNotes(day) {
    const ed = this.isEditor;
    const desc = this._loadStageDesc();
    const seg = this._getTimedSegment();
    const coffee = this._loadCoffee();
    let html = '';

    // Beschrijving / etappe-notitie
    if (ed) {
      html += `<div class="notes-box note-edit">
        <span class="notes-icon">📖</span>
        <div class="note-edit-body">
          <label class="note-edit-label">Beschrijving</label>
          <textarea id="stage-desc-input" class="stage-edit-textarea" placeholder="Beschrijving van de etappe..." oninput="App._saveStageDesc()">${this._esc(desc)}</textarea>
        </div>
      </div>`;
    } else if (desc && desc.trim()) {
      html += `<div class="notes-box"><span class="notes-icon">📖</span><span>${this._esc(desc)}</span></div>`;
    }

    // Getimed segment
    if (ed) {
      html += `<div class="notes-box timed-seg note-edit">
        <span class="notes-icon">⏱</span>
        <div class="note-edit-body">
          <label class="note-edit-label">Getimed segment</label>
          <div class="stage-edit-grid">
            <input id="seg-name" class="stage-edit-input" placeholder="Naam segment" value="${this._esc(seg?.name || '')}">
            <input id="seg-km" class="stage-edit-input narrow" type="number" step="0.1" min="0" placeholder="km" value="${seg?.km ?? ''}">
            <input id="seg-grad" class="stage-edit-input narrow" type="number" step="0.1" placeholder="% gem." value="${seg?.gradient ?? ''}">
            <input id="seg-url" class="stage-edit-input wide" type="url" placeholder="https://www.strava.com/segments/..." value="${this._esc(seg?.stravaUrl || '')}">
          </div>
          <button class="stage-save-btn" onclick="App._saveTimedSegment()">Segment opslaan</button>
        </div>
      </div>`;
    } else if (seg) {
      html += `<div class="notes-box timed-seg"><span class="notes-icon">⏱</span>
        <span><strong>Getimed segment:</strong> ${this._esc(seg.name)}${seg.km != null ? ' · ' + seg.km + ' km' : ''}${seg.gradient != null ? ' · ' + seg.gradient + '%' : ''}
        ${seg.stravaUrl ? `<a href="${this._esc(seg.stravaUrl)}" target="_blank" class="seg-link">Strava ↗</a>` : ''}</span></div>`;
    }

    // Koffie / lunch
    if (ed) {
      html += `<div class="notes-box coffee-box note-edit">
        <span class="notes-icon">☕</span>
        <div class="note-edit-body">
          <label class="note-edit-label">Koffie / lunch</label>
          <textarea id="coffee-text" class="stage-edit-textarea" placeholder="bv. Boulangerie in Beaufort, terras bovenaan de col...">${this._esc(coffee?.text || '')}</textarea>
          <input id="coffee-url" class="stage-edit-input wide" type="url" placeholder="https://maps.google.com/..." value="${this._esc(coffee?.mapsUrl || '')}">
          <button class="stage-save-btn" onclick="App._saveCoffee()">Koffie/lunch opslaan</button>
        </div>
      </div>`;
    } else if (coffee && (coffee.text || coffee.mapsUrl)) {
      html += `<div class="notes-box coffee-box"><span class="notes-icon">☕</span>
        <span>${coffee.text ? `<strong>Koffie / lunch:</strong> ${this._esc(coffee.text)}` : '<strong>Koffie / lunch</strong>'}
        ${coffee.mapsUrl ? `<a href="${this._esc(coffee.mapsUrl)}" target="_blank" class="seg-link">Google Maps ↗</a>` : ''}</span></div>`;
    }

    // Alternatief & opmerkingen (read-only uit trip.js, voor iedereen)
    if (day.alternative)
      html += `<div class="notes-box"><span class="notes-icon">🔀</span><span><strong>Alternatief:</strong> ${this._esc(day.alternative)}</span></div>`;
    if (day.comments)
      html += `<div class="notes-box"><span class="notes-icon">📝</span><span>${this._esc(day.comments)}</span></div>`;

    document.getElementById('day-notes').innerHTML = html;
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

  // Ensure an editable personal override exists when persisting a per-climb
  // edit (category, name, link). When climbs come from baked trip.js defs,
  // _computeClimbs uses the baked path and ignores the legacy per-index keys —
  // so without this the edit would silently revert on the next render. We snapshot
  // the current climbs into a personal override the first time so edits stick.
  // Returns the override array, or null when neither override nor baked defs exist.
  _ensureClimbDefs() {
    let defs = this._loadClimbDefs();
    if (!defs && this._bakedClimbDefs()) {
      defs = this._materializeClimbDefs();
      this._saveClimbDefs(defs);
    }
    return defs;
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

  // Export every edit (climbs, stage notes, timed segments, coffee/lunch,
  // map lunch pins and the trip title) into a JSON file that can be baked into
  // trip.js so the data is permanent and identical for every visitor.
  // The export is idempotent: already-baked values are carried forward, so a
  // re-bake never drops earlier edits even from a fresh browser.
  _exportBaked() {
    const y = this.trip.year;
    const bakedClimbs = {};
    const bakedStage  = {};
    const bakedLunch  = {};
    const bakedToughness = {};
    const bakedSubheader = {};
    const saveDay = this.currentDayIdx, saveRt = this.routeType;
    const counts = { climbs: 0, stage: 0, lunch: 0, tough: 0, sub: 0 };

    this.trip.days.forEach((day, di) => {
      // Map lunch pin (per day) — localStorage override, else carry baked forward
      const lunchRaw = localStorage.getItem(`lunch-${y}-${di}`);
      if (lunchRaw) { try { bakedLunch[di] = JSON.parse(lunchRaw); counts.lunch++; } catch (e) {} }
      else if (this.trip.bakedLunch?.[di]) bakedLunch[di] = this.trip.bakedLunch[di];

      // Subheader (theme — funName, per day)
      const subRaw = localStorage.getItem(`subheader-${y}-${di}`);
      if (subRaw != null) { bakedSubheader[di] = subRaw; counts.sub++; }
      else if (this.trip.bakedSubheader?.[di] != null) bakedSubheader[di] = this.trip.bakedSubheader[di];

      ['long', 'short'].forEach(rt => {
        const key = `${di}-${rt}`;
        this.currentDayIdx = di; this.routeType = rt;

        // ── Climbs ──
        const gpx = this.gpxCache[key];
        if (gpx) {
          const climbs = this._computeClimbs(gpx);
          const hasClimbEdits = !!localStorage.getItem(this._climbsOverrideKey()) ||
            !!this._bakedClimbDefs() ||
            climbs.some((c, idx) =>
              localStorage.getItem(this._climbKey(idx)) ||
              localStorage.getItem(this._colUrlKey(idx)) ||
              localStorage.getItem(this._colCatKey(idx)) ||
              localStorage.getItem(this._noteKey(idx)));
          if (hasClimbEdits) {
            counts.climbs++;
            bakedClimbs[key] = climbs.map((c, idx) => {
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
          }
        }

        // ── Stage notes (route name / description / timed segment / coffee-lunch) ──
        const bs = this.trip.bakedStage?.[key] || {};
        const entry = {};
        const lsName = localStorage.getItem(`routename-${y}-${di}-${rt}`);
        if (lsName != null) entry.routeName = lsName;
        else if (bs.routeName != null) entry.routeName = bs.routeName;

        const lsDesc = localStorage.getItem(`stagedesc-${y}-${di}-${rt}`);
        if (lsDesc != null) entry.description = lsDesc;
        else if (bs.description != null) entry.description = bs.description;

        const lsKom = localStorage.getItem(`kom-${y}-${di}-${rt}`);
        if (lsKom) { try { entry.timedSegment = JSON.parse(lsKom); } catch (e) {} }
        else if (bs.timedSegment) entry.timedSegment = bs.timedSegment;

        const lsCoffee = localStorage.getItem(`coffee-${y}-${di}-${rt}`);
        if (lsCoffee) { try { entry.coffee = JSON.parse(lsCoffee); } catch (e) {} }
        else if (bs.coffee) entry.coffee = bs.coffee;

        if (Object.keys(entry).length) { bakedStage[key] = entry; counts.stage++; }

        // ── Toughness rating override ──
        const lsTough = localStorage.getItem(`tough-${y}-${di}-${rt}`);
        if (lsTough != null) { const n = parseFloat(lsTough); if (!isNaN(n)) { bakedToughness[key] = n; counts.tough++; } }
        else if (typeof this.trip.bakedToughness?.[key] === 'number') bakedToughness[key] = this.trip.bakedToughness[key];
      });
    });
    this.currentDayIdx = saveDay; this.routeType = saveRt;

    // Trip title
    const bakedTitle = localStorage.getItem(`trip-title-${y}`) || this.trip.bakedTitle || null;

    // Day order (calendar-slot ↔ ride mapping) — only export if non-default
    const dayOrder = this._dayOrder();
    const dayOrderChanged = dayOrder.some((c, p) => c !== p);

    const out = {};
    if (bakedTitle) out.bakedTitle = bakedTitle;
    if (dayOrderChanged) out.bakedDayOrder = dayOrder;
    if (Object.keys(bakedClimbs).length) out.bakedClimbs = bakedClimbs;
    if (Object.keys(bakedStage).length)  out.bakedStage  = bakedStage;
    if (Object.keys(bakedLunch).length)  out.bakedLunch  = bakedLunch;
    if (Object.keys(bakedToughness).length) out.bakedToughness = bakedToughness;
    if (Object.keys(bakedSubheader).length) out.bakedSubheader = bakedSubheader;

    if (!Object.keys(out).length) {
      alert('Geen aanpassingen gevonden om te bakken.');
      return;
    }

    const json = JSON.stringify(out, null, 2);
    console.log('[bake] alle edits — plak de eigenschappen hieronder in trips/<jaar>/trip.js:\n' + json);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bake-${y}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    alert(
      `Geëxporteerd naar Downloads als bake-${y}.json.\n\n` +
      `Klimmen: ${counts.climbs} route(s)\nEtappe-notities: ${counts.stage} route(s)\nLunch-pins: ${counts.lunch}\nZwaarte-ratings: ${counts.tough} route(s)\nOndertitels: ${counts.sub}\n` +
      (bakedTitle ? 'Titel: ja\n' : '') +
      (dayOrderChanged ? 'Dagvolgorde: aangepast\n' : '') +
      `\nVervang/voeg de bovenste eigenschappen (bakedClimbs, bakedStage, bakedLunch, bakedToughness, bakedSubheader, bakedTitle) toe in trip.js. Het JSON-bestand staat ook in de console.`
    );
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

    const ed = this.isEditor;
    const statsHtml = `
      <div class="popup-stat-row">
        <div class="popup-stat"><span class="pv">${c.lengthKm.toFixed(1)}</span><span class="pl">km</span></div>
        <div class="popup-stat"><span class="pv">${c.gain}</span><span class="pl">hm</span></div>
        <div class="popup-stat"><span class="pv">${c.avgGrad}%</span><span class="pl">gem.</span></div>
        <div class="popup-stat"><span class="pv">${c.maxGrad}%</span><span class="pl">max</span></div>
        <div class="popup-stat"><span class="pv">${c.startEle}m</span><span class="pl">start</span></div>
        <div class="popup-stat"><span class="pv">${c.endEle}m</span><span class="pl">top</span></div>
      </div>`;

    const editToolsHtml = ed ? `
      <div class="popup-edit-tools">
        <button class="popup-tool-btn" onclick="App._toggleGeomEdit()" title="Start- en eindpunt aanpassen">✏️ Start/Top</button>
        ${hasNext ? `<button class="popup-tool-btn" onclick="App._mergeClimbWithNext(${idx})" title="Samenvoegen met volgende klim">🔗 Samenvoegen</button>` : ''}
        <button class="popup-tool-btn danger" onclick="App._deleteClimb(${idx})" title="Klim verwijderen">🗑 Verwijderen</button>
      </div>
      <div id="popup-geom-row" class="popup-geom-row hidden">
        <label class="popup-geom-label">Start <input id="popup-start-input" type="number" step="0.1" min="0" value="${c.startDistKm.toFixed(1)}" class="popup-geom-input"> km</label>
        <label class="popup-geom-label">Top <input id="popup-end-input" type="number" step="0.1" min="0" value="${c.endDistKm.toFixed(1)}" class="popup-geom-input"> km</label>
        <button class="popup-save-btn" onclick="App._saveClimbGeometry(${idx})">Opslaan</button>
      </div>` : '';

    const catHtml = `
      <div class="popup-cat-row">
        <span class="popup-cat-label">Categorie</span>
        <span class="cat-badge cat-${effCat || 'none'}">${effCat ? ChartView.catLabel(effCat) : 'n.v.t.'}</span>
        ${ed ? `<select class="popup-cat-select" onchange="App._setClimbCategory(${idx}, this.value)">
          <option value="auto"${!c.cat ? ' selected' : ''}>Auto${autoCat ? ` (${ChartView.catLabel(autoCat)})` : ''}</option>
          <option value="HC"${c.cat === 'HC' ? ' selected' : ''}>HC</option>
          <option value="1"${c.cat === '1' ? ' selected' : ''}>Cat 1</option>
          <option value="2"${c.cat === '2' ? ' selected' : ''}>Cat 2</option>
          <option value="3"${c.cat === '3' ? ' selected' : ''}>Cat 3</option>
          <option value="4"${c.cat === '4' ? ' selected' : ''}>Cat 4</option>
          <option value="none"${c.cat === 'none' ? ' selected' : ''}>Geen</option>
        </select>` : ''}
      </div>`;

    const komHtml = ed ? `<button class="btn-promote-kom" onclick="App._promoteClimbToKom(${idx})" title="Stel in als KOM segment">⏱ Stel in als KOM</button>` : '';

    const linkHtml = `
      <div class="popup-link-row">
        ${c.colUrl
          ? `<a href="${c.colUrl}" target="_blank" class="cyclingcols-link">Bekijk op cyclingcols.com ↗</a>
             ${ed ? `<button class="popup-link-edit" onclick="App._toggleUrlEdit()" title="Link wijzigen">✏️</button>` : ''}`
          : (ed ? `<button class="popup-tool-btn" onclick="App._toggleUrlEdit()" title="Cyclingcols-link toevoegen">🔗 Link toevoegen</button>` : '')}
      </div>
      ${ed ? `<div id="popup-url-row" class="popup-geom-row hidden">
        <input id="popup-url-input" type="url" placeholder="https://www.cyclingcols.com/col/..." value="${c.colUrl || ''}" class="popup-url-input">
        <button class="popup-save-btn" onclick="App._saveClimbUrl(${idx})">Opslaan</button>
      </div>` : ''}`;

    let noteHtml = '';
    if (ed) {
      noteHtml = `
      <div class="popup-note">
        <label class="popup-note-label">📝 Notitie</label>
        <textarea id="popup-note-input" class="popup-note-input" placeholder="bijv. café bovenaan, mooi uitzicht, lastige bocht..." oninput="App._saveClimbNote(${idx})">${savedNote}</textarea>
      </div>`;
    } else if (savedNote && savedNote.trim()) {
      noteHtml = `
      <div class="popup-note">
        <label class="popup-note-label">📝 Notitie</label>
        <p class="popup-note-readonly">${savedNote.replace(/</g, '&lt;')}</p>
      </div>`;
    }

    document.getElementById('popup-stats').innerHTML =
      statsHtml + editToolsHtml + catHtml + komHtml + linkHtml + noteHtml;

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

    // If a climb override is active (or baked defs need materializing), store the
    // name inside it; else use the legacy per-climb key.
    const defs = this._ensureClimbDefs();
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

    const defs = this._ensureClimbDefs();
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

    const defs = this._ensureClimbDefs();
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
    // Personal override (from editor edit or promoted KOM) wins
    const saved = localStorage.getItem(this._komKey());
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    // Then baked trip.js value, then the day default
    const baked = this._bakedStage();
    if (baked && baked.timedSegment) return baked.timedSegment;
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
    if (raw) { try { return JSON.parse(raw); } catch (e) {} }
    return this.trip.bakedLunch?.[dayIdx] || null;
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

  // Wipe all climb edits (override + legacy per-index name/url/cat/note keys)
  // for the current slot. Used when a new GPX is uploaded: the old edits and
  // baked defs are pinned to the previous track and no longer apply.
  _clearClimbEditKeys() {
    const y = this.trip.year, d = this.currentDayIdx, rt = this.routeType;
    localStorage.removeItem(`climbs-${y}-${d}-${rt}`);
    for (let i = 0; i < 60; i++) {
      localStorage.removeItem(`col-${y}-${d}-${rt}-${i}`);
      localStorage.removeItem(`colurl-${y}-${d}-${rt}-${i}`);
      localStorage.removeItem(`colcat-${y}-${d}-${rt}-${i}`);
      localStorage.removeItem(`note-${y}-${d}-${rt}-${i}`);
    }
  },

  _loadGpxFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const gpx = GPXParser.parse(e.target.result);
      if (!gpx) { alert('Kon GPX bestand niet lezen.'); return; }
      const key = `${this.currentDayIdx}-${this.routeType}`;
      this.gpxCache[key] = gpx;
      // New GPX = different route → discard stale climb edits for this slot,
      // then auto-detect climbs on the new track. Baked defs (if any) are pinned
      // to the OLD track's distances, so snapshot the fresh detection as the
      // editable override to bypass them and keep it bakeable.
      this._clearClimbEditKeys();
      if (this._bakedClimbDefs()) {
        this._namedClimbs = this._getNamedClimbs(gpx.climbs);
        this._saveClimbDefs(this._materializeClimbDefs());
      }
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
      const nClimbs = this._namedClimbs.length;
      gpxEl.querySelector('.gpx-drop-zone p').textContent =
        `✅ GPX vervangen (${(gpx.totalDistM/1000).toFixed(1)} km, ${gpx.totalGain} hm) — ${nClimbs} klim${nClimbs === 1 ? '' : 'men'} gedetecteerd`;
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

  // ─── KLASSEMENT (mini-KOM competition) ───────────────────────────────────

  _fmtTime(s) {
    if (s == null || isNaN(s)) return '—';
    s = Math.round(s);
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  },

  // Compute daily results + dual GC (time = yellow, points = green) from the
  // configured stages and the standings data (backend-produced or sample).
  _computeStandings() {
    const comp = this.competition;
    if (!comp) return null;
    const nameOf = {};
    (comp.riders || []).forEach(r => nameOf[r.id] = r.name);
    const scale = comp.pointsScale || [10, 8, 6, 5, 4, 3, 2, 1];
    const results = comp.standings?.stageResults || {};
    const PENALTY = 300; // seconds added to the slowest time when a rider misses a stage

    // Stages that actually have at least one time
    const slotOf = st => (st.slot != null ? st.slot : st.dayIdx);
    const stages = (comp.stages || [])
      .map(st => ({ ...st, slot: slotOf(st), entries: (results[slotOf(st)] || []).slice() }))
      .filter(st => st.entries.length);

    const perStage = stages.map(st => {
      const sorted = st.entries
        .filter(e => e.seconds != null)
        .sort((a, b) => a.seconds - b.seconds);
      const winner = sorted[0]?.seconds ?? null;
      const slowest = sorted[sorted.length - 1]?.seconds ?? null;
      const rows = sorted.map((e, i) => ({
        riderId: e.riderId, name: nameOf[e.riderId] || e.riderId,
        seconds: e.seconds, date: e.date,
        rank: i + 1, points: scale[i] || 0,
        gap: winner != null ? e.seconds - winner : 0
      }));
      const segIds = [...new Set([st.segLong, st.segShort, st.segmentId].filter(Boolean))];
      return { slot: st.slot, label: st.label, date: st.date, segIds, slowest, rows };
    });

    // Riders that have ridden at least one counted stage
    const active = new Set();
    perStage.forEach(s => s.rows.forEach(r => active.add(r.riderId)));

    // Time GC — sum of best times, penalty for missed counted stages
    const timeGC = [...active].map(id => {
      let total = 0, done = 0;
      perStage.forEach(s => {
        const row = s.rows.find(r => r.riderId === id);
        if (row) { total += row.seconds; done++; }
        else total += (s.slowest || 0) + PENALTY;
      });
      return { riderId: id, name: nameOf[id] || id, total, stagesDone: done };
    }).sort((a, b) => b.stagesDone - a.stagesDone || a.total - b.total);
    const tLeader = timeGC[0]?.total ?? 0;
    timeGC.forEach((r, i) => { r.rank = i + 1; r.gap = r.total - tLeader; });

    // Points GC — sum of stage points
    const pointsGC = [...active].map(id => {
      let pts = 0, done = 0;
      perStage.forEach(s => { const row = s.rows.find(r => r.riderId === id); if (row) { pts += row.points; done++; } });
      return { riderId: id, name: nameOf[id] || id, points: pts, stagesDone: done };
    }).sort((a, b) => b.points - a.points);
    pointsGC.forEach((r, i) => r.rank = i + 1);

    return { sample: !!comp.standings?.sample, updatedAt: comp.standings?.updatedAt, perStage, timeGC, pointsGC, nStages: perStage.length };
  },

  _renderCompetition() {
    this._showScreen('competition');
    this._setupNav('Klassement', () => this._renderOverview());
    // Pull live standings from the backend if configured (once per open).
    if (this.competition?.backendUrl && !this._standingsFetched) {
      this._standingsFetched = true;
      fetch(`${this.competition.backendUrl}/standings`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.stageResults) { this.competition.standings = data; this._renderCompetition(); }
        })
        .catch(() => {});
    }
    const el = document.getElementById('competition-content');
    const comp = this.competition;
    const s = this._computeStandings();

    if (!comp || !s || !s.nStages) {
      el.innerHTML = `<div class="comp-empty">
        <div class="comp-empty-icon">🏆</div>
        <h2>Klassement</h2>
        <p>Nog geen resultaten. Zodra de eerste tijden binnen zijn verschijnt hier het dag- en weekklassement.</p>
      </div>`;
      return;
    }

    const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `${r}`;

    const timeRows = s.timeGC.map(r => `
      <tr class="${r.rank === 1 ? 'gc-leader' : ''}">
        <td class="gc-pos">${medal(r.rank)}</td>
        <td class="gc-name">${this._esc(r.name)}</td>
        <td class="gc-val">${this._fmtTime(r.total)}</td>
        <td class="gc-gap">${r.rank === 1 ? '' : '+' + this._fmtTime(r.gap)}</td>
        <td class="gc-done">${r.stagesDone}/${s.nStages}</td>
      </tr>`).join('');

    const ptsRows = s.pointsGC.map(r => `
      <tr class="${r.rank === 1 ? 'gc-leader green' : ''}">
        <td class="gc-pos">${medal(r.rank)}</td>
        <td class="gc-name">${this._esc(r.name)}</td>
        <td class="gc-val">${r.points}</td>
        <td class="gc-done">${r.stagesDone}/${s.nStages}</td>
      </tr>`).join('');

    const stageCards = s.perStage.map(st => {
      const dayLabel = this.trip.days[st.slot]?.label || 'Dag';
      const rows = st.rows.map(r => `
        <div class="comp-stage-row${r.rank === 1 ? ' win' : ''}">
          <span class="csr-pos">${medal(r.rank)}</span>
          <span class="csr-name">${this._esc(r.name)}</span>
          <span class="csr-time">${this._fmtTime(r.seconds)}</span>
          <span class="csr-gap">${r.rank === 1 ? 'KOM' : '+' + this._fmtTime(r.gap)}</span>
          <span class="csr-pts">${r.points}</span>
        </div>`).join('');
      const segLink = (st.segIds || []).length
        ? `<a href="https://www.strava.com/segments/${st.segIds[0]}" target="_blank" class="comp-seg-link">segment ↗</a>` : '';
      return `<div class="comp-stage">
        <div class="comp-stage-head">
          <span class="comp-stage-day">${this._esc(dayLabel)}</span>
          <span class="comp-stage-seg">${this._esc(st.label)}</span>
          ${segLink}
        </div>
        <div class="comp-stage-rows">${rows}</div>
      </div>`;
    }).join('');

    const connectUrl = comp.backendUrl ? `${comp.backendUrl}/auth/start` : (comp.connectUrl || null);
    const connectBtn = connectUrl
      ? `<a href="${connectUrl}" class="comp-connect">🔗 Koppel je Strava</a>`
      : `<button class="comp-connect disabled" title="Beschikbaar zodra de Strava-koppeling live is" onclick="alert('De Strava-koppeling komt eraan. Zodra de backend live staat kun je hier je Strava verbinden en worden je tijden automatisch opgehaald.')">🔗 Koppel je Strava</button>`;

    const updated = s.updatedAt ? `Bijgewerkt: ${new Date(s.updatedAt).toLocaleString('nl-NL')}` : 'Automatisch via Strava (nog niet gekoppeld)';

    el.innerHTML = `
      <div class="comp-header">
        <div>
          <h1>🏆 Klassement</h1>
          <p class="comp-sub">Mini-KOM competitie · ${s.nStages} etappe(s) · ${updated}</p>
        </div>
        ${connectBtn}
      </div>
      ${s.sample ? '<div class="comp-sample">⚠️ Voorbeeldgegevens — echte tijden verschijnen zodra Strava gekoppeld is.</div>' : ''}

      <div class="comp-gc-grid">
        <div class="comp-gc yellow">
          <div class="comp-gc-title"><span class="jersey y">🟡</span> Algemeen klassement <small>(tijd)</small></div>
          <table class="comp-gc-table">
            <thead><tr><th></th><th>Renner</th><th>Totaal</th><th>Achterstand</th><th>Etappes</th></tr></thead>
            <tbody>${timeRows}</tbody>
          </table>
        </div>
        <div class="comp-gc green">
          <div class="comp-gc-title"><span class="jersey g">🟢</span> Puntenklassement <small>(KOM-punten)</small></div>
          <table class="comp-gc-table">
            <thead><tr><th></th><th>Renner</th><th>Punten</th><th>Etappes</th></tr></thead>
            <tbody>${ptsRows}</tbody>
          </table>
        </div>
      </div>

      <h2 class="comp-stages-title">Dagklassementen</h2>
      <div class="comp-stages">${stageCards}</div>`;
  },

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
