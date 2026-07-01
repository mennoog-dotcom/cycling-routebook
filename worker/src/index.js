// Strava KOM sync — Cloudflare Worker.
//
// Routes:
//   GET /                 status + "connect with Strava" page
//   GET /auth/start       redirect a rider to Strava OAuth
//   GET /auth/callback    exchange code, store the rider's refresh token in KV
//   GET /standings        public JSON the site reads (CORS)
//   GET /sync?key=...     manual sync trigger (protected by SYNC_KEY if set)
// Plus a cron trigger that runs the same sync automatically.
//
// Secrets are provided via env: STRAVA_CLIENT_SECRET (required), SYNC_KEY (optional).
// Public vars (wrangler.toml): STRAVA_CLIENT_ID, REDIRECT_URI, ALLOW_ORIGIN.

import { CONFIG } from './config.js';

const STRAVA = 'https://www.strava.com';
const API = 'https://www.strava.com/api/v3';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname.replace(/\/$/, '') || '/';
    try {
      if (p === '/') return htmlPage(statusPage(env));
      if (p === '/auth/start') return authStart(env);
      if (p === '/auth/callback') return authCallback(url, env);
      if (p === '/standings') return standings(request, env);
      if (p === '/sync') {
        if (env.SYNC_KEY && url.searchParams.get('key') !== env.SYNC_KEY)
          return json({ error: 'unauthorized' }, 401, env);
        const out = await syncAll(env);
        return json({ ok: true, updatedAt: out.updatedAt, stages: Object.keys(out.stageResults).length }, 200, env);
      }
      return new Response('Not found', { status: 404 });
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, env);
    }
  },

  // Automatic pull (see crons in wrangler.toml)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncAll(env));
  }
};

// ── OAuth ────────────────────────────────────────────────────────────────
function authStart(env) {
  const q = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: env.REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all'
  });
  return Response.redirect(`${STRAVA}/oauth/authorize?${q}`, 302);
}

async function authCallback(url, env) {
  const code = url.searchParams.get('code');
  if (!code) return htmlPage('<h1>Koppelen mislukt</h1><p>Geen code ontvangen.</p>');

  const res = await fetch(`${STRAVA}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code'
    })
  });
  const tok = await res.json();
  if (!tok.access_token) return htmlPage(`<h1>Koppelen mislukt</h1><pre>${esc(JSON.stringify(tok, null, 2))}</pre>`);

  const athleteId = String(tok.athlete?.id);
  const name = CONFIG.riders[athleteId] || tok.athlete?.firstname || 'Renner';
  await env.KOM.put(`rider:${athleteId}`, JSON.stringify({
    athleteId, name, refreshToken: tok.refresh_token, connectedAt: new Date().toISOString()
  }));

  const known = CONFIG.riders[athleteId] ? '' :
    '<p style="color:#b45309">Let op: dit Strava-account staat niet in de deelnemerslijst — je tijden tellen pas mee als je id wordt toegevoegd.</p>';
  return htmlPage(`<h1>Gekoppeld ✅</h1><p>Bedankt <b>${esc(name)}</b>! Je Strava is verbonden. Je tijden op de KOM-segmenten worden nu automatisch opgehaald.</p>${known}<p>Je mag dit tabblad sluiten.</p>`);
}

// ── Standings (public read) ────────────────────────────────────────────────
async function standings(request, env) {
  if (request.method === 'OPTIONS') return json({}, 204, env);
  const raw = await env.KOM.get('standings');
  const data = raw ? JSON.parse(raw) : { sample: false, updatedAt: null, stageResults: {} };
  return json(data, 200, env);
}

// ── Sync ───────────────────────────────────────────────────────────────────
async function syncAll(env) {
  const list = await env.KOM.list({ prefix: 'rider:' });
  const best = {}; // slot -> athleteId -> seconds

  const after = Math.floor(Date.parse(CONFIG.tripStart + 'T00:00:00Z') / 1000) - 86400;
  const before = Math.floor(Date.parse(CONFIG.tripEnd + 'T23:59:59Z') / 1000) + 86400;

  for (const k of list.keys) {
    let rider;
    try { rider = JSON.parse(await env.KOM.get(k.name)); } catch { continue; }
    try {
      const token = await accessToken(env, rider);
      const acts = await getJson(`${API}/athlete/activities?after=${after}&before=${before}&per_page=100`, token);
      for (const a of Array.isArray(acts) ? acts : []) {
        if (a.type && a.type !== 'Ride' && a.sport_type !== 'Ride') continue;
        const date = String(a.start_date_local || a.start_date || '').slice(0, 10);
        const stage = CONFIG.stages.find(s => s.date === date);
        if (!stage) continue;
        const segIds = [stage.segLong, stage.segShort].filter(Boolean);
        const detail = await getJson(`${API}/activities/${a.id}?include_all_efforts=true`, token);
        const efforts = (detail.segment_efforts || []).filter(e => segIds.includes(e.segment?.id));
        if (!efforts.length) continue;
        const t = Math.min(...efforts.map(e => e.elapsed_time));
        const slot = String(stage.slot);
        best[slot] = best[slot] || {};
        if (best[slot][rider.athleteId] == null || t < best[slot][rider.athleteId])
          best[slot][rider.athleteId] = t;
      }
    } catch (e) { /* skip this rider on any error, keep going */ }
  }

  const out = { sample: false, updatedAt: new Date().toISOString(), stageResults: {} };
  for (const slot in best)
    out.stageResults[slot] = Object.entries(best[slot]).map(([riderId, seconds]) => ({ riderId, seconds }));
  await env.KOM.put('standings', JSON.stringify(out));
  return out;
}

// Exchange the stored refresh token for a fresh access token; persist rotation.
async function accessToken(env, rider) {
  const res = await fetch(`${STRAVA}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: rider.refreshToken
    })
  });
  const tok = await res.json();
  if (!tok.access_token) throw new Error('token refresh failed for ' + rider.athleteId);
  if (tok.refresh_token && tok.refresh_token !== rider.refreshToken) {
    rider.refreshToken = tok.refresh_token;
    await env.KOM.put(`rider:${rider.athleteId}`, JSON.stringify(rider));
  }
  return tok.access_token;
}

async function getJson(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 429) throw new Error('rate limited');
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// ── helpers ─────────────────────────────────────────────────────────────────
function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type'
  };
}
function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(env) }
  });
}
function htmlPage(body) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>KOM sync</title>
    <body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5;color:#111">${body}</body>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
function statusPage(env) {
  const connect = `${(env.REDIRECT_URI || '').replace(/\/auth\/callback$/, '')}/auth/start`;
  return `<h1>🏆 KOM sync</h1>
    <p>Verbind je Strava zodat je tijden op de KOM-segmenten automatisch meetellen in het klassement.</p>
    <p><a href="${connect}" style="display:inline-block;background:#FC4C02;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Koppel met Strava</a></p>
    <p style="color:#666;font-size:.9rem">Deelnemers: ${Object.values(CONFIG.riders).map(esc).join(', ')}.</p>`;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
