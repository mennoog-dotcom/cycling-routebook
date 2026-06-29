const MapView = {
  map: null,
  _animId: null,
  _animProgress: 0,
  _isAnimating: false,
  _ready: false,
  _pendingRoute: null,
  _overviewLayerIds: [],
  _climbMarkers: [],
  _climbOverlayIds: [],
  _lunchMarker: null,
  _smoothBearing: null,

  // Colours per day index (matches trip.days order)
  DAY_COLORS: ['#22c55e', '#3b82f6', '#FC4C02', null, '#a855f7', '#06b6d4', '#ec4899'],

  _isMobile() { return typeof window !== 'undefined' && window.innerWidth <= 820; },

  init(containerId, center, zoom) {
    if (this.map) { this.map.remove(); this.map = null; }
    this._ready = false;
    this._overviewLayerIds = [];

    this.map = new maplibregl.Map({
      container: containerId,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: center || [6.35, 45.75],
      zoom: zoom || 10,
      pitch: 55,
      bearing: -20,
      antialias: true
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');

    this.map.on('load', () => {
      this.map.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
        tileSize: 256,
        encoding: 'terrarium',
        maxzoom: 14
      });
      this.map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
      this.map.addLayer({
        id: 'hillshade-layer', type: 'hillshade', source: 'terrain-dem',
        paint: { 'hillshade-exaggeration': 0.25, 'hillshade-shadow-color': '#000' }
      });
      this._ready = true;
      if (this._pendingRoute) { this.showRoute(this._pendingRoute); this._pendingRoute = null; }
    });
  },

  // ── Overview: show all routes ────────────────────────────────────────────

  showAllRoutes(gpxCache, routeType, trip) {
    if (!this._ready) return;
    this._clearOverviewRoutes();

    const bounds = new maplibregl.LngLatBounds();
    let hasData = false;

    trip.days.forEach((day, dayIdx) => {
      const key = `${dayIdx}-${routeType}`;
      const fallback = `${dayIdx}-long`;
      const gpx = gpxCache[key] || (routeType === 'short' ? gpxCache[fallback] : null);
      if (!gpx) return;

      const color = this.DAY_COLORS[dayIdx] || '#FC4C02';
      const coords = gpx.points.map(p => [p.lng, p.lat]);
      const srcId = `ov-${dayIdx}`;

      this.map.addSource(srcId, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
      });
      const ovW = this._isMobile() ? 4.5 : 3.5;
      // White casing for contrast against terrain/roads
      this.map.addLayer({
        id: `${srcId}-glow`, type: 'line', source: srcId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': ovW + 3, 'line-opacity': 0.65 }
      });
      this.map.addLayer({
        id: `${srcId}-line`, type: 'line', source: srcId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': ovW, 'line-opacity': 1 }
      });

      // Start dot
      this.map.addSource(`${srcId}-start`, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] } }
      });
      this.map.addLayer({
        id: `${srcId}-startdot`, type: 'circle', source: `${srcId}-start`,
        paint: { 'circle-radius': 5, 'circle-color': color, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }
      });

      this._overviewLayerIds.push(srcId);
      coords.forEach(c => bounds.extend(c));
      hasData = true;
    });

    if (hasData) {
      this.map.fitBounds(bounds, { padding: 50, pitch: 50, bearing: -15, duration: 1200 });
    }
    this._attachOverviewHover();
  },

  // Spotlight one day's route (by content index); dim the rest. null = reset all.
  highlightOverviewRoute(activeIdx) {
    if (!this._ready) return;
    this._overviewLayerIds.forEach(srcId => {
      const dayIdx = +srcId.split('-')[1];
      const active = activeIdx == null || dayIdx === activeIdx;
      try {
        this.map.setPaintProperty(`${srcId}-line`, 'line-opacity', active ? 1 : 0.15);
        this.map.setPaintProperty(`${srcId}-glow`, 'line-opacity', active ? 0.65 : 0.05);
        this.map.setPaintProperty(`${srcId}-startdot`, 'circle-opacity', active ? 1 : 0.2);
        this.map.setPaintProperty(`${srcId}-startdot`, 'circle-stroke-opacity', active ? 1 : 0.2);
      } catch (e) {}
    });
    // Raise the active route above the others for a clean spotlight
    if (activeIdx != null) {
      try { if (this.map.getLayer(`ov-${activeIdx}-line`)) this.map.moveLayer(`ov-${activeIdx}-line`); } catch (e) {}
    }
  },

  // Register hover/click handlers for overview route lines. Handlers persist
  // across route-type switches; re-attached whenever the layers are rebuilt.
  enableOverviewHover(handlers) {
    this._ovHoverHandlers = handlers;
    this._attachOverviewHover();
  },

  _attachOverviewHover() {
    this._detachOverviewHover();
    const h = this._ovHoverHandlers;
    if (!h || !this._ready) return;
    this._ovHoverBindings = [];
    this._overviewLayerIds.forEach(srcId => {
      const dayIdx = +srcId.split('-')[1];
      const line = `${srcId}-line`;
      if (!this.map.getLayer(line)) return;
      const enter = () => { this.map.getCanvas().style.cursor = 'pointer'; h.onEnter && h.onEnter(dayIdx); };
      const leave = () => { this.map.getCanvas().style.cursor = ''; h.onLeave && h.onLeave(dayIdx); };
      const click = () => { h.onClick && h.onClick(dayIdx); };
      this.map.on('mouseenter', line, enter);
      this.map.on('mouseleave', line, leave);
      this.map.on('click', line, click);
      this._ovHoverBindings.push(['mouseenter', line, enter], ['mouseleave', line, leave], ['click', line, click]);
    });
  },

  _detachOverviewHover() {
    (this._ovHoverBindings || []).forEach(([t, l, f]) => { try { this.map.off(t, l, f); } catch (e) {} });
    this._ovHoverBindings = [];
  },

  // ── Static map snapshots for the printable roadbook ───────────────────────
  // These spin up a throwaway, off-screen 2-D map (preserveDrawingBuffer so the
  // canvas can be exported), draw the route(s), wait for tiles, then resolve a
  // PNG data-URL. A flat top-down view prints far more clearly than the 3-D one.
  _captureMap(width, height, drawFn) {
    return new Promise(resolve => {
      if (typeof maplibregl === 'undefined') { resolve(null); return; }
      const container = document.createElement('div');
      container.style.cssText = `position:absolute;left:-99999px;top:0;width:${width}px;height:${height}px;`;
      document.body.appendChild(container);

      let map, done = false;
      const finish = () => {
        if (done) return; done = true;
        let url = null;
        try { url = map.getCanvas().toDataURL('image/png'); } catch (e) {}
        try { map.remove(); } catch (e) {}
        container.remove();
        resolve(url);
      };

      try {
        map = new maplibregl.Map({
          container,
          style: 'https://tiles.openfreemap.org/styles/liberty',
          center: [6.35, 45.75], zoom: 9, pitch: 0, bearing: 0,
          interactive: false, attributionControl: false,
          preserveDrawingBuffer: true, fadeDuration: 0
        });
      } catch (e) { container.remove(); resolve(null); return; }

      map.on('error', () => {}); // ignore individual tile errors
      map.on('load', () => {
        try { drawFn(map); } catch (e) {}
        map.once('idle', finish);
        setTimeout(finish, 9000); // hard fallback so a slow tile never hangs print
      });
    });
  },

  captureRouteImage(gpxData, opts = {}) {
    const W = opts.width || 1400, H = opts.height || 620;
    return this._captureMap(W, H, map => {
      const coords = gpxData.points.map(p => [p.lng, p.lat]);
      map.addSource('r', { type: 'geojson', lineMetrics: true,
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
      map.addLayer({ id: 'r-case', type: 'line', source: 'r',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0a0a0a', 'line-width': 9, 'line-opacity': 0.5 } });
      const grad = this._gradientLinePaint(gpxData.points);
      map.addLayer({ id: 'r-line', type: 'line', source: 'r',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: grad ? { 'line-gradient': grad, 'line-width': 5 }
                    : { 'line-color': '#FC4C02', 'line-width': 5 } });
      map.addSource('r-s', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] } } });
      map.addSource('r-e', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: coords[coords.length - 1] } } });
      map.addLayer({ id: 'r-sd', type: 'circle', source: 'r-s', paint: { 'circle-radius': 7, 'circle-color': '#22c55e', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
      map.addLayer({ id: 'r-ed', type: 'circle', source: 'r-e', paint: { 'circle-radius': 7, 'circle-color': '#ef4444', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
      const b = gpxData.bounds;
      map.fitBounds([[b.minLng, b.minLat], [b.maxLng, b.maxLat]], { padding: 45, duration: 0 });
    });
  },

  captureAllRoutesImage(gpxCache, routeType, trip, opts = {}) {
    const W = opts.width || 1400, H = opts.height || 560;
    return this._captureMap(W, H, map => {
      const bounds = new maplibregl.LngLatBounds();
      let has = false;
      trip.days.forEach((day, idx) => {
        const gpx = gpxCache[`${idx}-${routeType}`] || gpxCache[`${idx}-long`];
        if (!gpx) return;
        const color = this.DAY_COLORS[idx] || '#FC4C02';
        const coords = gpx.points.map(p => [p.lng, p.lat]);
        const sid = `o${idx}`;
        map.addSource(sid, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
        map.addLayer({ id: sid + 'c', type: 'line', source: sid,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.7 } });
        map.addLayer({ id: sid + 'l', type: 'line', source: sid,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': color, 'line-width': 4 } });
        coords.forEach(c => bounds.extend(c));
        has = true;
      });
      if (has) map.fitBounds(bounds, { padding: 45, duration: 0 });
    });
  },

  animateAllRoutes(gpxCache, routeType, trip, onStateChange) {
    if (!this._ready) return;
    this.stopAnimation();

    // Build ordered sequence of all coordinates across all riding days
    const segments = [];
    trip.days.forEach((day, dayIdx) => {
      const key = `${dayIdx}-${routeType}`;
      const gpx = gpxCache[key] || gpxCache[`${dayIdx}-long`];
      if (!gpx || (!day.longRoute && !day.shortRoute)) return;
      segments.push({
        dayIdx,
        color: this.DAY_COLORS[dayIdx] || '#FC4C02',
        coords: gpx.points.map(p => [p.lng, p.lat])
      });
    });

    if (!segments.length) return;

    // Ensure rider dot exists
    if (!this.map.getSource('ov-rider')) {
      this.map.addSource('ov-rider', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Point', coordinates: segments[0].coords[0] } }
      });
      this.map.addLayer({
        id: 'ov-rider-ring', type: 'circle', source: 'ov-rider',
        paint: { 'circle-radius': 13, 'circle-color': 'rgba(255,255,255,0.2)', 'circle-opacity': 1 }
      });
      this.map.addLayer({
        id: 'ov-rider-dot', type: 'circle', source: 'ov-rider',
        paint: { 'circle-radius': 7, 'circle-color': '#fff', 'circle-stroke-width': 3, 'circle-stroke-color': '#FC4C02' }
      });
    }

    let segIdx = 0, ptIdx = 0;
    this._isAnimating = true;

    const step = () => {
      if (!this._isAnimating) return;

      const seg = segments[segIdx];
      if (!seg) {
        this.stopAnimation();
        if (onStateChange) onStateChange('done');
        return;
      }

      const coords = seg.coords;
      const SPEED = Math.max(1, Math.floor(coords.length / 900));

      if (ptIdx >= coords.length) {
        ptIdx = 0;
        segIdx++;
        // Short pause between routes, then fly to next start
        const next = segments[segIdx];
        if (next) {
          this.map.flyTo({ center: next.coords[0], zoom: 11, pitch: 55, duration: 1200 });
          setTimeout(() => { this._animId = requestAnimationFrame(step); }, 1300);
          return;
        } else {
          this.stopAnimation();
          if (onStateChange) onStateChange('done');
          return;
        }
      }

      const pos = coords[ptIdx];
      this.map.getSource('ov-rider')?.setData({
        type: 'Feature', geometry: { type: 'Point', coordinates: pos }
      });

      // Dim all routes, highlight current
      this._overviewLayerIds.forEach((srcId, i) => {
        const active = segments[segIdx] && i === trip.days.findIndex((_, di) => di === seg.dayIdx);
        try {
          this.map.setPaintProperty(`${srcId}-line`, 'line-opacity', active ? 0.95 : 0.25);
          this.map.setPaintProperty(`${srcId}-glow`, 'line-opacity', active ? 0.3 : 0.05);
        } catch(e) {}
      });

      // Camera: smooth forward-facing follow
      const ahead = Math.min(ptIdx + 100, coords.length - 1);
      const rawBearing = this._bearing(pos, coords[ahead]);
      if (this._smoothBearing === null) this._smoothBearing = rawBearing;
      const diff2 = ((rawBearing - this._smoothBearing + 540) % 360) - 180;
      this._smoothBearing = (this._smoothBearing + diff2 * 0.05 + 360) % 360;
      this.map.easeTo({ center: pos, bearing: this._smoothBearing, pitch: 42, zoom: 11, duration: 200, easing: t => t * (2 - t) });

      ptIdx += SPEED;
      this._animId = requestAnimationFrame(step);
    };

    this._animId = requestAnimationFrame(step);
    if (onStateChange) onStateChange('playing');
  },

  // ── Day page: single route ───────────────────────────────────────────────

  showRoute(gpxData) {
    if (!this._ready) { this._pendingRoute = gpxData; return; }
    this._clearRoute();
    if (!gpxData) return;

    const coords = gpxData.points.map(p => [p.lng, p.lat]);

    this.map.addSource('route-src', {
      type: 'geojson',
      lineMetrics: true, // required for line-gradient (steepness colouring)
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
    });
    const mob = this._isMobile();
    const lineW = mob ? 6 : 4.5;
    const caseW = lineW + 4;

    // Dark casing beneath the coloured line so it stays legible on any basemap
    // (especially the grey "flat" segments and on small phone screens).
    this.map.addLayer({ id: 'route-glow', type: 'line', source: 'route-src',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#0a0a0a', 'line-width': caseW, 'line-opacity': 0.55, 'line-blur': 0.5 } });

    // Colour the line by gradient steepness (same scale as the altitude chart)
    const gradPaint = this._gradientLinePaint(gpxData.points);
    this.map.addLayer({ id: 'route-line', type: 'line', source: 'route-src',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: gradPaint
        ? { 'line-gradient': gradPaint, 'line-width': lineW, 'line-opacity': 1 }
        : { 'line-color': '#FC4C02', 'line-width': lineW, 'line-opacity': 1 } });

    this.map.addSource('start-src', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] } } });
    this.map.addSource('end-src',   { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: coords[coords.length - 1] } } });
    this.map.addLayer({ id: 'start-dot', type: 'circle', source: 'start-src',
      paint: { 'circle-radius': 7, 'circle-color': '#22c55e', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
    this.map.addLayer({ id: 'end-dot', type: 'circle', source: 'end-src',
      paint: { 'circle-radius': 7, 'circle-color': '#ef4444', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });

    this.map.addSource('rider-src', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] } } });
    this.map.addLayer({ id: 'rider-outer', type: 'circle', source: 'rider-src',
      paint: { 'circle-radius': 14, 'circle-color': 'rgba(252,76,2,0.25)', 'circle-opacity': 0 } });
    this.map.addLayer({ id: 'rider-dot', type: 'circle', source: 'rider-src',
      paint: { 'circle-radius': 7, 'circle-color': '#fff', 'circle-stroke-width': 3, 'circle-stroke-color': '#FC4C02', 'circle-opacity': 0 } });

    const b = gpxData.bounds;
    this.map.fitBounds([[b.minLng, b.minLat], [b.maxLng, b.maxLat]],
      { padding: { top: 60, bottom: 60, left: 60, right: 60 }, pitch: 35, bearing: 0, duration: 1200 });
  },

  animate(gpxData, onProgress) {
    if (!gpxData || !this._ready) return;
    this.stopAnimation();

    const coords = gpxData.points.map(p => [p.lng, p.lat]);
    const total = coords.length;
    // Slower: ~90 seconds at 60fps for any route length
    const SPEED = Math.max(1, Math.floor(total / 1800));
    this._animProgress = 0;
    this._isAnimating = true;
    this._smoothBearing = null;
    let frame = 0;

    this.map.setPaintProperty('rider-dot', 'circle-opacity', 1);
    this.map.setPaintProperty('rider-outer', 'circle-opacity', 1);

    const step = () => {
      if (!this._isAnimating) return;
      if (this._animProgress >= total - 1) {
        this.stopAnimation();
        if (onProgress) onProgress(1, null);
        return;
      }
      const idx = Math.floor(this._animProgress);
      const pos = coords[idx];

      this.map.getSource('rider-src')?.setData({ type: 'Feature', geometry: { type: 'Point', coordinates: pos } });

      // Update camera every 3 frames to reduce jitter
      if (frame % 3 === 0) {
        // Look far ahead for a stable forward-facing direction
        const ahead = Math.min(idx + 100, total - 1);
        const rawBearing = this._bearing(pos, coords[ahead]);

        // Exponential moving average on bearing to smooth direction changes
        if (this._smoothBearing === null) this._smoothBearing = rawBearing;
        const diff = ((rawBearing - this._smoothBearing + 540) % 360) - 180;
        this._smoothBearing = (this._smoothBearing + diff * 0.06 + 360) % 360;

        this.map.easeTo({
          center: pos,
          bearing: this._smoothBearing,  // forward-facing: direction of travel is "up"
          pitch: 45,                      // moderate tilt — calmer, more overview
          zoom: 12,
          duration: 250,
          easing: t => t * (2 - t)       // ease-out for smooth deceleration
        });
      }

      if (onProgress) onProgress(idx / total, gpxData.points[idx]);
      this._animProgress += SPEED;
      frame++;
      this._animId = requestAnimationFrame(step);
    };
    this._animId = requestAnimationFrame(step);
  },

  stopAnimation() {
    this._isAnimating = false;
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
  },

  resetCamera(gpxData, trip) {
    this.stopAnimation();
    if (this.map.getLayer('rider-dot')) {
      this.map.setPaintProperty('rider-dot', 'circle-opacity', 0);
      this.map.setPaintProperty('rider-outer', 'circle-opacity', 0);
    }
    if (gpxData) {
      const b = gpxData.bounds;
      this.map.fitBounds([[b.minLng, b.minLat], [b.maxLng, b.maxLat]],
        { padding: 60, pitch: 55, bearing: -20, duration: 1000 });
    } else if (trip) {
      this.map.flyTo({ center: trip.center, zoom: trip.defaultZoom, pitch: 55, bearing: -20, duration: 1000 });
    }
  },

  // Build a MapLibre line-gradient expression coloured by % gradient.
  // Samples ~160 stops along the route using a 300 m gradient window.
  _gradientLinePaint(pts) {
    const total = pts[pts.length - 1]?.cumDist || 0;
    if (total <= 0 || pts.length < 4) return null;
    const N = Math.min(160, pts.length);
    const expr = ['interpolate', ['linear'], ['line-progress']];
    let lastFrac = -1;
    for (let s = 0; s < N; s++) {
      let frac = s / (N - 1);
      if (frac <= lastFrac) frac = lastFrac + 1e-4; // keep strictly increasing
      lastFrac = frac;
      const targetDist = frac * total;
      // nearest point index at/after targetDist
      let i = Math.min(pts.length - 1, Math.round(frac * (pts.length - 1)));
      while (i > 0 && pts[i].cumDist > targetDist) i--;
      while (i < pts.length - 1 && pts[i].cumDist < targetDist) i++;
      // gradient over a 300 m forward window
      let j = i;
      while (j < pts.length - 1 && pts[j].cumDist - pts[i].cumDist < 300) j++;
      const d = pts[j].cumDist - pts[i].cumDist;
      const g = d > 60 ? Math.max(0, (pts[j].ele - pts[i].ele) / d * 100) : 0;
      expr.push(+frac.toFixed(5), ChartView._gradColor(g));
    }
    return expr;
  },

  // ── Map → chart hover sync ────────────────────────────────────────────────
  // Highlights the altitude chart while the cursor moves over the route line.
  enableChartSync(gpxData, onHoverKm) {
    if (!this._ready || !this.map.getLayer('route-line')) return;
    this.disableChartSync();
    const pts = gpxData.points;
    this._chartSyncMove = e => {
      const ll = e.lngLat;
      let best = 0, bd = Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        const dx = pts[i].lng - ll.lng, dy = pts[i].lat - ll.lat;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      onHoverKm(pts[best].cumDist / 1000);
    };
    this._chartSyncLeave = () => onHoverKm(null);
    this.map.on('mousemove', 'route-line', this._chartSyncMove);
    this.map.on('mouseleave', 'route-line', this._chartSyncLeave);
  },

  disableChartSync() {
    if (this._chartSyncMove) { try { this.map.off('mousemove', 'route-line', this._chartSyncMove); } catch(e) {} this._chartSyncMove = null; }
    if (this._chartSyncLeave) { try { this.map.off('mouseleave', 'route-line', this._chartSyncLeave); } catch(e) {} this._chartSyncLeave = null; }
  },

  _bearing(from, to) {
    const lng1 = from[0] * Math.PI / 180, lng2 = to[0] * Math.PI / 180;
    const lat1 = from[1] * Math.PI / 180, lat2 = to[1] * Math.PI / 180;
    const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  },

  _clearOverviewRoutes() {
    this.stopAnimation();
    this._detachOverviewHover();
    this._overviewLayerIds.forEach(srcId => {
      [`${srcId}-glow`, `${srcId}-line`, `${srcId}-startdot`].forEach(lid => {
        try { if (this.map.getLayer(lid)) this.map.removeLayer(lid); } catch(e) {}
      });
      [srcId, `${srcId}-start`].forEach(sid => {
        try { if (this.map.getSource(sid)) this.map.removeSource(sid); } catch(e) {}
      });
    });
    ['ov-rider-ring', 'ov-rider-dot'].forEach(lid => {
      try { if (this.map.getLayer(lid)) this.map.removeLayer(lid); } catch(e) {}
    });
    try { if (this.map.getSource('ov-rider')) this.map.removeSource('ov-rider'); } catch(e) {}
    this._overviewLayerIds = [];
  },

  // ── Lunch marker ─────────────────────────────────────────────────────────

  showLunchMarker(lngLat, onRemove) {
    this.removeLunchMarker();
    const el = document.createElement('div');
    el.className = 'lunch-marker';
    el.innerHTML = '<div class="lunch-marker-icon">🍽️</div><div class="lunch-marker-label">Lunch</div>';
    el.title = 'Klik om te verwijderen';
    el.addEventListener('click', e => { e.stopPropagation(); onRemove(); });
    this._lunchMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(lngLat)
      .addTo(this.map);
  },

  removeLunchMarker() {
    if (this._lunchMarker) { this._lunchMarker.remove(); this._lunchMarker = null; }
  },

  enableLunchPlacement(onPlace) {
    this._lunchPlacementHandler = e => {
      this.disableLunchPlacement();
      onPlace([e.lngLat.lng, e.lngLat.lat]);
    };
    this.map.once('click', this._lunchPlacementHandler);
    this.map.getCanvas().style.cursor = 'crosshair';
  },

  disableLunchPlacement() {
    if (this._lunchPlacementHandler) {
      this.map.off('click', this._lunchPlacementHandler);
      this._lunchPlacementHandler = null;
    }
    this.map.getCanvas().style.cursor = '';
  },

  // ── Climb markers ─────────────────────────────────────────────────────────

  showClimbMarkers(namedClimbs, pts, onClickFn) {
    this._clearClimbMarkers();
    if (!this._ready || !namedClimbs?.length) return;

    // Redraw each climb as a gradient line on top of the base route so the
    // steepness colours stay visible where the route doubles back over a climb
    // (otherwise the later descent — clamped to grey — overpaints the ascent).
    this._drawClimbOverlays(namedClimbs, pts);

    namedClimbs.forEach((c, i) => {
      const pt = pts[c.endIdx];
      if (!pt) return;

      const el = document.createElement('div');
      el.className = 'col-marker';
      el.dataset.idx = i;
      const label = c.colName || `Klim ${i + 1}`;
      el.innerHTML = `<div class="col-marker-pin"></div><div class="col-marker-label">${label}</div>`;
      el.addEventListener('click', e => { e.stopPropagation(); onClickFn(i, el); });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pt.lng, pt.lat])
        .addTo(this.map);
      this._climbMarkers.push({ marker, el, idx: i });
    });
  },

  updateClimbMarkerLabel(idx, name) {
    const entry = this._climbMarkers.find(m => m.idx === idx);
    if (entry) entry.el.querySelector('.col-marker-label').textContent = name;
  },

  // Draw each climb's ascent as its own gradient line on top of route-line.
  _drawClimbOverlays(namedClimbs, pts) {
    this._clearClimbOverlays();
    if (!this.map.getLayer('route-line')) return;
    namedClimbs.forEach((c, i) => {
      if (c.startIdx == null || c.endIdx == null || c.endIdx <= c.startIdx) return;
      const coords = [];
      for (let k = c.startIdx; k <= c.endIdx; k++) coords.push([pts[k].lng, pts[k].lat]);
      if (coords.length < 2) return;
      const srcId = `climb-ov-${i}`;
      const layerId = `${srcId}-line`;
      try {
        this.map.addSource(srcId, {
          type: 'geojson', lineMetrics: true,
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
        });
        const grad = this._climbGradientPaint(pts, c.startIdx, c.endIdx);
        this.map.addLayer({
          id: layerId, type: 'line', source: srcId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: grad
            ? { 'line-gradient': grad, 'line-width': 5, 'line-opacity': 1 }
            : { 'line-color': '#FC4C02', 'line-width': 5, 'line-opacity': 1 }
        });
        this._climbOverlayIds.push(srcId);
      } catch (e) {}
    });
  },

  // Gradient paint for a climb sub-segment (local distances start at 0).
  _climbGradientPaint(pts, startIdx, endIdx) {
    const base = pts[startIdx].cumDist;
    const seg = [];
    for (let i = startIdx; i <= endIdx; i++) seg.push({ cumDist: pts[i].cumDist - base, ele: pts[i].ele });
    return this._gradientLinePaint(seg);
  },

  _clearClimbOverlays() {
    this._climbOverlayIds.forEach(srcId => {
      const layerId = `${srcId}-line`;
      try { if (this.map.getLayer(layerId)) this.map.removeLayer(layerId); } catch (e) {}
      try { if (this.map.getSource(srcId)) this.map.removeSource(srcId); } catch (e) {}
    });
    this._climbOverlayIds = [];
  },

  _clearClimbMarkers() {
    this._climbMarkers.forEach(({ marker }) => marker.remove());
    this._climbMarkers = [];
    this._clearClimbOverlays();
  },

  showHoverMarker(point) {
    if (!point) { this._removeHoverMarker(); return; }
    if (!this.map) return;

    this._removeHoverMarker();

    try {
      this.map.addSource('hover-src', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Point', coordinates: [point.lng, point.lat] } }
      });
      this.map.addLayer({
        id: 'hover-dot',
        type: 'circle',
        source: 'hover-src',
        paint: {
          'circle-radius': 10,
          'circle-color': '#fbbf24',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.8
        }
      });
    } catch(e) {}
  },

  _removeHoverMarker() {
    if (!this.map) return;
    try {
      if (this.map.getLayer('hover-dot')) this.map.removeLayer('hover-dot');
      if (this.map.getSource('hover-src')) this.map.removeSource('hover-src');
    } catch(e) {}
  },

  _clearRoute(clearLunch = false) {
    this.stopAnimation();
    this._clearClimbMarkers();
    this._removeHoverMarker();
    if (clearLunch) this.removeLunchMarker();
    ['route-glow', 'route-line', 'start-dot', 'end-dot', 'rider-dot', 'rider-outer'].forEach(id => {
      try { if (this.map.getLayer(id)) this.map.removeLayer(id); } catch(e) {}
    });
    ['route-src', 'start-src', 'end-src', 'rider-src'].forEach(id => {
      try { if (this.map.getSource(id)) this.map.removeSource(id); } catch(e) {}
    });
  }
};
