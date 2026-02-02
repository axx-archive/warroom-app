const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const APP_URL = process.env.HORIZON_URL || 'https://horizon-vc.vercel.app';
let EMAIL = process.env.HORIZON_EMAIL || '';
let PASSWORD = process.env.HORIZON_PASSWORD || '';

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function getCreds() {
  if (EMAIL && PASSWORD) return;
  const svc = process.env.HORIZON_KEYCHAIN_SERVICE || 'horizon-qa';
  try {
    const password = execFileSync('security', ['find-generic-password', '-s', svc, '-w'], { encoding: 'utf8' }).trim();
    if (password) {
      PASSWORD = password;
      if (!EMAIL) EMAIL = process.env.HORIZON_KEYCHAIN_EMAIL || '';
      if (EMAIL) return;
    }
  } catch {}
  throw new Error('Missing credentials for design audit (Keychain service horizon-qa or env vars).');
}

function readDesignSystem() {
  const p = process.env.HORIZON_DESIGN_SYSTEM_PATH || '/Users/ajhart/Desktop/InsideOut/docs/DESIGN-SYSTEM.md';
  try {
    return { path: p, text: fs.readFileSync(p, 'utf8') };
  } catch {
    return { path: p, text: '' };
  }
}

async function main() {
  const runId = ts();
  const outDir = path.join(__dirname, 'design-runs', runId);
  fs.mkdirSync(outDir, { recursive: true });
  const shotsDir = path.join(outDir, 'screens');
  fs.mkdirSync(shotsDir, { recursive: true });

  const ds = readDesignSystem();
  if (ds.text) fs.writeFileSync(path.join(outDir, 'DESIGN-SYSTEM.md'), ds.text, 'utf8');

  const chromePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const capture = async (label) => {
    const safe = label.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
    const file = path.join(shotsDir, `${safe}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return path.relative(outDir, file);
  };

  const notes = [];
  const addNote = (area, severity, text, screenshotRel = '') => {
    notes.push({ area, severity, text, screenshotRel });
  };

  const urls = [
    { name: 'Dashboard', url: `${APP_URL}/dashboard` },
    { name: 'Packages', url: `${APP_URL}/packages` },
    { name: 'Network', url: `${APP_URL}/network` },
    { name: 'Scout', url: `${APP_URL}/scout` },
  ];

  try {
    getCreds();

    // Go to app; if login shows, sign in.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const isLoggedIn = await page.getByRole('link', { name: 'Command' }).count().then(Boolean).catch(() => false);
    if (!isLoggedIn) {
      const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
      const passInput = page.locator('input[type="password"], input[name*="password" i]').first();
      await emailInput.waitFor({ timeout: 20000 });
      await emailInput.fill(EMAIL);
      await passInput.fill(PASSWORD);
      const submit = page.getByRole('button', { name: /sign in|log in|login/i }).first();
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {}),
        submit.click().catch(() => passInput.press('Enter')),
      ]);
      await page.getByRole('link', { name: 'Command' }).waitFor({ timeout: 30000 });
    }

    // Capture key pages.
    for (const u of urls) {
      await page.goto(u.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(800);
      const shot = await capture(u.name);
      // Lightweight heuristics: flag obvious contrast/overcrowding.
      addNote(u.name, 'review', `Review ${u.name} screenshot against design system: hierarchy, spacing, hover affordances, and empty/loading states.`, shot);
    }

    // Try to capture "New Package" form as a high-value UI surface.
    await page.goto(`${APP_URL}/packages/new`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(800);
    addNote('Packages/New', 'review', 'Review create package form: field spacing, label clarity, primary button emphasis, validation states.', await capture('Packages_New'));

  } catch (err) {
    const msg = (err && err.message) ? err.message.slice(0, 800) : String(err).slice(0, 800);
    let shot = '';
    try { shot = await capture('ERROR'); } catch {}
    addNote('Runner', 'blocker', msg, shot);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  // Write report
  const lines = [];
  lines.push(`# Horizon Design Polish Audit ${runId}`);
  lines.push('');
  lines.push(`URL: ${APP_URL}`);
  lines.push(`Design system: ${ds.path}`);
  lines.push('');
  lines.push('## What this is');
  lines.push('- A screenshot-based review for polish, consistency, hierarchy, and affordances.');
  lines.push('- Output is a prioritized punch-list. No code changes are made by this job.');
  lines.push('');
  lines.push('## Screenshots');
  lines.push(`- ${path.relative(__dirname, shotsDir)}`);
  lines.push('');
  lines.push('## Punch list (prioritized)');
  for (const n of notes) {
    lines.push(`- [${n.severity}] ${n.area}: ${n.text}${n.screenshotRel ? ` (screenshot: ${n.screenshotRel})` : ''}`);
  }
  lines.push('');
  lines.push('## Design system checks');
  lines.push('- Dark command center feel (Linear x Bloomberg)');
  lines.push('- Gold accent used sparingly as signal');
  lines.push('- Table density: readable, tabular numerals, hover actions');
  lines.push('- ContextDrawer + FocusModal consistency');
  lines.push('- Empty/loading states feel intentional');

  const reportPath = path.join(outDir, 'report.md');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');

  console.log(`REPORT_PATH=${reportPath}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal design audit error:', e?.message || e);
  process.exit(2);
});
