# Horizon QA Run 2026-02-04_02-00-07

URL: https://horizon-vc.vercel.app
Result: FAIL

## Steps
- [PASS] Open app
- [PASS] Login (if needed)
- [PASS] Navigate: Dashboard
- [PASS] Navigate: Packages
- [PASS] Navigate: Network
- [PASS] Navigate: Scout
- [FAIL] Create new package

  locator.click: Timeout 20000ms exceeded.
  Call log:
    - waiting for getByRole('button', { name: /Create Package/i })
  
  Screenshot: screenshots/Create_new_package.png

## Artifacts
- runs/2026-02-04_02-00-07/screenshots