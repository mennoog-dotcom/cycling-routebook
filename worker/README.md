# KOM sync — Cloudflare Worker

Pulls each rider's Strava segment efforts on the daily KOM segments and serves a
computed `standings.json` the routebook reads. No public Strava leaderboard API
exists, so every rider connects their own Strava once and we read *their own*
activity efforts.

## One-time setup

1. **Strava API app** — https://www.strava.com/settings/api
   - Note the **Client ID** and **Client Secret**.
   - Set **Authorization Callback Domain** to your Worker domain (e.g.
     `kom-sync.<your-subdomain>.workers.dev`) — you'll know it after step 4.

2. **Install + login**
   ```
   cd worker
   npm i -g wrangler
   wrangler login
   ```

3. **Create the KV namespace** and paste the id into `wrangler.toml`:
   ```
   wrangler kv namespace create KOM
   ```

4. **First deploy** (gives you the Worker URL):
   ```
   wrangler deploy
   ```
   Copy the printed `https://kom-sync.<subdomain>.workers.dev` URL.

5. **Fill in `wrangler.toml` [vars]**: `STRAVA_CLIENT_ID`, `REDIRECT_URI`
   (`<worker-url>/auth/callback`), `ALLOW_ORIGIN` (your Pages origin). Then set
   the Strava app's Callback Domain to the worker host.

6. **Set the secret(s)**:
   ```
   wrangler secret put STRAVA_CLIENT_SECRET
   wrangler secret put SYNC_KEY        # optional, protects GET /sync
   ```

7. **Redeploy**: `wrangler deploy`

8. **Point the site at it** — in `trips/2025-annecy/competition.js` set
   `backendUrl: "https://kom-sync.<subdomain>.workers.dev"` and commit.

## Use
- Each rider opens `<worker-url>/` and clicks **Koppel met Strava** once.
- The cron (every 30 min) refreshes standings; or hit `<worker-url>/sync?key=...`.
- The site fetches `<worker-url>/standings` and renders the Klassement live.

## Notes
- Only athlete ids listed in `src/config.js` are counted. Keep it in sync with
  `competition.js`.
- Efforts are matched to a stage by the **activity date**, so a segment reused on
  two days (e.g. the huisklim) is attributed correctly.
- Secrets live only in the Worker env — never in this repo.
