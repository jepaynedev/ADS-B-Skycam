import { expect, type Page, test } from '@playwright/test';

/**
 * Debug / regression spec for the camera-not-updating bug.
 *
 * Two root causes confirmed:
 *  1. flyCameraTo called before gmp-map-3d fires 'gmp-load' (element not ready).
 *  2. flyCameraTo called ~60×/sec, queuing/blocking animations.
 *
 * Fix: direct property assignment gated on the 'gmp-load' event.
 * This spec mocks the adsb.lol API so it works without a live flight.
 */

const MOCK_HEX = 'a0eb2b';

const mockAircraft = {
  hex: MOCK_HEX,
  flight: 'UAL123  ',
  lat: 41.9742,
  lon: -87.9073,
  alt_baro: 5000,
  gs: 250,
  track: 90,
  baro_rate: 300,
  seen: 0,
  seen_pos: 0,
};

async function mockAdsbApi(page: Page) {
  await page.route('**/api/0/aircraft**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ac: [mockAircraft], now: Date.now() / 1000, total: 1 }),
    }),
  );
}

async function hasMapsKey(page: Page): Promise<boolean> {
  const src = await page
    .locator('script[src*="maps.googleapis.com"]')
    .getAttribute('src')
    .catch(() => null);
  return !!src && !src.includes('key=undefined') && src.includes('key=');
}

test.describe('Camera update debug', () => {
  test('gmp-map-3d has flyCameraTo defined after Maps script loads', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await mockAdsbApi(page);
    await page.goto(`/?hex=${MOCK_HEX}`);

    if (!(await hasMapsKey(page))) {
      test.skip();
      return;
    }

    await page.waitForSelector('gmp-map-3d', { timeout: 15_000 });

    const hasFlyCameraTo = await page.evaluate(() => {
      const el = document.querySelector('gmp-map-3d');
      return typeof (el as unknown as Record<string, unknown>)?.['flyCameraTo'] === 'function';
    });

    console.log(`flyCameraTo defined at mount: ${hasFlyCameraTo}`);
    console.log(`Console errors: ${consoleErrors.join(', ') || 'none'}`);

    expect(hasFlyCameraTo).toBe(true);
  });

  test('debug overlay shows camera_move events after LIVE status (Maps API optional)', async ({
    page,
  }) => {
    await mockAdsbApi(page);
    await page.goto(`/?hex=${MOCK_HEX}`);

    // Wait for tracking to go LIVE — works even without a real Maps key
    await expect(page.locator('.status-badge')).toContainText('LIVE', { timeout: 10_000 });

    // Expand the collapsible debug overlay
    await page.locator('button[title="Open debug log"]').click();

    // camera_move events render with a ⊕ symbol (dot-blue row).
    // Confirms cameraParams are computed and logged even without a real Maps key.
    await expect(page.locator('.debug-events')).toContainText('⊕', { timeout: 5_000 });
  });

  test('camera center updates when gmp-map-3d fires gmp-load', async ({ page }) => {
    await mockAdsbApi(page);
    await page.goto(`/?hex=${MOCK_HEX}`);

    if (!(await hasMapsKey(page))) {
      test.skip();
      return;
    }

    await page.waitForSelector('gmp-map-3d', { timeout: 15_000 });
    await expect(page.locator('.status-badge')).toContainText('LIVE', { timeout: 10_000 });

    // Wait for gmp-load to fire inside the page
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const el = document.querySelector('gmp-map-3d');
          if (!el) return resolve();
          el.addEventListener('gmp-load', () => resolve(), { once: true });
          // Resolve immediately if already loaded
          setTimeout(resolve, 8_000);
        }),
    );

    await page.waitForTimeout(500);

    // After gmp-load the camera should have moved away from the default US overview
    const center = await page.evaluate(() => {
      const el = document.querySelector('gmp-map-3d');
      // Serialize to detect any change from default (lat≈39.5, lng≈-98.35)
      return JSON.stringify((el as unknown as Record<string, unknown>)?.['center']);
    });

    console.log('Map center after gmp-load + tracking:', center);

    // If center is the default US overview lat ~39.5, camera hasn't moved to the aircraft
    expect(center).not.toContain('"lat":39.5');
  });

  test('no flyCameraTo TypeErrors in console during tracking', async ({ page }) => {
    const typeErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('flycamerato')) {
        typeErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      if (err.message.toLowerCase().includes('flycamerato')) typeErrors.push(err.message);
    });

    await mockAdsbApi(page);
    await page.goto(`/?hex=${MOCK_HEX}`);
    await page.waitForTimeout(5_000);

    expect(typeErrors).toEqual([]);
  });
});
