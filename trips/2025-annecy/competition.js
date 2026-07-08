/* Mini-KOM competition config + standings.
 *
 * `config` is committed, non-secret setup (from the shared planning sheet).
 * `standings` is what the Strava-sync backend (Cloudflare Worker) will produce;
 * until that's live it holds sample data so the Klassement tab is visible. When
 * the backend is connected the app fetches /standings and this stays as the
 * offline fallback.
 *
 * Stages are keyed by CALENDAR day (slot 0=Za … 6=Vrij) — the day everyone
 * rides — matching the sheet. Each day has a long-route and short-route Strava
 * segment (often identical). rider.id = numeric Strava athlete id.
 */
window.COMPETITION_2026 = {
  tripStart: "2026-07-18",
  tripEnd:   "2026-07-24",
  pointsScale: [10, 8, 6, 5, 4, 3, 2, 1],

  // Set to the deployed Cloudflare Worker URL to go live (see worker/README.md).
  // When set: the tab fetches <backendUrl>/standings and the Connect button
  // links to <backendUrl>/auth/start. null = use the sample standings below.
  backendUrl: "https://kom-sync.mennoog.workers.dev",

  // slot = index into the (calendar-ordered) week. Di (slot 3) is the rest day.
  stages: [
    { slot: 0, date: "2026-07-18", label: "Huisklim",           segLong: 17783115, segShort: 17783115 },
    { slot: 1, date: "2026-07-19", label: "Col du Solaison",     segLong: 4282288,  segShort: 4282288 },
    { slot: 2, date: "2026-07-20", label: "Col de l'Arpettaz",   segLong: 15792978, segShort: 17509401 },
    { slot: 4, date: "2026-07-22", label: "Col du Pré",          segLong: 39496167, segShort: 39496167 },
    { slot: 5, date: "2026-07-23", label: "Col du Semnoz",       segLong: 37857886, segShort: 17783115 },
    { slot: 6, date: "2026-07-24", label: "Col de la Croix Fry", segLong: 629017,   segShort: 629017 }
  ],

  riders: [
    { id: "8215035",  name: "Jort" },
    { id: "6134844",  name: "Anton" },
    { id: "9449259",  name: "Ben" },
    { id: "8191772",  name: "Dirk" },
    { id: "26787543", name: "Jan" },
    { id: "7358817",  name: "Jorrit" },
    { id: "8158918",  name: "Kay" },
    { id: "6475072",  name: "Mark" },
    { id: "16325734", name: "Matthee" },
    { id: "453932",   name: "Menno" },
    { id: "2586945",  name: "Niek" },
    { id: "2874716",  name: "Oskar" }
  ],

  // Produced by the backend. `sample: true` shows a "voorbeeld" badge in the UI.
  standings: {
    sample: true,
    updatedAt: null,
    // Best elapsed time (seconds) per rider per stage, keyed by slot.
    stageResults: {
      "1": [
        { riderId: "6475072",  seconds: 2634 },
        { riderId: "453932",   seconds: 2712 },
        { riderId: "8215035",  seconds: 2788 },
        { riderId: "2586945",  seconds: 2805 },
        { riderId: "7358817",  seconds: 2951 },
        { riderId: "6134844",  seconds: 3010 }
      ],
      "4": [
        { riderId: "453932",   seconds: 3288 },
        { riderId: "9449259",  seconds: 3301 },
        { riderId: "6475072",  seconds: 3402 },
        { riderId: "2586945",  seconds: 3455 },
        { riderId: "8215035",  seconds: 3560 }
      ],
      "6": [
        { riderId: "7358817",  seconds: 1985 },
        { riderId: "6475072",  seconds: 2013 },
        { riderId: "453932",   seconds: 2044 },
        { riderId: "2586945",  seconds: 2101 },
        { riderId: "9449259",  seconds: 2190 }
      ]
    }
  }
};
