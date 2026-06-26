const GPXParser = {
  fromBundle(triplets) {
    const raw = triplets.map(([lat, lng, ele]) => ({ lat, lng, ele }));
    return this._process(raw);
  },

  parse(text) {
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    let pts = [...xml.querySelectorAll('trkpt')];
    if (!pts.length) pts = [...xml.querySelectorAll('rtept')];
    if (!pts.length) return null;
    const raw = pts.map(p => ({
      lat: parseFloat(p.getAttribute('lat')),
      lng: parseFloat(p.getAttribute('lon')),
      ele: parseFloat(p.querySelector('ele')?.textContent ?? 0)
    }));
    return this._process(raw);
  },

  _process(raw) {
    let cumDist = 0;
    const points = raw.map((p, i) => {
      if (i > 0) cumDist += this._haversine(raw[i - 1], p);
      return { ...p, cumDist };
    });
    // Smooth elevation to reduce GPS noise (window ≈ 15 points ≈ 150–300m)
    const smoothed = this._smooth(points, 15);
    let gain = 0, loss = 0;
    for (let i = 1; i < smoothed.length; i++) {
      const d = smoothed[i].ele - smoothed[i - 1].ele;
      if (d > 0) gain += d; else loss += -d;
    }
    return {
      points: smoothed,
      totalDistM: cumDist,
      totalGain: Math.round(gain),
      totalLoss: Math.round(loss),
      climbs: this._detectClimbs(smoothed),
      bounds: this._bounds(raw)
    };
  },

  _haversine(a, b) {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  },

  _smooth(pts, w) {
    return pts.map((p, i) => {
      const s = Math.max(0, i - w), e = Math.min(pts.length - 1, i + w);
      const avg = pts.slice(s, e + 1).reduce((a, b) => a + b.ele, 0) / (e - s + 1);
      return { ...p, ele: avg };
    });
  },

  // Compute gradient smoothed over a distance window to eliminate GPS noise.
  // Returns % gradient at each point based on elevation change over next `windowM` metres.
  _smoothGradients(pts, windowM) {
    return pts.map((pt, i) => {
      let j = Math.min(i + 1, pts.length - 1);
      while (j < pts.length - 1 && pts[j].cumDist - pt.cumDist < windowM) j++;
      const dist = pts[j].cumDist - pt.cumDist;
      return dist > windowM * 0.3 ? (pts[j].ele - pt.ele) / dist * 100 : 0;
    });
  },

  _detectClimbs(pts) {
    // All gradient logic uses 300m smoothing windows to kill GPS elevation noise
    const GRAD_WINDOW_M = 300;
    const MIN_GRAD     = 4.0;  // % to be "climbing"
    const MIN_LEN_M    = 800;  // minimum climb length
    const MIN_GAIN_M   = 80;   // minimum elevation gain
    const DIP_ALLOW_M  = 1500; // Alpine cols often have plateaus/hairpin dips of 500–1000m

    const sg = this._smoothGradients(pts, GRAD_WINDOW_M);
    const climbs = [];
    let start = null, lastGood = null;

    const finalize = (endIdx) => {
      const len  = pts[endIdx].cumDist - pts[start].cumDist;
      const gain = pts[endIdx].ele - pts[start].ele;
      if (len >= MIN_LEN_M && gain >= MIN_GAIN_M)
        climbs.push(this._buildClimb(pts, sg, start, endIdx));
      start = null; lastGood = null;
    };

    for (let i = 1; i < pts.length; i++) {
      if (sg[i] >= MIN_GRAD) {
        if (start === null) start = i;
        lastGood = i;
      } else if (start !== null) {
        if (pts[i].cumDist - pts[lastGood].cumDist > DIP_ALLOW_M) finalize(lastGood);
      }
    }
    if (start !== null && lastGood !== null) finalize(lastGood);
    return climbs;
  },

  // Build a climb object from start/end distances (km) — used for user-edited climbs
  buildClimbFromDist(pts, startDistKm, endDistKm) {
    const last = pts[pts.length - 1].cumDist;
    const startM = Math.max(0, startDistKm * 1000);
    const endM   = Math.min(last, endDistKm * 1000);
    let startIdx = 0, endIdx = 0;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].cumDist <= startM) startIdx = i;
      if (pts[i].cumDist <= endM)   endIdx = i;
    }
    if (endIdx <= startIdx) endIdx = Math.min(startIdx + 1, pts.length - 1);
    const sg = this._smoothGradients(pts, 300);
    return this._buildClimb(pts, sg, startIdx, endIdx);
  },

  _buildClimb(pts, smoothGrads, startIdx, endIdx) {
    const SEG_M = 250; // gradient profile segment length
    const s = pts[startIdx], e = pts[endIdx];
    const lenM = e.cumDist - s.cumDist;
    const gain = e.ele - s.ele;
    const avgGrad = lenM > 0 ? gain / lenM * 100 : 0;

    // Max gradient: highest smoothed value within the climb (already noise-free)
    let maxGrad = 0;
    for (let i = startIdx; i <= endIdx; i++)
      if (smoothGrads[i] > maxGrad) maxGrad = smoothGrads[i];

    // 250m segment gradient profile for bar chart (climbfinder style)
    const gradProfile = [];
    let cur = s.cumDist;
    while (cur < e.cumDist - 10) {
      const next = Math.min(cur + SEG_M, e.cumDist);
      let iA = startIdx, iB = startIdx;
      for (let k = startIdx; k <= endIdx; k++) {
        if (pts[k].cumDist <= cur)  iA = k;
        if (pts[k].cumDist <= next) iB = k;
      }
      const segLen  = pts[iB].cumDist - pts[iA].cumDist;
      const segGrad = segLen > 20 ? (pts[iB].ele - pts[iA].ele) / segLen * 100 : 0;
      gradProfile.push({
        distKm:  (cur - s.cumDist) / 1000,
        widthKm: (next - cur) / 1000,
        grad: Math.max(0, Math.round(segGrad * 10) / 10)
      });
      cur = next;
    }

    // Downsample climb points for the mini altitude profile
    const step = Math.max(1, Math.floor((endIdx - startIdx) / 120));
    const climbPts = [];
    for (let k = startIdx; k <= endIdx; k += step)
      climbPts.push({ distKm: (pts[k].cumDist - s.cumDist) / 1000, ele: Math.round(pts[k].ele) });
    if (climbPts[climbPts.length - 1].distKm < lenM / 1000 - 0.01)
      climbPts.push({ distKm: lenM / 1000, ele: Math.round(e.ele) });

    return {
      startIdx, endIdx,
      startDistKm: s.cumDist / 1000,
      endDistKm:   e.cumDist / 1000,
      lengthKm:  lenM / 1000,
      gain:      Math.round(gain),
      avgGrad:   Math.round(avgGrad * 10) / 10,
      maxGrad:   Math.round(Math.min(maxGrad, 22) * 10) / 10,
      startEle:  Math.round(s.ele),
      endEle:    Math.round(e.ele),
      gradProfile,
      climbPts
    };
  },

  _bounds(pts) {
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    return {
      minLat: Math.min(...lats), maxLat: Math.max(...lats),
      minLng: Math.min(...lngs), maxLng: Math.max(...lngs)
    };
  }
};
