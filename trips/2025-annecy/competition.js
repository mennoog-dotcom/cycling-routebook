/* Mini-KOM competition config + standings.
 *
 * `config` is committed, non-secret setup. `standings` is what the Strava-sync
 * backend (Cloudflare Worker) will produce; until that's live it holds sample
 * data so the Klassement tab is visible. When the backend is connected the app
 * fetches /standings and this baked copy is the offline fallback.
 *
 * segmentId = numeric Strava segment id for that day's KOM (null = still to pick).
 * dayIdx    = index into TRIP.days (the ride content, not the calendar slot).
 */
window.COMPETITION_2026 = {
  tripStart: "2026-07-04",
  tripEnd:   "2026-07-11",
  pointsScale: [10, 8, 6, 5, 4, 3, 2, 1],

  stages: [
    { dayIdx: 1, segmentId: 4282288,  label: "Col du Solaison" },
    { dayIdx: 2, segmentId: 39496167, label: "Col du Pré" },
    { dayIdx: 4, segmentId: null,     label: "Col de l'Arpettaz" },
    { dayIdx: 5, segmentId: 37857886, label: "Col du Semnoz" },
    { dayIdx: 6, segmentId: 629017,   label: "Col de la Croix Fry" }
  ],

  riders: [
    { id: "r-menno", name: "Menno" },
    { id: "r-tom",   name: "Tom" },
    { id: "r-bas",   name: "Bas" },
    { id: "r-joris", name: "Joris" }
  ],

  // Produced by the backend. `sample: true` shows a "voorbeeld" badge in the UI.
  standings: {
    sample: true,
    updatedAt: null,
    // Best elapsed time (seconds) per rider per stage (keyed by dayIdx).
    stageResults: {
      "1": [
        { riderId: "r-tom",   seconds: 2634, date: "2026-07-05" },
        { riderId: "r-menno", seconds: 2712, date: "2026-07-05" },
        { riderId: "r-joris", seconds: 2805, date: "2026-07-05" },
        { riderId: "r-bas",   seconds: 2951, date: "2026-07-05" }
      ],
      "2": [
        { riderId: "r-menno", seconds: 3288, date: "2026-07-06" },
        { riderId: "r-bas",   seconds: 3301, date: "2026-07-06" },
        { riderId: "r-tom",   seconds: 3402, date: "2026-07-06" }
      ],
      "6": [
        { riderId: "r-joris", seconds: 1985, date: "2026-07-10" },
        { riderId: "r-tom",   seconds: 2013, date: "2026-07-10" },
        { riderId: "r-menno", seconds: 2044, date: "2026-07-10" },
        { riderId: "r-bas",   seconds: 2190, date: "2026-07-10" }
      ]
    }
  }
};
