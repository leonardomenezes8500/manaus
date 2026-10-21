import { buildGeojson, buildMap, buildReport, buildSeason, compass, sector, type DayRow } from './relatorio.ts';

const row: DayRow = {
  dia: '2026-10-21', pm25_medido_media: 35.5, pm25_medido_max: 60.2, pm25_medido_horas: 24, pm25_cams_media: 28.1, pm25_cams_max: 41,
  horas_fu_hz: 6, visibilidade_min_m: 4000,
  vento: { de_graus: 100, velocidade_kmh: 22, constancia: 0.9, horas_com_dado: 24 },
  focos_contados: 321,
  ranking: { municipios: [{ nome: 'Autazes', uf: 'AM', parcela: 0.41, focos: 30 }, { nome: 'Careiro', uf: 'AM', parcela: 0.2, focos: 12 }, { nome: 'fora do Brasil', uf: null, parcela: 0.1, focos: 3 }, { nome: 'Manaquiri', uf: 'AM', parcela: 0.05, focos: 2 }] },
  confianca: 'alta', sinais: { steadyWind: true, spotsInSector: true, measuredAndModelAgree: true },
};

test('compass in Portuguese', () => {
  expect([0, 44, 46, 90, 135, 180, 225, 270, 315, 359, -10].map(compass)).toEqual(['norte', 'nordeste', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste', 'norte', 'norte']);
});

test('report: at most 15 lines, says measured vs model, top 3 and that it is v0', () => {
  const r = buildReport(row, false);
  expect(r.split('\n').length).toBeLessThanOrEqual(15);
  expect(r).toContain('35,5 µg/m³');
  expect(r).toContain('2,4× a diretriz diária da OMS');
  expect(r).toContain('não é medição');
  expect(r).toContain('1. Autazes/AM: 41% (30 focos)');
  expect(r).toContain('3. fora do Brasil: 10%');
  expect(r).not.toContain('Manaquiri');
  expect(r).toContain('Heurística v0');
  expect(buildReport(row, true)).toContain('(parcial, até as 17h)');
  const empty = buildReport({ ...row, pm25_medido_media: null, ranking: { municipios: [] } }, false);
  expect(empty).toContain('nenhum foco no setor');
  expect(empty).not.toContain('OMS');
});

test('geojson is lon/lat and the sector starts and ends in Manaus', () => {
  const g = buildGeojson([{ lat: -4, lon: -59, peso: 1, frp: 2, em: 'x', municipio: 'A/AM', distancia_km: 120 }]);
  expect(g.features[0].geometry.coordinates).toEqual([-59, -4]);
  const s = sector(90);
  expect(s[0]).toEqual(s.at(-1));
  expect(Math.max(...s.map((p) => p[1]))).toBeGreaterThan(-60); // wind from the east: sector to the east
});

test('the map embeds the data without breaking out of the script tag', () => {
  const html = buildMap(row, [{ lat: -4, lon: -59, peso: 1, frp: 2, em: 'x', municipio: '</script><b>', distancia_km: 1 }]);
  expect(html).toContain('leaflet@1.9.4');
  expect(html).not.toContain('</script><b>');
});

test('season table has one line per day', () => {
  const s = buildSeason([row, { ...row, dia: '2026-10-22' }]);
  expect(s).toContain('| 2026-10-21 | 35,5 | 28,1 | 6 | Autazes/AM 41%, Careiro/AM 20%, fora do Brasil 10% |');
  expect(s.split('\n').filter((l) => l.startsWith('| 2026'))).toHaveLength(2);
});
