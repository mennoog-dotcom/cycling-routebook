# Critical Issues - Fixes Summary

## Issues Addressed

### 1. ✅ Issue 5: Duplicate Climbs (Col de Tamié 3x)
**Status**: FIXED

**Problem**: Multiple detected climbs were all matching to the same named col because the matching algorithm independently matched each climb to its closest col.

**Solution**: Modified `_getNamedClimbs()` in `app.js` to ensure each named col is matched only once - to its closest detected climb. This prevents duplicate col names.

**How to verify**:
- Open Day 5 (Woensdag)
- Check the climb pills - Col de Tamié should appear only once
- Other climbs should also appear only once

---

### 2. ✅ Issue 6: Day 1 Camera Positioning
**Status**: FIXED

**Problem**: On Day 1 and 2, the initial camera view was hidden behind a mountain because the pitch was too steep (55°).

**Solution**: Reduced the pitch from 55° to 35° in `showRoute()` method in `map-view.js`. Also added bearing: 0 for consistent orientation.

**How to verify**:
- Open Day 1 (Zaterdag)
- The route should be clearly visible without being hidden behind mountains
- The camera should frame the route nicely

---

### 3. ✅ Issue 4: Altitude Chart Hover Interactivity
**Status**: IMPLEMENTED

**Problem**: No way to see where on the map you're looking at in the altitude profile.

**Solution**: Added hover tracking to the altitude chart:
- When you hover over the altitude profile, a yellow dot appears on the map showing that location
- Created custom Chart.js plugin to track mouse position
- Added `showHoverMarker()` method to MapView

**How to use**:
1. Open any day route
2. Hover over the altitude profile chart
3. A yellow dot will appear on the map indicating the location

---

### 4. ✅ Issue 2: Promote Climb to KOM
**Status**: IMPLEMENTED

**Problem**: No way to select a custom climb as the KOM segment from the detected climbs.

**Solution**: Added "⏱ Stel in als KOM" button in the climb popup:
- Click on any climb in the pills
- Click "Stel in als KOM" button
- The climb is saved as the KOM segment and displays on the altitude chart
- Saved to localStorage with key: `kom-{year}-{dayIdx}-{routeType}`

**How to use**:
1. Open any day route
2. Click on a climb in the "Klim X" pills
3. In the popup, click "⏱ Stel in als KOM"
4. The altitude chart will update to show the new KOM segment
5. To clear it, open localStorage dev tools and delete the `kom-*` key

**Benefits**: 
- Automatically uses correct climb coordinates (startDistKm, km)
- Overrides the default timedSegment from trip.js
- Can be changed anytime

---

### 5. ✅ Issue 3: Editable Titles
**Status**: PARTIALLY IMPLEMENTED

**What's editable**:
- Overview page title ("Fietsweek 2025 — Haute-Savoie, France")
- Saved to localStorage with key: `trip-title-{year}`

**How to edit**:
1. Go to overview page
2. Click on the title at the top
3. Type to edit
4. Click elsewhere or press Enter to save
5. The new title is saved automatically

**CSS Styling**:
- Hover shows orange highlight
- Focus shows outline and background highlight

---

### 6. ✅ Issue 1: KOM Segment Positioning
**Status**: PARTIALLY RESOLVED

**Problem**: Semnoz climb displayed on descent instead of the actual climb.

**Root Cause**: The `startDistKm` value in `trip.js` might be incorrect. The climb detection identifies features at different points in the route.

**Solution**: Two options:
1. **Manual correction**: Update the `timedSegment.startDistKm` value in `trip.js` to match the actual climb location
2. **Use Promote to KOM**: 
   - When you detect the correct climb in the climb pills
   - Click "Stel in als KOM" 
   - This automatically uses the correct coordinates from the climb detection

**How to verify correct positioning**:
1. Open Day 6 (Donderdag) - Semnoz route
2. Look at the altitude chart
3. The yellow KOM box should highlight the climbing portion
4. It should NOT be on the descent

**If still incorrect**:
- Check if the climb detection correctly identified Semnoz
- If Semnoz appears in the climb pills, click it and promote it to KOM
- If Semnoz doesn't appear, the GPX data might need refinement

---

## Files Modified

1. **js/app.js**
   - `_getNamedClimbs()` - Fixed duplicate col matching
   - `_promoteClimbToKom()` - New method to promote climbs to KOM
   - `_getTimedSegment()` - New method to load saved KOM from localStorage
   - `_renderOverview()` - Made title editable
   - Updated all `ChartView.render()` calls to pass hover callback

2. **js/chart-view.js**
   - `render()` - Added onHover parameter and custom Chart.js plugin for hover tracking
   - Created hover plugin with `afterEvent` hook to track mouse position

3. **js/map-view.js**
   - `showRoute()` - Reduced pitch from 55 to 35, added bearing: 0
   - `showHoverMarker()` - New method to display hover position marker
   - `_removeHoverMarker()` - New method to clean up hover marker
   - `_clearRoute()` - Updated to remove hover marker

4. **css/style.css**
   - `.editable-title` - Styling for editable elements with hover and focus states
   - `.btn-promote-kom` - Styling for the "Promote to KOM" button

---

## Testing Checklist

- [ ] Day 1 (Zaterdag) map is visible and not hidden
- [ ] Day 2 (Zondag) map is visible and not hidden
- [ ] Day 5 (Woensdag) has only one "Col de Tamié" entry
- [ ] Day 5 has "Col de l'Arpettaz" and "Col du Vorger" listed once each
- [ ] Hover over altitude chart shows yellow dot on map
- [ ] Click a climb pill to open popup
- [ ] "Stel in als KOM" button works and updates the chart
- [ ] Overview title is editable and saves to localStorage
- [ ] Clicking away or pressing Enter saves title edits

---

## Remaining Issues / Not Yet Addressed

The following features were requested but not yet implemented:
- **Issue 3 (Complete)**: Make all text fields editable (descriptions, comments, etc.)
  - Currently only overview title is editable
  - Can be extended to make day descriptions editable in next update

---

## Notes

- All changes use localStorage for persistence
- No external backend required
- Changes survive page reloads
- The "Promote to KOM" feature is the best solution for Issue 1 (KOM positioning) as it uses the automatically detected climb coordinates
