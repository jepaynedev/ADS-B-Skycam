import { expect, test } from '@playwright/test';

// Detect whether a Maps API key is configured in the dev server environment.
// Playwright spins up the dev server via `npm run dev`, which loads .env.local,
// so the key will be baked into the JS bundle at runtime. We check the JS source
// to avoid duplicating the secret in playwright config.
async function hasMapsKey(page: Parameters<Parameters<typeof test>[1]>[0]): Promise<boolean> {
  const src = await page.locator('script[src*="maps.googleapis.com"]').getAttribute('src');
  return !!src && !src.includes('key=undefined') && src.includes('key=');
}

test.describe('ADS-B Skycam', () => {
  // beforeEach only needs to navigate; each test that needs error collection
  // sets up its own listener so parallel tests don't share mutable state.
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // Only pageerror fires for actual unhandled JS exceptions (not console.error).
  // CORS noise from Maps API appears as console.error, not pageerror, so we
  // don't need to filter it here — it simply won't appear.
  test('no unhandled JavaScript exceptions on load', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    // Brief wait to let any synchronous startup errors surface
    await page.waitForTimeout(500);

    expect(pageErrors).toEqual([]);
  });

  test('renders the flight selector with ICAO24 input', async ({ page }) => {
    await expect(page.getByPlaceholder(/icao24/i)).toBeVisible();
  });

  test('renders Track and Search nearby buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /track/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /search nearby/i })).toBeVisible();
  });

  test('renders camera mode controls', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Cockpit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Free Look' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chase' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tower' })).toBeVisible();
  });

  test('Cockpit is the active camera mode by default', async ({ page }) => {
    const cockpit = page.getByRole('button', { name: 'Cockpit' });
    await expect(cockpit).toHaveClass(/active/);
  });

  test('Free Look sliders are hidden in Cockpit mode', async ({ page }) => {
    await expect(page.locator('#heading-slider')).not.toBeVisible();
    await expect(page.locator('#tilt-slider')).not.toBeVisible();
  });

  test('switching to Free Look reveals heading and tilt sliders', async ({ page }) => {
    await page.getByRole('button', { name: 'Free Look' }).click();
    await expect(page.locator('#heading-slider')).toBeVisible();
    await expect(page.locator('#tilt-slider')).toBeVisible();
  });

  test('shows validation error for invalid ICAO24 input', async ({ page }) => {
    await page.getByPlaceholder(/icao24/i).fill('ZZZZZZ');
    await page.getByRole('button', { name: /track/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/hex/i);
  });

  test('accepts a valid 6-char hex ICAO24 without validation error', async ({ page }) => {
    await page.getByPlaceholder(/icao24/i).fill('a1b2c3');
    await expect(page.getByRole('alert')).not.toBeVisible();
  });

  test('HUD overlay is present in DOM', async ({ page }) => {
    await expect(page.locator('.hud-overlay')).toBeVisible();
  });

  test('HUD shows dashes when no aircraft is tracked', async ({ page }) => {
    const hud = page.locator('.hud-overlay');
    await expect(hud).toContainText('---');
  });

  test('3D map element or loading fallback is present', async ({ page }) => {
    const mapLoading = page.locator('.map-loading');
    const map3d = page.locator('gmp-map-3d');
    const hasLoadingState = await mapLoading.isVisible().catch(() => false);
    const hasMap = await map3d.count().then((n) => n > 0).catch(() => false);
    expect(hasLoadingState || hasMap).toBe(true);
  });

  test('3D map loads when Google Maps API key is configured', async ({ page }) => {
    const keyPresent = await hasMapsKey(page);
    if (!keyPresent) {
      test.skip();
      return;
    }
    // Wait up to 10s for the Maps script to initialise and render gmp-map-3d
    await expect(page.locator('gmp-map-3d')).toBeAttached({ timeout: 10_000 });
  });
});
