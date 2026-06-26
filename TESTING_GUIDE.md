# Testing Guide - All Fixes

## Quick Start Testing

Open the app in your browser and follow these steps to verify all fixes:

---

## Test 1: Duplicate Climbs Fix (Issue 5)
**Expected**: Col de Tamié appears only once, not three times

1. Open the app (index.html)
2. Click on the "2025" trip card
3. Click on "Woensdag" (Day 5)
4. Scroll down to the climb pills section
5. **Verify**: You see exactly these climbs listed once each:
   - Col de l'Arpettaz
   - Col du Vorger
   - Col de Tamié
6. **NOT** Col de Tamié three times

**If fails**: Check browser console for JavaScript errors

---

## Test 2: Day 1 Camera Fix (Issue 6)
**Expected**: Day 1 map clearly shows the route without being hidden

1. From the overview, click on "Zaterdag" (Day 1)
2. Look at the 3D map on the left
3. **Verify**: You can see the route clearly in an orange line
4. The route is NOT hidden behind a mountain
5. Repeat for "Zondag" (Day 2)

**If fails**: You might see a mountain taking up most of the screen - this would indicate the pitch is still too high

---

## Test 3: Altitude Chart Hover (Issue 4)
**Expected**: Yellow dot follows your mouse on the map when hovering over the chart

1. Open any day with a route (e.g., Day 1 or 5)
2. Locate the altitude profile chart (gray area with orange line)
3. Move your mouse over the altitude chart
4. **Verify**: A yellow dot with a white outline appears on the map
5. The dot moves as you hover different parts of the chart
6. When you move your mouse away, the dot disappears

**If fails**: The yellow dot doesn't appear - check:
- Is the map visible?
- Are there JavaScript errors in console?
- Try a different browser

---

## Test 4: Promote Climb to KOM (Issue 2)
**Expected**: Can click a climb and make it the KOM segment

1. Open Day 6 (Donderdag) - Semnoz route
2. Scroll down to the climb pills section (below altitude chart)
3. Click on "Col du Semnoz" pill
4. A popup should appear with climb details
5. **Look for**: A button that says "⏱ Stel in als KOM"
6. Click that button
7. **Verify**: 
   - A popup message appears: "Col du Semnoz geselecteerd als KOM segment!"
   - The altitude chart updates with a yellow KOM highlight box
   - The box should cover the actual climbing section (not the descent)

**To change KOM back**:
- Open browser Developer Tools (F12)
- Go to Application → Local Storage
- Find the key: `kom-2025-5-long` (or appropriate day)
- Delete it
- Refresh the page

**If fails**: 
- Check that the button appears in the popup
- Check console for JavaScript errors

---

## Test 5: Editable Overview Title (Issue 3)
**Expected**: Can click and edit the trip title

1. Go back to the Overview page
2. Look at the title at the top: "Fietsweek 2025 — Haute-Savoie, France"
3. Click on the title
4. **Verify**: 
   - The title text becomes editable (you can type)
   - There's a subtle orange highlight around it
5. Try typing: "My Amazing Bike Trip 2025"
6. Press Enter or click elsewhere
7. **Verify**: 
   - The new title is saved
   - Refresh the page - the new title persists!

**To reset**: 
- Delete localStorage key: `trip-title-2025`
- Refresh page

**If fails**:
- Title might not be clickable - check if contenteditable is enabled
- New title might not persist - check if localStorage is allowed in your browser

---

## Test 6: KOM Positioning (Issue 1)
**Expected**: KOM segment highlights correctly on the altitude chart

### For Semnoz (Day 6):
1. Open Day 6 (Donderdag)
2. Look at the altitude chart
3. Currently shows: startDistKm: 52, km: 16.4
4. **Expected behavior**:
   - Yellow KOM box should highlight the CLIMBING portion
   - NOT the descent portion

**If KOM is on descent**:
- This means the startDistKm value is wrong
- Solution: Promote the correct climb to KOM
  1. Look for a climb pill that covers the actual climb (not descent)
  2. Click it
  3. Click "⏱ Stel in als KOM"
  4. The chart should update with correct position

---

## Troubleshooting

### Yellow dot doesn't show on hover
- Check browser console (F12 → Console tab)
- Look for red error messages
- Clear browser cache and refresh

### Climb names still show duplicates
- Clear localStorage
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Title edit doesn't work
- Make sure you're on the Overview page (not home or day view)
- Click directly on the title text
- Try in a different browser if issue persists

### KOM button doesn't appear
- Check that popup opens when clicking a climb
- Look for "⏱ Stel in als KOM" button in popup
- If missing, check browser console for errors

---

## Performance Notes

These changes should not impact performance:
- Climb matching is O(n*m) but typically n<10 climbs, m<10 cols
- Hover tracking uses efficient closest-match algorithm
- localStorage persists automatically

---

## Browser Compatibility

Tested with:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Features used:
- contenteditable (all browsers)
- localStorage (all browsers)
- Chart.js 4.x (all browsers)
- MapLibre GL 4.x (all browsers)

---

## Next Steps After Testing

If everything works:
1. ✅ All fixes verified
2. Consider making day descriptions editable (currently only title)
3. Consider adding ability to edit timedSegment directly
4. Monitor KOM positioning across all routes

If something fails:
1. Check JavaScript console for errors
2. Try clearing browser cache
3. Test in a different browser
4. Check localStorage is enabled

---

## Known Limitations

1. **KOM coordinates**: When using the original timedSegment from trip.js, ensure startDistKm is accurate. Use "Promote to KOM" if coordinates are wrong.

2. **Editable text**: Currently only the overview title is editable. Day descriptions can be made editable in future updates.

3. **Climb detection**: May not detect very short climbs (<800m) or very gentle climbs (<4% gradient). This is by design to filter GPS noise.

4. **Hover marker**: Only shows on hover, disappears when mouse leaves chart. This is intentional to keep the map clean.

---

## Questions?

If anything doesn't work as expected:
1. Check the JavaScript console for error messages
2. Clear browser cache and localStorage
3. Try a different browser
4. Check that GPX files are loaded correctly

Good luck testing! 🚴
