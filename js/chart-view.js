const ChartView = {
  _chart: null,

  // ─── CLIMB CATEGORISATION (Tour de France style) ─────────────────────────
  // Difficulty score = length(km) × avgGradient(%)².  Thresholds calibrated so
  // that e.g. a 16 km @ 6.5% col ≈ Cat 1 and a 2 km @ 5% bump ≈ Cat 4.
  categorize(climb) {
    if (!climb || !climb.lengthKm || !climb.avgGrad) return null;
    const score = climb.lengthKm * climb.avgGrad * climb.avgGrad;
    if (score >= 900) return 'HC';
    if (score >= 500) return '1';
    if (score >= 250) return '2';
    if (score >= 100) return '3';
    if (score >= 30)  return '4';
    return null;
  },

  catLabel(cat) { return cat ? (cat === 'HC' ? 'HC' : 'Cat ' + cat) : null; },

  _catColor(cat) {
    switch (cat) {
      case 'HC': return '#7c3aed';
      case '1':  return '#dc2626';
      case '2':  return '#ea580c';
      case '3':  return '#ca8a04';
      case '4':  return '#16a34a';
      default:   return '#6b7280';
    }
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  // Draws a compact category badge (4/3/2/1/HC) just above each col summit.
  // Col names are intentionally omitted here — they live in the pills below the chart.
  _climbLabelPlugin(climbs) {
    return {
      id: 'climbLabels',
      afterDatasetsDraw(chart) {
        if (!climbs || !climbs.length) return;
        const { ctx, scales, chartArea } = chart;
        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        climbs.forEach(c => {
          const cat = (typeof App !== 'undefined' && App._climbCategory) ? App._climbCategory(c) : ChartView.categorize(c);
          if (!cat) return; // only label categorised climbs
          const x = scales.x.getPixelForValue(c.endDistKm);
          if (!isFinite(x)) return;
          const yEle = scales.y.getPixelForValue(c.endEle);
          const color = ChartView._catColor(cat);

          // Summit marker on the elevation line
          ctx.beginPath();
          ctx.arc(x, yEle, 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Compact badge above the summit
          const txt = cat; // 'HC' or '1'..'4'
          ctx.font = 'bold 10px sans-serif';
          const tw = ctx.measureText(txt).width;
          const padX = 4, h = 14, w = tw + padX * 2;
          let bx = x - w / 2;
          bx = Math.max(chartArea.left + 1, Math.min(bx, chartArea.right - w - 1));
          let by = yEle - h - 6;
          if (by < chartArea.top + 1) by = chartArea.top + 1;

          ChartView._roundRect(ctx, bx, by, w, h, 3);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillText(txt, bx + w / 2, by + h / 2 + 0.5);
        });
        ctx.restore();
      }
    };
  },

  // Gradient colour scale matching climbfinder.com
  _gradColor(g) {
    if (g < 3)  return '#6b7280'; // grey  – flat
    if (g < 5)  return '#22c55e'; // green – easy
    if (g < 8)  return '#eab308'; // yellow – moderate
    if (g < 11) return '#f97316'; // orange – hard
    if (g < 15) return '#ef4444'; // red   – very hard
    return '#7c3aed';             // purple – extreme
  },

  // KOM highlight — inline Chart.js plugin (no external dependency)
  _komPlugin(komStart, komEnd) {
    return {
      id: 'komHighlight',
      beforeDraw(chart) {
        if (komStart == null || komEnd == null) return;
        const { ctx, scales } = chart;
        const x0 = scales.x.getPixelForValue(komStart);
        const x1 = scales.x.getPixelForValue(komEnd);
        const y0 = scales.y.top, y1 = scales.y.bottom;
        ctx.save();
        ctx.fillStyle = 'rgba(234,179,8,0.12)';
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.strokeStyle = 'rgba(234,179,8,0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#eab308';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('⏱ KOM', x0 + 5, y0 + 13);
        ctx.restore();
      }
    };
  },

  render(canvasId, gpxData, timedSegment, onHover, climbs) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (this._chart) { this._chart.destroy(); this._chart = null; }
    if (!gpxData) { this._renderEmpty(canvas); return; }

    const pts  = gpxData.points;
    const step = Math.max(1, Math.floor(pts.length / 600));
    const labels = [], elevations = [], gradients = [];
    const ptIndices = []; // Track which point each chart label corresponds to

    for (let i = 0; i < pts.length; i += step) {
      ptIndices.push(i);
      labels.push(+(pts[i].cumDist / 1000).toFixed(2));
      elevations.push(Math.round(pts[i].ele));
      let j = Math.min(i + 1, pts.length - 1);
      while (j < pts.length - 1 && pts[j].cumDist - pts[i].cumDist < 300) j++;
      const dist = pts[j].cumDist - pts[i].cumDist;
      gradients.push(dist > 60 ? Math.max(0, (pts[j].ele - pts[i].ele) / dist * 100) : 0);
    }

    const komStart = timedSegment?.startDistKm ?? null;
    const komEnd   = komStart != null ? komStart + (timedSegment.km ?? 0) : null;

    // Custom plugin for hover interactivity
    const hoverPlugin = onHover ? {
      id: 'hoverPlugin',
      afterEvent(chart, event) {
        if (event.event.type === 'mousemove') {
          const canvasPos = Chart.helpers.getRelativePosition(event.event, chart);
          const dataX = chart.scales.x.getValueForPixel(canvasPos.x);
          if (dataX >= 0) {
            // Find closest label index
            let closest = 0, closestDiff = Math.abs(labels[0] - dataX);
            for (let i = 1; i < labels.length; i++) {
              const diff = Math.abs(labels[i] - dataX);
              if (diff < closestDiff) { closest = i; closestDiff = diff; }
            }
            const ptIdx = ptIndices[closest];
            onHover(pts[ptIdx]);
          }
        } else if (event.event.type === 'mouseleave') {
          onHover(null);
        }
      }
    } : null;

    // Stash for external (map → chart) hover sync
    this._labels = labels;
    this._ptIndices = ptIndices;
    this._pts = pts;

    const ctx = canvas.getContext('2d');
    const plugins = [this._komPlugin(komStart, komEnd)];
    if (climbs && climbs.length) plugins.push(this._climbLabelPlugin(climbs));
    if (hoverPlugin) plugins.push(hoverPlugin);

    this._chart = new Chart(ctx, {
      plugins,
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: elevations,
          fill: true,
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 220);
            g.addColorStop(0, 'rgba(252,76,2,0.35)');
            g.addColorStop(1, 'rgba(252,76,2,0.03)');
            return g;
          },
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.25,
          segment: {
            borderColor: ctx => this._gradColor(gradients[ctx.p0DataIndex] || 0)
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        layout: { padding: { top: (climbs && climbs.length) ? 14 : 0 } },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a1a',
            titleColor: '#FC4C02',
            bodyColor: '#eee',
            callbacks: {
              title: items => `${items[0].label} km`,
              label: item => `${item.raw} m  (${gradients[item.dataIndex]?.toFixed(1)}%)`
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            ticks: { color: '#888', maxTicksLimit: 12, callback: v => v + ' km' },
            grid: { color: '#2a2a2a' }
          },
          y: {
            ticks: { color: '#888', callback: v => v + ' m' },
            grid: { color: '#2a2a2a' }
          }
        }
      }
    });
  },

  // Highlight a point on the stage chart by distance (km) — used for map→chart hover sync
  showHoverAtDistanceKm(km) {
    const ch = this._chart;
    if (!ch || km == null || !this._labels?.length) return;
    let closest = 0, cd = Infinity;
    for (let i = 0; i < this._labels.length; i++) {
      const d = Math.abs(this._labels[i] - km);
      if (d < cd) { cd = d; closest = i; }
    }
    const active = [{ datasetIndex: 0, index: closest }];
    ch.setActiveElements(active);
    if (ch.tooltip) ch.tooltip.setActiveElements(active, { x: 0, y: 0 });
    ch.update('none');
  },

  clearHover() {
    const ch = this._chart;
    if (!ch) return;
    ch.setActiveElements([]);
    if (ch.tooltip) ch.tooltip.setActiveElements([], { x: 0, y: 0 });
    ch.update('none');
  },

  // Render a climbfinder-style profile card for a single climb into `el` (DOM element)
  renderClimbProfile(el, climb) {
    el.innerHTML = this.climbProfileSVG(climb);
  },

  // Build a smooth path through [x,y] points using a Catmull-Rom spline
  // converted to cubic béziers. Removes the jagged "shaky hand" look that raw
  // GPS track points produce.
  _smoothPath(pts) {
    if (!pts.length) return '';
    if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
    return d;
  },

  // Build the climb profile as a standalone SVG string (reused by the popup,
  // the hero card and the printable roadbook).
  climbProfileSVG(climb) {
    if (!climb || !climb.climbPts || !climb.gradProfile) return '';

    // cyclingcols-style: fixed per-kilometre bars, each coloured by that km's
    // AVERAGE gradient with one clean number, plus the elevation silhouette and
    // a km distance axis. Averaging per km removes the noisy "barcode" look.
    const W = 320, H = 150, AX = 16;     // AX = bottom distance-axis band
    const cpts = climb.climbPts;
    const minE = Math.min(...cpts.map(p => p.ele));
    const maxE = Math.max(...cpts.map(p => p.ele));
    const maxD = climb.lengthKm || 1;
    const eRange = maxE - minE || 1;

    const x = d => +(d / maxD * W).toFixed(2);
    const y = e => +(H - (e - minE) / eRange * (H - 18) - 6).toFixed(2);

    // Elevation at any distance (linear interpolation between track points)
    const eleAt = d => {
      for (let i = 1; i < cpts.length; i++) {
        if (cpts[i].distKm >= d) {
          const a = cpts[i - 1], b = cpts[i];
          const t = (d - a.distKm) / ((b.distKm - a.distKm) || 1);
          return a.ele + (b.ele - a.ele) * t;
        }
      }
      return cpts[cpts.length - 1].ele;
    };

    // Bin into fixed buckets: 1 km normally, 0.5 km for short climbs
    const step = maxD <= 4 ? 0.5 : 1;
    const buckets = [];
    for (let s = 0; s < maxD - 1e-6; s += step) {
      const e0 = Math.min(s + step, maxD);
      const w = e0 - s;
      const grad = w > 0 ? ((eleAt(e0) - eleAt(s)) / (w * 1000)) * 100 : 0;
      buckets.push({ startKm: s, endKm: e0, widthKm: w, grad, col: this._gradColor(grad) });
    }

    // Elevation silhouette — resample at even spacing + moving-average to kill
    // GPS jitter, then draw as a smooth spline (climbfinder-style clean line).
    const N = Math.max(16, Math.min(160, Math.round(maxD * 14)));
    const sampled = [];
    for (let k = 0; k <= N; k++) sampled.push({ d: maxD * k / N, e: eleAt(maxD * k / N) });
    const win = 2;
    const smooth = sampled.map((p, i) => {
      let sum = 0, c = 0;
      for (let j = Math.max(0, i - win); j <= Math.min(sampled.length - 1, i + win); j++) { sum += sampled[j].e; c++; }
      return [x(p.d), y(sum / c)];
    });
    const linePts = this._smoothPath(smooth);
    const fillPath = `${linePts} L${W},${H} L0,${H} Z`;
    const uid = 'cp' + Math.random().toString(36).slice(2, 8);

    // One solid colour block per km bucket, clipped under the silhouette
    const fills = buckets.map(b => {
      const bx = x(b.startKm), bw = x(b.endKm) - x(b.startKm);
      return `<rect x="${bx}" y="0" width="${bw}" height="${H}" fill="${b.col}"/>`;
    }).join('');

    // Thin separators between buckets for the bar-chart read
    const seps = buckets.slice(1).map(b =>
      `<line x1="${x(b.startKm)}" y1="0" x2="${x(b.startKm)}" y2="${H}" stroke="rgba(0,0,0,0.28)" stroke-width="1"/>`
    ).join('');

    // Per-km gradient number, riding just under the slope line
    const labels = buckets.map(b => {
      const bw = x(b.endKm) - x(b.startKm);
      if (bw < 12) return '';
      const midKm = (b.startKm + b.endKm) / 2;
      const cx = x(midKm);
      const ly = Math.min(y(eleAt(midKm)) + 13, H - 6);
      const fs = bw > 26 ? 12 : 11;
      return `<text x="${cx}" y="${ly}" text-anchor="middle" font-size="${fs}" font-weight="800"
        fill="#fff" stroke="rgba(0,0,0,0.55)" stroke-width="2.4" paint-order="stroke"
        font-family="sans-serif">${Math.round(b.grad)}</text>`;
    }).join('');

    // Distance axis (km ticks along the bottom)
    const tickStep = maxD > 12 ? 2 : 1;
    let ticks = '';
    for (let d = tickStep; d < maxD - 0.15; d += tickStep) {
      ticks += `<text x="${x(d)}" y="${H + AX - 4}" text-anchor="middle" font-size="9"
        fill="#888" font-family="sans-serif">${d}</text>`;
    }
    ticks += `<text x="${W - 2}" y="${H + AX - 4}" text-anchor="end" font-size="9"
      fill="#888" font-family="sans-serif">${maxD.toFixed(1)} km</text>`;

    return `<svg viewBox="0 0 ${W} ${H + AX}" width="100%" style="display:block;border-radius:6px;overflow:hidden">
      <defs><clipPath id="${uid}"><path d="${fillPath}"/></clipPath></defs>
      <rect width="${W}" height="${H}" fill="#1a1a1a"/>
      <g clip-path="url(#${uid})">${fills}${seps}</g>
      <path d="${linePts}" fill="none" stroke="#0a0a0a" stroke-width="2.5" stroke-linejoin="round"/>
      <text x="4" y="${H - 5}" font-size="10" fill="#eee" stroke="#000" stroke-width="2.4" paint-order="stroke" font-family="sans-serif">${climb.startEle}m</text>
      <text x="${W - 4}" y="13" font-size="10" fill="#eee" stroke="#000" stroke-width="2.4" paint-order="stroke" font-family="sans-serif" text-anchor="end">${climb.endEle}m</text>
      <g>${labels}</g>
      <g>${ticks}</g>
    </svg>`;
  },

  // Build a full-stage elevation profile as an SVG string for the printable
  // roadbook: gradient-coloured silhouette + climb category markers + km axis.
  stageProfileSVG(gpx, climbs, opts = {}) {
    if (!gpx || !gpx.points || gpx.points.length < 4) return '';
    const W = opts.width || 1000, H = opts.height || 230, AX = 26;
    const pts = gpx.points;
    const totalKm = (pts[pts.length - 1].cumDist || 0) / 1000 || 1;
    const minE = Math.min(...pts.map(p => p.ele));
    const maxE = Math.max(...pts.map(p => p.ele));
    const eRange = maxE - minE || 1;

    const x = km => +(km / totalKm * W).toFixed(2);
    const y = e => +(H - (e - minE) / eRange * (H - 22) - 8).toFixed(2);

    // Elevation silhouette (also the clip mask for the colour fills)
    const step = Math.max(1, Math.floor(pts.length / 700));
    let linePts = '';
    for (let i = 0; i < pts.length; i += step) {
      linePts += `${i === 0 ? 'M' : 'L'}${x(pts[i].cumDist / 1000)},${y(pts[i].ele)} `;
    }
    linePts += `L${x(pts[pts.length - 1].cumDist / 1000)},${y(pts[pts.length - 1].ele)}`;
    const fillPath = `${linePts} L${W},${H} L0,${H} Z`;
    const uid = 'sp' + Math.random().toString(36).slice(2, 8);

    // Sample the route into colour columns by local gradient (300 m window)
    const N = Math.min(420, Math.floor(pts.length / 2) || 1);
    let fills = '';
    for (let s = 0; s < N; s++) {
      const d0 = s / N * totalKm, d1 = (s + 1) / N * totalKm;
      // gradient over this column
      const tgt0 = d0 * 1000, tgt1 = Math.max(tgt0 + 300, d1 * 1000);
      let i = 0; while (i < pts.length - 1 && pts[i].cumDist < tgt0) i++;
      let j = i; while (j < pts.length - 1 && pts[j].cumDist < tgt1) j++;
      const dd = pts[j].cumDist - pts[i].cumDist;
      const g = dd > 60 ? Math.max(0, (pts[j].ele - pts[i].ele) / dd * 100) : 0;
      const bx = x(d0), bw = Math.max(0.6, x(d1) - x(d0));
      fills += `<rect x="${bx}" y="0" width="${bw + 0.5}" height="${H}" fill="${this._gradColor(g)}"/>`;
    }

    // Climb markers: shaded ascent span + category badge + name at the summit
    let marks = '';
    (climbs || []).forEach(c => {
      const cat = (typeof App !== 'undefined' && App._climbCategory) ? App._climbCategory(c) : this.categorize(c);
      if (c.startDistKm == null || c.endDistKm == null) return;
      const sx = x(c.startDistKm), ex = x(c.endDistKm);
      marks += `<rect x="${sx}" y="0" width="${Math.max(1, ex - sx)}" height="${H}" fill="rgba(255,255,255,0.08)"/>`;
      const summitY = y(c.endEle);
      marks += `<line x1="${ex}" y1="${summitY}" x2="${ex}" y2="${H}" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="3 3"/>`;
      const col = this._catColor(cat);
      const name = (c.colName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const label = (cat ? cat + '  ' : '') + name;
      if (label.trim()) {
        const tw = label.length * 6.2 + 10;
        let lx = ex - tw / 2;
        lx = Math.max(2, Math.min(lx, W - tw - 2));
        const ly = Math.max(13, summitY - 16);
        marks += `<g>
          <rect x="${lx}" y="${ly - 11}" width="${tw}" height="15" rx="3" fill="${cat ? col : '#374151'}" opacity="0.95"/>
          <text x="${lx + tw / 2}" y="${ly}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff" font-family="sans-serif">${label}</text>
        </g>`;
      }
      marks += `<circle cx="${ex}" cy="${summitY}" r="3.2" fill="${cat ? col : '#9ca3af'}" stroke="#fff" stroke-width="1"/>`;
    });

    // Distance axis
    const tickStep = totalKm > 80 ? 20 : (totalKm > 40 ? 10 : (totalKm > 16 ? 5 : 2));
    let ticks = '';
    for (let d = tickStep; d < totalKm - 0.1; d += tickStep) {
      ticks += `<line x1="${x(d)}" y1="${H}" x2="${x(d)}" y2="${H + 4}" stroke="#888" stroke-width="1"/>
        <text x="${x(d)}" y="${H + AX - 8}" text-anchor="middle" font-size="10" fill="#aaa" font-family="sans-serif">${d}</text>`;
    }
    ticks += `<text x="${W - 2}" y="${H + AX - 8}" text-anchor="end" font-size="10" fill="#aaa" font-family="sans-serif">${totalKm.toFixed(1)} km</text>`;

    return `<svg viewBox="0 0 ${W} ${H + AX}" width="100%" preserveAspectRatio="none" style="display:block">
      <defs><clipPath id="${uid}"><path d="${fillPath}"/></clipPath></defs>
      <rect width="${W}" height="${H}" fill="#1a1a1a"/>
      <g clip-path="url(#${uid})">${fills}</g>
      <path d="${linePts}" fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linejoin="round"/>
      <g>${marks}</g>
      <text x="4" y="${H - 5}" font-size="11" fill="#eee" stroke="#000" stroke-width="2.4" paint-order="stroke" font-family="sans-serif">${Math.round(pts[0].ele)}m</text>
      <text x="${W - 4}" y="14" font-size="11" fill="#eee" stroke="#000" stroke-width="2.4" paint-order="stroke" font-family="sans-serif" text-anchor="end">${maxE}m</text>
      <g>${ticks}</g>
    </svg>`;
  },

  // Gradient legend for the climb cards
  renderLegend(el) {
    const items = [
      ['< 3%', '#6b7280'], ['3–5%', '#22c55e'], ['5–8%', '#eab308'],
      ['8–11%', '#f97316'], ['11–15%', '#ef4444'], ['> 15%', '#7c3aed']
    ];
    el.innerHTML = `<div class="grad-legend">${items.map(([l, c]) =>
      `<span class="grad-legend-item"><span style="background:${c}"></span>${l}</span>`
    ).join('')}</div>`;
  },

  _renderEmpty(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#555';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Upload GPX om het hoogteprofiel te zien', canvas.width / 2, canvas.height / 2);
  }
};
