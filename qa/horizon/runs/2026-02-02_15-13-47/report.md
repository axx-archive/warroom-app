# Horizon QA Run 2026-02-02_15-13-47

URL: https://horizon-vc.vercel.app
Result: FAIL

## Steps
- [PASS] Open app
- [FAIL] Login (if needed)

  locator.waitFor: Timeout 30000ms exceeded.
  Call log:
    - waiting for getByRole('link', { name: 'Command' }) to be visible
  
  Screenshot: screenshots/Login_if_needed_.png

## Artifacts
- runs/2026-02-02_15-13-47/screenshots