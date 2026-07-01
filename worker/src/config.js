// Mirrors trips/2025-annecy/competition.js (keep in sync). Non-secret.
// A Strava segment id can repeat across days (e.g. the huisklim), so efforts
// are matched to a stage by the activity's DATE, not the segment id alone.
export const CONFIG = {
  tripStart: "2026-07-18",
  tripEnd:   "2026-07-24",

  // slot = calendar day (0=Za..6=Vrij). Di (slot 3) is a rest day.
  stages: [
    { slot: 0, date: "2026-07-18", segLong: 17783115, segShort: 17783115 },
    { slot: 1, date: "2026-07-19", segLong: 4282288,  segShort: 4282288 },
    { slot: 2, date: "2026-07-20", segLong: 15792978, segShort: 17509401 },
    { slot: 4, date: "2026-07-22", segLong: 39496167, segShort: 39496167 },
    { slot: 5, date: "2026-07-23", segLong: 37857886, segShort: 17783115 },
    { slot: 6, date: "2026-07-24", segLong: 629017,   segShort: 629017 }
  ],

  // Strava athlete id -> display name. Only these riders are synced.
  riders: {
    "8215035":  "Jort",
    "6134844":  "Anton",
    "9449259":  "Ben",
    "8191772":  "Dirk",
    "26787543": "Jan",
    "7358817":  "Jorrit",
    "8158918":  "Kay",
    "6475072":  "Mark",
    "16325734": "Matthee",
    "453932":   "Menno",
    "2586945":  "Niek",
    "2874716":  "Oskar"
  }
};
