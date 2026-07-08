window.TRIP_2026 = {
  year: 2026,
  destination: "Annecy, France",
  basecamp: "Annecy regio",
  center: [6.35, 45.75],
  defaultZoom: 10,

  days: [
    {
      id: "za", label: "Zaterdag", dayNum: 1,
      theme: "Infietsdag",
      funName: "Benen losmaken",
      emoji: "🏔️",
      description: "Rustig de benen losmaken na de rit. Rondje om de basis, sfeerverkenning, eerste indruk van de bergen. Pas maar op voor die laatste klim – ziet er onschuldig uit op de kaart.",
      longRoute: {
        name: "La route de l'Aiguille",
        km: 25.6, hm: 851, hmPerKm: 33, duration: "1.5 uur",
        strava: "https://www.strava.com/routes/3430909833381675444",
        gpxFile: "day1-long.gpx",
        cols: [
          { name: "Aiguille (lokale klim)", summitEle: 1350, cyclingcolsUrl: null }
        ]
      },
      shortRoute: null,
      timedSegment: null,
      alternative: "Lekker bijkomen van de rit en niets doen.",
      comments: "Inchecken hut is vanaf 16:00. Lekker rustig beginnen."
    },
    {
      id: "zo", label: "Zondag", dayNum: 2,
      theme: "Dagje Tour",
      funName: "Col du Solaison",
      emoji: "🚗", icon: "jersey-yellow",
      description: "Eerste echte bergdag. Col du Solaison is geen bekende naam maar wel een absolute pareltje — steil, bos, uitzicht over het Aravis-gebergte. Evt. Glières erbij mocht de goesting hoog zijn.",
      longRoute: {
        name: "Dagje Tour: Col du Solaison",
        km: 47, hm: 1488, hmPerKm: 31.7, duration: "2.8 uur",
        strava: "https://www.strava.com/routes/3481004762407939272",
        gpxFile: "day2-long.gpx",
        cols: [
          { name: "Col du Solaison", summitEle: 1463, cyclingcolsUrl: "https://www.cyclingcols.com/col/solaison" }
        ]
      },
      shortRoute: null,
      timedSegment: null,
      alternative: "Plateau des Glières erbij voor de liefhebbers.",
      comments: "Auto vanuit base. Evt met Glières erbij mocht goesting hoog zijn."
    },
    {
      id: "ma", label: "Maandag", dayNum: 3,
      theme: "Koninginnenetappe",
      funName: "Vier cols, één dag",
      emoji: "👑",
      description: "De koninginnenetappe. Vier klassieke cols achter elkaar: Saisies, Joly, Pré en Roselend — allemaal richting de wolken. De Cormet de Roselend is een vette doodloper die eindigt bij het stuwmeer. Bereiden of sterven.",
      longRoute: {
        name: "Col des Saisies, Col de Joly, Col du Pré, Roselend",
        km: 137, hm: 4175, hmPerKm: 30, duration: null,
        strava: "https://www.strava.com/routes/3484828970982446566",
        gpxFile: "day3-long.gpx",
        cols: [
          { name: "Col des Saisies",     summitEle: 1633, cyclingcolsUrl: "https://www.cyclingcols.com/col/saisies" },
          { name: "Col de Joly",          summitEle: 1989, cyclingcolsUrl: "https://www.cyclingcols.com/col/joly" },
          { name: "Col du Pré",           summitEle: 1703, cyclingcolsUrl: "https://www.cyclingcols.com/col/pre" },
          { name: "Cormet de Roselend",   summitEle: 1967, cyclingcolsUrl: "https://www.cyclingcols.com/col/roselend" }
        ]
      },
      shortRoute: {
        name: "Col du Pré & Cormet de Roselend",
        km: 53, hm: 1518, hmPerKm: 28.6, duration: "3.1 uur",
        strava: "https://www.strava.com/routes/3431358179689567438",
        gpxFile: "day3-short.gpx",
        cols: [
          { name: "Col du Pré",         summitEle: 1703, cyclingcolsUrl: "https://www.cyclingcols.com/col/pre" },
          { name: "Cormet de Roselend", summitEle: 1967, cyclingcolsUrl: "https://www.cyclingcols.com/col/roselend" }
        ]
      },
      timedSegment: { name: "Col du Pré (vanuit Beaufort)", km: 10.2, gradient: 7.2, stravaUrl: null },
      alternative: "Alleen Pré + Roselend (korte versie).",
      comments: "Auto naar Ugine (30 min). Vette doodloper!"
    },
    {
      id: "di", label: "Dinsdag", dayNum: 4,
      theme: "Rustdag",
      funName: "La Piscine & des Vins",
      emoji: "😴",
      description: "Welverdiende rustdag. Rondje in het zwembad, een glas wijn in de zon, en de benen laten zakken. Voor de onrustige geesten: wandeling of een rustig fietstje.",
      longRoute: null, shortRoute: null,
      timedSegment: null, alternative: null,
      comments: "Rustdag / vrije dag. Zwembad, wijn, zon."
    },
    {
      id: "wo", label: "Woensdag", dayNum: 5,
      theme: "Epische cols",
      funName: "Arpettaz & Tamié",
      emoji: "⚡",
      description: "Arpettaz is een absolute aanrader: rustig dorp uit, dan ineens een smalle bergweg omhoog door het bos die je nergens op voorbereidt. Tamié is de klassieke afsluiter met een abdij halverwege. Kleinere colletjes Vorger & Marais als bonus.",
      longRoute: {
        name: "Arpettaz, Vorger & Col de Tamié",
        km: 114.3, hm: 2664, hmPerKm: 23, duration: null,
        strava: "https://www.strava.com/routes/3430870794761939386",
        gpxFile: "day5-long.gpx",
        cols: [
          { name: "Col de l'Arpettaz", summitEle: 1472, cyclingcolsUrl: "https://www.cyclingcols.com/col/arpettaz" },
          { name: "Col du Vorger",      summitEle: 1066, cyclingcolsUrl: "https://www.cyclingcols.com/col/vorger" },
          { name: "Col de Tamié",       summitEle:  907, cyclingcolsUrl: "https://www.cyclingcols.com/col/tamie" }
        ]
      },
      shortRoute: {
        name: "Vorger & Col de Tamié",
        km: 76.9, hm: 1505, hmPerKm: 20, duration: null,
        strava: "https://www.strava.com/routes/3431355691792546734",
        gpxFile: "day5-short.gpx",
        cols: [
          { name: "Col de l'Arpettaz", summitEle: 1472, cyclingcolsUrl: "https://www.cyclingcols.com/col/arpettaz" },
          { name: "Col du Marais",      summitEle: 1175, cyclingcolsUrl: "https://www.cyclingcols.com/col/marais" }
        ]
      },
      timedSegment: { name: "Col de l'Arpettaz", startDistKm: 9, km: 14.5, gradient: 6.8, stravaUrl: "https://www.strava.com/segments/15792978" },
      alternative: "2e lus afsteken voor nieuw terrein.",
      comments: "Epische col + rustige kleine colletjes."
    },
    {
      id: "do", label: "Donderdag", dayNum: 6,
      theme: "Rondje Annecy",
      funName: "Lac & Semnoz",
      emoji: "🏊",
      description: "Het mooiste meer van de Alpen als decor. Semnoz is het geheim van de regio: geen drukke toeristische col maar een lange klim door het bos met aan de top een panorama van 360°. Daarna afdaling langs het meer. Klassiek.",
      longRoute: {
        name: "Rondje Annecy via Col du Semnoz",
        km: 107.33, hm: 2286, hmPerKm: 21, duration: null,
        strava: "https://www.strava.com/routes/3430847864229606606",
        gpxFile: "day6-long.gpx",
        cols: [
          { name: "Col du Semnoz", summitEle: 1704, cyclingcolsUrl: "https://www.cyclingcols.com/col/chatillon" }
        ]
      },
      shortRoute: {
        name: "Rondje Lac d'Annecy",
        km: 71.8, hm: 938, hmPerKm: 13.1, duration: "3.3 uur",
        strava: "https://www.strava.com/routes/3431337841283236440",
        gpxFile: "day6-short.gpx",
        cols: []
      },
      timedSegment: { name: "Col du Semnoz (vanuit Annecy)", startDistKm: 52, km: 16.4, gradient: 6.5, stravaUrl: "https://www.strava.com/segments/37857886" },
      alternative: "Alleen het meer zonder Semnoz.",
      comments: "Lake views! Collectief t/m Annecy. Meetup na de col?"
    },
    {
      id: "vrij", label: "Vrijdag", dayNum: 7,
      theme: "Uitfietsdag",
      funName: "Aravis Triptiek",
      emoji: "🏁",
      description: "Succesformule van vorig jaar plus Plan Bois als nieuwe toevoeging. Croix Fry is een klassieker die je meermaals kunt rijden — altijd goed. Col des Annes is de cherry on top. Finish met een afdaling die je wil herbeleefde.",
      longRoute: {
        name: "Col de Plan Bois, Croix Fry & Col des Annes",
        km: 73, hm: 2399, hmPerKm: 33, duration: null,
        strava: "https://www.strava.com/routes/3430855578278622650",
        gpxFile: "day7-long.gpx",
        cols: [
          { name: "Col de Plan Bois",    summitEle: 1299, cyclingcolsUrl: "https://www.cyclingcols.com/col/plan-bois" },
          { name: "Col de la Croix Fry", summitEle: 1477, cyclingcolsUrl: "https://www.cyclingcols.com/col/croix-fry" },
          { name: "Col des Annes",       summitEle: 1564, cyclingcolsUrl: "https://www.cyclingcols.com/col/annes" }
        ]
      },
      shortRoute: {
        name: "Col de Croix Fry & Le Grand-Bornand",
        km: 53, hm: 1386, hmPerKm: 26.2, duration: "3.1 uur",
        strava: "https://www.strava.com/routes/3431359997441022158",
        gpxFile: "day7-short.gpx",
        cols: [
          { name: "Col de la Croix Fry", summitEle: 1477, cyclingcolsUrl: "https://www.cyclingcols.com/col/croix-fry" }
        ]
      },
      timedSegment: null,
      alternative: "Afsteken na Croix Fry richting Grand-Bornand.",
      comments: "Succesformule vorige keer + Plan Bois (vorige keer overgeslagen)."
    }
  ],

  // Permanent, committed climb edits (deletions, names, links, categories).
  // Keyed by "<dayIndex>-<routeType>". Generated by the "Bak klim-edits in"
  // button — to update, replace this object with the exported JSON.
  bakedTitle: "Fietsweek 2026 — Annecy, France",

  bakedDayOrder: [0, 1, 4, 3, 2, 5, 6],

  bakedClimbs: {
    "0-long": [
      { startDistKm: 1.295,  endDistKm: 5.314,  colName: "Le Foux", colUrl: null, cat: null },
      { startDistKm: 7.388,  endDistKm: 12.579, colName: "Col de l'Aiquille", colUrl: null, cat: null },
      { startDistKm: 24.253, endDistKm: 25.599, colName: "Maison de Gierende Banden", colUrl: null, cat: null }
    ],
    "1-long": [
      { startDistKm: 13.259, endDistKm: 25.242, colName: "Col du Solaison", colUrl: "https://www.cyclingcols.com/col/solaison", cat: null },
      { startDistKm: 33.965, endDistKm: 37.7,   colName: "Andey", colUrl: null, cat: null }
    ],
    "2-long": [
      { startDistKm: 0.477,   endDistKm: 24.5,    colName: "Col des Saisies", colUrl: "https://www.cyclingcols.com/col/saisies", cat: null },
      { startDistKm: 36.787,  endDistKm: 47.682,  colName: "Col de Joly", colUrl: "https://www.cyclingcols.com/col/joly", cat: null },
      { startDistKm: 69.781,  endDistKm: 82.38,   colName: "Col du Pré", colUrl: "https://www.cyclingcols.com/col/pre", cat: "HC" },
      { startDistKm: 89.873,  endDistKm: 95.591,  colName: "Cormet de Roselend", colUrl: "https://www.cyclingcols.com/col/roselend", cat: null },
      { startDistKm: 126.079, endDistKm: 129.862, colName: "Queige", colUrl: "https://www.cyclingcols.com/col/forclaz-savoie", cat: null }
    ],
    "2-short": [
      { startDistKm: 3.377,  endDistKm: 15.894, colName: "Col du Pré", colUrl: "https://www.cyclingcols.com/col/pre", cat: "HC" },
      { startDistKm: 23.385, endDistKm: 28.997, colName: "Cormet de Roselend", colUrl: "https://www.cyclingcols.com/col/roselend", cat: null }
    ],
    "4-long": [
      { startDistKm: 17.341, endDistKm: 28.034, colName: "Col du Tamié", colUrl: "https://www.cyclingcols.com/col/tamie", cat: null },
      { startDistKm: 35.743, endDistKm: 39.514, colName: "Col du Vorger", colUrl: "https://www.cyclingcols.com/col/vorger", cat: null },
      { startDistKm: 49.031, endDistKm: 65.035, colName: "Col de l'Arpettaz", colUrl: "https://www.cyclingcols.com/col/arpettaz", cat: null },
      { startDistKm: 93.585, endDistKm: 99.88,  colName: "Col de l'Épine", colUrl: "https://www.cyclingcols.com/col/epine", cat: null }
    ],
    "4-short": [
      { startDistKm: 17.341, endDistKm: 28.034, colName: "Col de Tamié", colUrl: "https://www.cyclingcols.com/col/tamie", cat: null },
      { startDistKm: 35.743, endDistKm: 39.477, colName: "Col du Vorger", colUrl: "https://www.cyclingcols.com/col/vorger", cat: null },
      { startDistKm: 56.176, endDistKm: 62.472, colName: "Col de l'Épine", colUrl: "https://www.cyclingcols.com/col/epine", cat: null }
    ],
    "5-long": [
      { startDistKm: 30.95,  endDistKm: 47.91,   colName: "Col du Semnoz", colUrl: "https://www.cyclingcols.com/col/chatillon", cat: "HC" },
      { startDistKm: 92.295, endDistKm: 101.921, colName: "Col du Marais", colUrl: "https://www.cyclingcols.com/col/marais", cat: null }
    ],
    "5-short": [
      { startDistKm: 56.772, endDistKm: 66.626, colName: "Col du Marais", colUrl: null, cat: null },
      { startDistKm: 70.348, endDistKm: 71.79,  colName: "Maison de Gierende Banden", colUrl: null, cat: null }
    ],
    "6-long": [
      { startDistKm: 1.378,  endDistKm: 7.537,  colName: "Col de Plan Bois", colUrl: "https://www.cyclingcols.com/col/plan-bois", cat: null },
      { startDistKm: 12.669, endDistKm: 20.395, colName: "Col de la Croix Fry", colUrl: "https://www.cyclingcols.com/col/croix-fry", cat: null },
      { startDistKm: 38.397, endDistKm: 45.281, colName: "Col des Annes", colUrl: "https://www.cyclingcols.com/col/annes", cat: null },
      { startDistKm: 71.375, endDistKm: 72.697, colName: "Maison de Gierende Banden", colUrl: null, cat: null }
    ],
    "6-short": [
      { startDistKm: 1.378,  endDistKm: 5.253,  colName: "Le Foux", colUrl: null, cat: null },
      { startDistKm: 7.332,  endDistKm: 14.985, colName: "Col de la Croix Fry", colUrl: "https://www.cyclingcols.com/col/croix-fry", cat: "1" },
      { startDistKm: 50.845, endDistKm: 52.773, colName: "Maison de Gierende Banden", colUrl: null, cat: null }
    ]
  },

  bakedStage: {
    "0-long": {
      timedSegment: { name: "Maison de Gierende Banden", startDistKm: 24.136756846404165, km: 1.5, gradient: 7.4, stravaUrl: null }
    },
    "1-long": {
      description: "Eerste echte bergdag en dan meteen zuipen op een col bij de Tour. Col du Solaison is geen bekende naam maar wel een absolute pareltje — steil, bos, uitzicht over het Aravis-gebergte. Evt. Glières erbij mocht de goesting hoog zijn.",
      timedSegment: { name: "Col du Solaison", km: 12, gradient: 8.7, stravaUrl: "https://www.strava.com/segments/4282288", startDistKm: 13.299088772863584 },
      coffee: { text: "Ergens op de berg met een rugtas vol snacks", mapsUrl: null }
    },
    "2-long": {
      description: "This day takes you through some of the most breathtaking scenery the French Alps have to offer, linking four legendary climbs in one epic loop. The Col de Joly is one of the best-kept secrets in the northern Alps, rewarding you with up-close views of Mont Blanc from a quiet, traffic-free road. From there, the Col du Pré is the harder but far more rewarding way into the Cormet de Roselend - 15 hairpins in 7km with long sections over 10%, but with views that keep getting better with every bend. At the top, the turquoise waters of Lac de Roselend, its little chapel, and the surrounding mountain pastures make for one of the most exceptional scenes",
      timedSegment: { name: "Col du Pré", km: 12.6, gradient: 7.6, stravaUrl: "https://www.strava.com/segments/39496167", startDistKm: 69.81136322576361 },
      coffee: { text: "Bovenop col de Joly", mapsUrl: "https://maps.app.goo.gl/Cc66Q5jKCYsx4PaV6" }
    },
    "2-short": {
      timedSegment: { name: "Col du Pré", startDistKm: 3.3769075832648676, km: 12.5, gradient: 7.8, stravaUrl: null }
    },
    "4-long": {
      routeName: "Col de Tamié, Vorger & Arpettaz",
      description: "Arpettaz is een absolute aanrader: rustig dorp uit, dan ineens een smalle bergweg omhoog door het bos die je nergens op voorbereidt. Tamié is de klassieke afsluiter met een abdij halverwege. Kleinere colletjes Vorger, Tamié & Marais als bonus.",
      timedSegment: { name: "Col de l'Arpettaz", startDistKm: 49.04841045173384, km: 16, gradient: 7.2, stravaUrl: null }
    },
    "4-short": {
      routeName: "Col de Tamié, Vorger & l'Épine",
      description: "Arpettaz is een absolute aanrader: rustig dorp uit, dan ineens een smalle bergweg omhoog door het bos die je nergens op voorbereidt. Tamié is de klassieke afsluiter met een abdij halverwege. Kleinere colletjes Vorger, Tamié & Marais als bonus.",
      timedSegment: { name: "Col de l'Épine", startDistKm: 56.25796579675689, km: 6.3, gradient: 7.3, stravaUrl: null },
      coffee: { text: "Gezamelijke lunch in Ugine", mapsUrl: null }
    },
    "5-long": {
      description: "Het mooiste meer van de Alpen als decor. Semnoz is het geheim van de regio: geen drukke toeristische col maar een lange klim door het bos met aan de top een panorama van 360°. Daarna afdaling langs het meer. Klassiek.",
      coffee: { text: "Lunch in Annecy", mapsUrl: null }
    },
    "5-short": {
      description: "Het mooiste meer van de Alpen als decor. Vanuit het huis richting Annecy en vervolgens via het fietspad langs de oevers richting de Col du Marais en huiswaarts. Trek nog even een sprintje voor de KOM van de dag op onze huisklim",
      timedSegment: { name: "Maison de Gierende Banden", km: 1, gradient: 10.4, stravaUrl: "https://www.strava.com/segments/17783115", startDistKm: 70.34761673394826 },
      coffee: { text: "Lunch in Annecy", mapsUrl: null }
    },
    "6-long": {
      description: "Succesformule van vorige keer plus Plan Bois als nieuwe toevoeging. Croix Fry is een klassieker die je meermaals kunt rijden — altijd goed. Col des Annes is de kers op de taart: Steil, alpenweidje tussen de koeien",
      timedSegment: { name: "Col de la Croix Fry", km: 8.2, gradient: 7.2, stravaUrl: "https://www.strava.com/segments/629017", startDistKm: 12.668972744242536 },
      coffee: { text: "Lunch in le grand Bornand met z'n allen", mapsUrl: null }
    },
    "6-short": {
      description: "Via Col de la Croix Fry naar de lunch flaneren in le Grand Bornand en vervolgens via de vallei terug. ",
      timedSegment: { name: "Col de la Croix Fry", km: 8.2, gradient: 7.2, stravaUrl: "https://www.strava.com/segments/629017", startDistKm: 7.331711172878551 },
      coffee: { text: "Lunch in le Grand Bornand met z'n allen", mapsUrl: null }
    }
  },

  bakedLunch: {
    "2": [6.6735076904296875, 45.78165120756128],
    "4": [6.417388916015625, 45.75147468222022],
    "5": [6.129051446914673, 45.89824439654009],
    "6": [6.426293849945068, 45.94163060716565]
  },

  bakedToughness: {
    "1-long": 3,
    "4-long": 4,
    "4-short": 4,
    "5-long": 3.5,
    "6-long": 3.5
  },

  history: [
    { year: 2025, destination: "Haute-Savoie", kmLong: 500.93, hmLong: 14156, hmPerKmLong: 26, duurLong: "22.8 uur", days: 5, kmShort: 327, hmShort: 6323 },
    { year: 2024, destination: "Stelvio",      kmLong: 553,    hmLong: 14376, hmPerKmLong: 26, duurLong: "29.1 uur", days: 5, kmShort: 322, hmShort: 6153 },
    { year: 2023, destination: "ALS Tour",     kmLong: 1127,   hmLong: 12039, hmPerKmLong: 11, duurLong: "45.1 uur", days: 8, kmShort: 563, hmShort: 6020 },
    { year: 2022, destination: "Morzine",      kmLong: 458,    hmLong: 10846, hmPerKmLong: 24, duurLong: "24.1 uur", days: 5, kmShort: 301, hmShort: 7618 },
    { year: 2021, destination: "Embrun",       kmLong: 447,    hmLong: 11959, hmPerKmLong: 27, duurLong: "23.5 uur", days: 5, kmShort: 373, hmShort: 9695 },
    { year: 2020, destination: "Canazei",      kmLong: 540,    hmLong: 14251, hmPerKmLong: 26, duurLong: "28.4 uur", days: 5, kmShort: 401, hmShort: 10377 },
    { year: 2019, destination: "Annecy",       kmLong: 494,    hmLong: 13400, hmPerKmLong: 27, duurLong: "26.0 uur", days: 5, kmShort: 377, hmShort: 9150 },
    { year: 2018, destination: "Como",         kmLong: 448,    hmLong: 10900, hmPerKmLong: 24, duurLong: "23.6 uur", days: 5, kmShort: 331, hmShort: 8100 },
    { year: 2017, destination: "Pyreneeën",    kmLong: 397,    hmLong: 11808, hmPerKmLong: 30, duurLong: "22.1 uur", days: 5, kmShort: 291, hmShort: 10054 },
    { year: 2016, destination: "La Douce",     kmLong: 521,    hmLong: 11202, hmPerKmLong: 22, duurLong: "27.4 uur", days: 5, kmShort: null, hmShort: null }
  ]
};
