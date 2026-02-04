# Horizon QA Run 2026-02-03_07-57-59

URL: https://horizon-vc.vercel.app
Result: FAIL

## Steps
- [PASS] Open app
- [PASS] Login (if needed)
- [PASS] Navigate: Dashboard
- [PASS] Navigate: Packages
- [PASS] Navigate: Network
- [FAIL] Navigate: Scout

  locator.waitFor: Timeout 30000ms exceeded.
  Call log:
    - waiting for getByRole('heading', { name: /Scout/i }).first() to be visible
  
  Screenshot: screenshots/Navigate_Scout.png

## Artifacts
- runs/2026-02-03_07-57-59/screenshots