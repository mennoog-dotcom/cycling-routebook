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
    if (!climb.climbPts || !climb.gradProfile) { el.innerHTML = ''; return; }

    const W = 300, H = 90, BAR_H = 28;
    const cpts = climb.climbPts;
    const minE = Math.min(...cpts.map(p => p.ele));
    const maxE = Math.max(...cpts.map(p => p.ele));
    const maxD = climb.lengthKm || 1;
    const eRange = maxE - minE || 1;

    const x = d => (d / maxD * W).toFixed(1);
    const y = e => (H - (e - minE) / eRange * H * 0.92).toFixed(1);

    // Elevation silhouette path
    const linePts = cpts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.distKm)},${y(p.ele)}`).join(' ');
    const fillPath = `${linePts} L${W},${H} L0,${H} Z`;

    // Gradient bars
    const bars = climb.gradProfile.map(seg => {
      const bx = +(seg.distKm / maxD * W).toFixed(1);
      const bw = Math.max(1.5, +(seg.widthKm / maxD * W).toFixed(1));
      const col = this._gradColor(seg.grad);
      const label = seg.grad >= 1 ? seg.grad.toFixed(1) + '%' : '';
      const fontSize = bw > 22 ? 9 : (bw > 14 ? 8 : 0);
      return `<rect x="${bx}" y="0" width="${bw}" height="${BAR_H}" fill="${col}"/>` +
        (fontSize ? `<text x="${bx + bw / 2}" y="${BAR_H - 7}" text-anchor="middle" font-size="${fontSize}" fill="#fff" font-weight="bold">${label}</text>` : '');
    }).join('');

    // Elevation labels
    const startLabel = `${climb.startEle}m`;
    const topLabel   = `${climb.endEle}m`;

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H + BAR_H + 4}" width="100%" style="display:block;border-radius:6px;overflow:hidden">
      <g transform="translate(0,${BAR_H + 2})">
        <rect width="${W}" height="${H}" fill="#141414"/>
        <path d="${fillPath}" fill="rgba(252,76,2,0.18)" stroke="#FC4C02" stroke-width="1.8"/>
        <text x="3" y="${H - 4}" font-size="9" fill="#aaa" font-family="sans-serif">${startLabel}</text>
        <text x="${W - 3}" y="12" font-size="9" fill="#aaa" font-family="sans-serif" text-anchor="end">${topLabel}</text>
      </g>
      <g>${bars}</g>
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
