const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

function getCreds() {
  // Prefer env vars. Fall back to macOS Keychain (preferred for unattended cron), then 1Password CLI.
  if (EMAIL && PASSWORD) return;

  // Keychain: service name defaults to horizon-qa
  const svc = process.env.HORIZON_KEYCHAIN_SERVICE || 'horizon-qa';
  try {
    const password = execFileSync('security', ['find-generic-password', '-s', svc, '-w'], { encoding: 'utf8' }).trim();
    // account is optional; we can also store/read separately, but easiest is env var for email.
    if (password) {
      PASSWORD = password;
      if (!EMAIL) EMAIL = process.env.HORIZON_KEYCHAIN_EMAIL || '';
      if (EMAIL) return;
    }
  } catch {}

  // 1Password fallback
  try {
    const email = execFileSync('op', ['item', 'get', 'Horizon (QA Bot)', '--fields', 'label=username'], { encoding: 'utf8' }).trim() ||
                  execFileSync('op', ['item', 'get', 'Horizon (QA Bot)', '--fields', 'label=email'], { encoding: 'utf8' }).trim();
    const password = execFileSync('op', ['item', 'get', 'Horizon (QA Bot)', '--fields', 'label=password'], { encoding: 'utf8' }).trim();
    if (!email || !password) throw new Error('Missing username/password fields');
    EMAIL = email;
    PASSWORD = password;
    return;
  } catch {}

  throw new Error('Missing credentials: set HORIZON_EMAIL/HORIZON_PASSWORD, or store Keychain service "horizon-qa", or ensure `op` can read item "Horizon (QA Bot)"');
}

const APP_URL = process.env.HORIZON_URL || 'https://horizon-vc.vercel.app';
let EMAIL = process.env.HORIZON_EMAIL || '';
let PASSWORD = process.env.HORIZON_PASSWORD || '';

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function main() {
  const runId = ts();
  const outDir = path.join(__dirname, 'runs', runId);
  fs.mkdirSync(outDir, { recursive: true });
  const shotsDir = path.join(outDir, 'screenshots');
  fs.mkdirSync(shotsDir, { recursive: true });

  const results = [];
  const record = (name, ok, details = '') => results.push({ name, ok, details });

  const chromePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  async function snap(label) {
    const file = path.join(shotsDir, `${label}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
  }

  async function step(name, fn) {
    try {
      await fn();
      record(name, true);
    } catch (err) {
      const safeMsg = (err && err.message) ? err.message.slice(0, 800) : String(err).slice(0, 800);
      let shot = '';
      try { shot = await snap(name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 50)); } catch {}
      record(name, false, `${safeMsg}${shot ? `\nScreenshot: ${path.relative(outDir, shot)}` : ''}`);
      throw err;
    }
  }

  try {
    await step('Open app', async () => {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    });

    await step('Login (if needed)', async () => {
      // If already logged in, the app shell shows sidebar with Command/Packages/Network/Scout.
      const shell = page.getByRole('link', { name: 'Command' });
      if (await shell.count()) return;

      getCreds();

      // Try common login form patterns.
      const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
      const passInput = page.locator('input[type="password"], input[name*="password" i]').first();
      await emailInput.waitFor({ timeout: 20000 });
      await emailInput.fill(EMAIL);
      await passInput.fill(PASSWORD);

      const submit = page.getByRole('button', { name: /sign in|log in|login/i }).first();
      if (await submit.count()) {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {}),
          submit.click(),
        ]);
      } else {
        // fallback: press Enter in password
        await passInput.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
      }

      await page.getByRole('link', { name: 'Command' }).waitFor({ timeout: 30000 });
    });

    await step('Navigate: Dashboard', async () => {
      await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('heading', { name: /Command/i }).first().waitFor({ timeout: 30000 });
    });

    await step('Navigate: Packages', async () => {
      await page.goto(`${APP_URL}/packages`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('heading', { name: /Packages/i }).first().waitFor({ timeout: 30000 });
    });

    await step('Navigate: Network', async () => {
      await page.goto(`${APP_URL}/network`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('heading', { name: /Network/i }).first().waitFor({ timeout: 30000 });
    });

    await step('Navigate: Scout', async () => {
      await page.goto(`${APP_URL}/scout`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('heading', { name: /Scout/i }).first().waitFor({ timeout: 30000 });
    });

    let createdPackageUrl = '';

    await step('Create new package', async () => {
      await page.goto(`${APP_URL}/packages/new`, { waitUntil: 'domcontentloaded', timeout: 60000 });

      const name = `Horizon QA Smoke ${new Date().toISOString()}`;
      await page.getByRole('textbox', { name: /Name/i }).fill(name);

      // Stage dropdown defaults to Sourcing; leave as-is, but ensure it exists.
      await page.getByRole('combobox', { name: /Stage/i }).click({ timeout: 20000 });
      // choose Sourcing if listbox shows up
      const opt = page.getByRole('option', { name: /Sourcing/i });
      if (await opt.count()) await opt.first().click();

      await Promise.all([
        page.waitForNavigation({ timeout: 60000 }).catch(() => {}),
        page.getByRole('button', { name: /Create Package/i }).click({ timeout: 20000 }),
      ]);

      // After creation, we should land on /packages/<uuid>
      await page.waitForURL(/\/packages\//, { timeout: 60000 });
      createdPackageUrl = page.url();
    });

    await step('Smoke: package page loads after refresh', async () => {
      if (!createdPackageUrl) throw new Error('No createdPackageUrl');
      await page.goto(createdPackageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      // Look for Package heading or name textbox etc.
      await page.getByRole('link', { name: /Packages/i }).first().waitFor({ timeout: 30000 });
    });

    // TODO: v2 expand into add/attach Talent/Investor/Partner + move stage + comment.

  } catch (err) {
    // fallthrough; results already captured.
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const passed = results.every(r => r.ok);
  const summaryLines = [];
  summaryLines.push(`# Horizon QA Run ${runId}`);
  summaryLines.push('');
  summaryLines.push(`URL: ${APP_URL}`);
  summaryLines.push(`Result: ${passed ? 'PASS' : 'FAIL'}`);
  summaryLines.push('');
  summaryLines.push('## Steps');
  for (const r of results) {
    summaryLines.push(`- ${r.ok ? '[PASS]' : '[FAIL]'} ${r.name}${r.details ? `\n\n  ${r.details.replace(/\n/g, '\n  ')}` : ''}`);
  }
  summaryLines.push('');
  summaryLines.push('## Artifacts');
  summaryLines.push(`- ${path.relative(__dirname, shotsDir)}`);

  const reportPath = path.join(outDir, 'report.md');
  fs.writeFileSync(reportPath, summaryLines.join('\n'), 'utf8');

  // Print report path (safe) + brief summary to stdout.
  console.log(`REPORT_PATH=${reportPath}`);
  console.log(passed ? 'PASS' : 'FAIL');
  process.exit(passed ? 0 : 2);
}

main().catch((e) => {
  console.error('Fatal runner error:', e?.message || e);
  process.exit(3);
});
