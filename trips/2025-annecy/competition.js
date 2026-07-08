/* Mini-KOM competition config + standings.
 *
 * `config` is committed, non-secret setup (from the shared planning sheet).
 * `standings` is what the Strava-sync backend (Cloudflare Worker) produces;
 * until real times exist it holds sample data so the Klassement tab is visible.
 *
 * Stages are keyed by CALENDAR day (slot 0=Za … 6=Vrij). Each day has a
 * long-route and short-route Strava segment. When they're identical the daily
 * board is merged; when they differ (Ma, Do) there's a separate Lang and Kort
 * board, and the overall GC is split into a Long and a Short classification.
 *
 * standings.stageResults[slot] = [{ riderId, long: <sec|null>, short: <sec|null> }]
 *   long  = best elapsed time on that day's long-route segment
 *   short = best elapsed time on that day's short-route segment
 * rider.id = numeric Strava athlete id.
 */
window.COMPETITION_2026 = {
  tripStart: "2026-07-18",
  tripEnd:   "2026-07-24",
  pointsScale: [10, 8, 6, 5, 4, 3, 2, 1],

  // Deployed Cloudflare Worker (see worker/README.md). Tab fetches
  // <backendUrl>/standings and the Connect button links to /auth/start.
  backendUrl: "https://kom-sync.mennoog.workers.dev",

  // slot = calendar day (0=Za..6=Vrij). Di (slot 3) is a rest day.
  // label = long/primary segment name; labelShort only needed on split days.
  stages: [
    { slot: 0, date: "2026-07-18", label: "Huisklim",           segLong: 17783115, segShort: 17783115 },
    { slot: 1, date: "2026-07-19", label: "Col du Solaison",     segLong: 4282288,  segShort: 4282288 },
    { slot: 2, date: "2026-07-20", label: "Col de l'Arpettaz",   segLong: 15792978, segShort: 17509401, labelShort: "Korte route" },
    { slot: 4, date: "2026-07-22", label: "Col du Pré",          segLong: 39496167, segShort: 39496167 },
    { slot: 5, date: "2026-07-23", label: "Col du Semnoz",       segLong: 37857886, segShort: 17783115, labelShort: "Huisklim" },
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

  // Produced by the backend. `sample: true` shows a "voorbeeld" badge.
  standings: {
    sample: true,
    updatedAt: null,
    stageResults: {
      // Zo — Solaison (merged: long === short)
      "1": [
        { riderId: "6475072",  long: 2634, short: 2634 },
        { riderId: "453932",   long: 2712, short: 2712 },
        { riderId: "8215035",  long: 2788, short: 2788 },
        { riderId: "2586945",  long: 2805, short: 2805 },
        { riderId: "7358817",  long: 2951, short: 2951 },
        { riderId: "6134844",  long: 3010, short: 3010 }
      ],
      // Ma — Arpettaz (SPLIT: some rode the long segment, others the short)
      "2": [
        { riderId: "6475072",  long: 3520, short: null },
        { riderId: "453932",   long: 3604, short: null },
        { riderId: "8215035",  long: 3705, short: null },
        { riderId: "2586945",  long: 3810, short: null },
        { riderId: "6134844",  long: null, short: 1402 },
        { riderId: "7358817",  long: null, short: 1451 },
        { riderId: "9449259",  long: null, short: 1523 }
      ],
      // Wo — Col du Pré (merged)
      "4": [
        { riderId: "453932",   long: 3288, short: 3288 },
        { riderId: "9449259",  long: 3301, short: 3301 },
        { riderId: "6475072",  long: 3402, short: 3402 },
        { riderId: "2586945",  long: 3455, short: 3455 },
        { riderId: "8215035",  long: 3560, short: 3560 }
      ],
      // Do — Semnoz (long) vs Huisklim (short) — SPLIT
      "5": [
        { riderId: "453932",   long: 3901, short: null },
        { riderId: "6475072",  long: 3955, short: null },
        { riderId: "8215035",  long: 4102, short: null },
        { riderId: "6134844",  long: null, short: 604 },
        { riderId: "7358817",  long: null, short: 618 },
        { riderId: "9449259",  long: null, short: 641 }
      ],
      // Vrij — Croix Fry (merged)
      "6": [
        { riderId: "7358817",  long: 1985, short: 1985 },
        { riderId: "6475072",  long: 2013, short: 2013 },
        { riderId: "453932",   long: 2044, short: 2044 },
        { riderId: "2586945",  long: 2101, short: 2101 },
        { riderId: "9449259",  long: 2190, short: 2190 }
      ]
    }
  }
};
