import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { buildMap } from '../analise/fumaca/relatorio.ts';
import { row, spots } from './exemplo.ts';

// mapa.html is a static page (Leaflet from unpkg, OpenStreetMap tiles): it is opened from disk, as the user does.
const file = join(mkdtempSync(join(tmpdir(), 'mapa-')), 'mapa.html');
writeFileSync(file, buildMap(row, spots));

test('the daily map shows Manaus, the wind sector, every spot and the v0 note, without page scroll', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(file).href);

  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('21/10/2026');
  const box = page.locator('.nota');
  await expect(box).toBeInViewport({ ratio: 1 });
  await expect(box).toContainText('Manaus, 21 de outubro de 2026');
  await expect(box).toContainText('PM2.5 medido (sensor barato): 35,5');
  await expect(box).toContainText('CAMS (modelo): 28,1');
  await expect(box).toContainText('Heurística v0');
  // 3 spots + the sector polygon are SVG paths in the overlay pane.
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(spots.length + 1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('Manaus and a spot open their details', async ({ page }) => {
  await page.goto(pathToFileURL(file).href);
  await page.getByRole('button', { name: 'Manaus' }).click();
  await expect(page.locator('.leaflet-popup-content')).toContainText('PM2.5 medido');
  await page.locator('.leaflet-overlay-pane path.leaflet-interactive').nth(1).click({ force: true });
  const popup = page.locator('.leaflet-popup-content').last();
  await expect(popup).toContainText('/AM');
  await expect(popup).toContainText(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/); // Manaus time, pt-BR
});
