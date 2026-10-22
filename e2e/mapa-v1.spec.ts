import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { buildMap } from '../analise/fumaca/relatorio.ts';
import { rowV1, spots, trajetorias } from './exemplo.ts';

const file = join(mkdtempSync(join(tmpdir(), 'mapa-v1-')), 'mapa.html');
writeFileSync(file, buildMap(rowV1, spots, trajetorias));

test('v1 map: the trajectories as lines, every spot and the v1 note, without page scroll', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(file).href);

  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByRole('region')).toHaveAttribute('aria-label', /trajetórias do ar/);
  const box = page.locator('.nota');
  await expect(box).toBeInViewport({ ratio: 1 });
  await expect(box).toContainText('Atribuição v1');
  await expect(box).toContainText('Linhas azuis');
  // 3 trajectory lines + 3 spots, no wind sector.
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(trajetorias.length + spots.length);
  await expect(page.locator('.leaflet-overlay-pane path[stroke="#1e3a8a"]')).toHaveCount(1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
