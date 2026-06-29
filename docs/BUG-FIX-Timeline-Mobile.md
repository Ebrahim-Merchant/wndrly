# Bug Fix: Timeline Width + Mobile Issues

## Status
- **Branch:** `copilot/update-ui-to-match-mockups`
- **Last commits:** Attempted fixes in `74ae83d5` and `71b199f3` (remove `md:!left-60`, remove inline `left:0`)
- **⚠️ Deployed build is STALE** — PM2 serving old bundle from before fix commits

---

## Bug 1: Timeline/Content Not Taking Full Width When Sidebar Collapses

### Root Cause

The deployed bundle still contains old Tailwind classes (`md:!left-60`) that hardcode `left: 240px` regardless of sidebar state. The git fixes were committed but **never rebuilt/redeployed**.

**Deployed DOM state** (verified via browser evaluate):
```
Outer root:     .wndrly-page-root  → left: var(--sidebar-w) ✅ (responds to collapse)
Top navbar:     .md:!left-60       → left: 240px !important ❌ (hardcoded)
Inner content:  .md:!left-60       → left: 240px !important ❌ (hardcoded)
```

When sidebar collapses (64px), the outer root shifts to `left: 64px` but inner children stay at 240px → content area shrinks instead of expanding.

### Fix Already in Source (Needs Rebuild)

The commits `74ae83d5` + `71b199f3` already fixed this in source:
- Removed `md:!left-60` from top navbar
- Changed inner content div from `md:!left-60` to `wndrly-page-root` class
- Removed inline `left: 0` from outer root

**After rebuild, the layout will be:**
```
Outer root:     .wndrly-page-root  → left: var(--sidebar-w) !important
Top navbar:     (no left class)    → left: 0 (full viewport, hidden behind sidebar)
Inner content:  .wndrly-page-root  → left: var(--sidebar-w) !important
```

### Remaining Issue: Top Navbar Doesn't Shift

The top navbar (`position: fixed; left: 0; right: 0`) renders from viewport edge 0 to right edge. The sidebar (z-index 200) covers its left portion. When sidebar collapses to 64px, there's a 0-64px strip where the navbar shows behind the collapsed sidebar icons. This is **visually acceptable** but slightly imprecise.

**Optional improvement** — give the top navbar dynamic left:

```tsx
// In TripPlannerPage.tsx, line ~787, the top bar div:
<div style={{
  position: 'fixed', top: 0, right: 0, zIndex: 40,
  // ...existing styles...
}} className="wndrly-page-root">
```

Remove the inline `left: 0` from the top bar and add `wndrly-page-root` class. This makes the navbar shift with the sidebar.

### Deployment Fix

```bash
cd ~/wndrly
npm run build --prefix client   # or: cd client && npm run build
pm2 restart wndrly
```

---

## Bug 2: Mobile Issues

### Investigation Results

Mobile was tested at 390×844 viewport. **Core functionality works:**
- ✅ Map renders correctly
- ✅ "Plan" / "Places" floating buttons appear
- ✅ Plan overlay opens full-screen with List/Timeline views
- ✅ Bottom navigation bar visible and functional
- ✅ Top tab bar (Plan, Transports, etc.) renders
- ✅ Sidebar hidden on mobile (`hidden md:flex`)
- ✅ `--sidebar-w` CSS var irrelevant on mobile (media query is `min-width: 768px`)

### Potential Mobile Issues Found

#### Issue 2a: Top Tab Bar Not Scrollable/Accessible
The top tab bar on mobile contains 7 tabs (Plan, Transports, Bookings, Lists, Budget, Files, Collab) in 52px height. On narrow screens, tabs overflow. The `SlidingTabs` component may need horizontal scrolling.

**File:** `client/src/components/shared/SlidingTabs.tsx`
**Fix:** Ensure the tab container has `overflow-x: auto` and `-webkit-overflow-scrolling: touch` on mobile. Add `scrollbar-width: none` to hide scrollbar.

#### Issue 2b: Stale Build CSS Conflict
The deployed `md:!left-60` class sets `left: 240px` at ≥768px. If a user tests on a tablet (768-1024px width), the content would be offset 240px with the sidebar visible at 240px width — this is correct. But if the user rotates from portrait (< 768px) to landscape (≥ 768px), there could be a flash where content jumps.

**Fix:** Resolved by the source changes (replacing `md:!left-60` with `wndrly-page-root` class). Just needs rebuild.

#### Issue 2c: iOS Safari `position: fixed` + `inset` Quirks
The inner content div uses individual `top/left/right/bottom` properties. React renders them individually. On iOS Safari, `position: fixed` elements inside other fixed elements can have viewport calculation issues, especially with the iOS address bar appearing/disappearing.

**File:** `client/src/pages/TripPlannerPage.tsx`, line ~849
**Mitigation:** Use `height: calc(100vh - 52px)` instead of `bottom: 0` for the inner content div, or use `100dvh` (dynamic viewport height):

```tsx
<div style={{
  position: 'fixed',
  top: 52,
  left: 0,
  right: 0,
  height: 'calc(100dvh - 52px)',  // dynamic viewport height
  overflow: 'hidden',
  overscrollBehavior: 'contain'
}} className="wndrly-page-root">
```

#### Issue 2d: Touch Events on Map Conflicting with Mobile Buttons
The "Plan" and "Places" floating buttons are portaled to `document.body` to escape Leaflet's touch handling. This should work, but if Leaflet captures pointer events aggressively on iOS, the buttons may be unresponsive on first tap.

**File:** `client/src/pages/TripPlannerPage.tsx`, mobile sidebar buttons section
**Verify:** Test on actual iOS device. If buttons are unresponsive, add `touch-action: manipulation` (already present in inline styles).

#### Issue 2e: Bottom Nav Overlap
The TripPlannerPage uses `paddingBottom: 'var(--bottom-nav-h)'` on scrollable tab content (non-plan tabs). For the plan tab (map view), the map fills the entire area. The floating "Plan"/"Places" buttons are positioned at `top: 64` — they don't conflict with the bottom nav.

**Status:** Working correctly ✅

---

## Summary of Required Actions

### Immediate (fixes both bugs):
1. **Rebuild the client** — the source fixes are already committed
   ```bash
   cd ~/wndrly/client && npm run build && cd .. && pm2 restart wndrly
   ```

### Additional Recommended Fixes:

| Priority | File | Change |
|----------|------|--------|
| High | `TripPlannerPage.tsx:787` | Add `wndrly-page-root` class to top navbar, remove inline `left: 0` |
| Medium | `TripPlannerPage.tsx:849` | Change `bottom: 0` to `height: calc(100dvh - 52px)` for iOS Safari |
| Low | `SlidingTabs.tsx` | Ensure horizontal scroll on mobile with hidden scrollbar |

### Testing Steps

1. Rebuild client: `cd ~/wndrly/client && npm run build`
2. Restart PM2: `pm2 restart wndrly`
3. **Desktop test:**
   - Open https://wndrly.ebrahim.world/trips/1
   - Collapse sidebar (hamburger) → content should expand to fill freed space
   - Expand sidebar → content should shrink back
   - Verify top navbar stays aligned with content
4. **Mobile test (390px viewport or actual device):**
   - Verify map renders full-width with no left offset
   - Tap "Plan" button → overlay should open smoothly
   - Scroll through days in the plan overlay
   - Swipe through top tabs (Transports, Budget, etc.)
   - Check bottom nav is accessible from all tabs
5. **Tablet test (768-1024px):**
   - Sidebar should show + content offset correctly
   - Collapse sidebar → content fills space

---

## Architecture Note

The layout uses a dual-positioning strategy:
- **App wrapper:** `marginLeft: sidebarW` for normal-flow pages (Dashboard, Settings)
- **TripPlannerPage:** `position: fixed` with CSS `.wndrly-page-root { left: var(--sidebar-w) }` for the map-based full-screen layout

The `--sidebar-w` CSS variable is updated by `Sidebar.tsx` on collapse/expand via `document.documentElement.style.setProperty()`. This is the single source of truth for sidebar width. All fixed-position content that should respect the sidebar must use the `wndrly-page-root` class.
