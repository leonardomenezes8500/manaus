import { iemUrl, smokeOrHaze } from './metar.ts';

test.each([
  ['SBEG 151200Z 09005KT 4000 FU BKN020 31/22 Q1010', true],
  ['SBEG 151200Z 09005KT 5000 HZ SCT025 32/21 Q1010', true],
  ['SBEG 151200Z 09005KT 3000 -RA HZ BKN010 25/24 Q1010', true],
  ['SBEG 010000Z 04002KT CAVOK 26/25 Q1008', false],
  ['SBEG 010100Z 17002KT 9999 FEW010 26/25 Q1010 RMK FU NO HORIZONTE', false],
  ['SBEG 010100Z 17002KT 9999 FEW010 26/25 Q1010', false],
  ['SBEG 010100Z VRB02KT 9999 FUNNEL 26/25', false],
])('%s → %s', (metar, expected) => {
  expect(smokeOrHaze(metar)).toBe(expected);
});

test('IEM URL asks one full UTC year of METAR text', () => {
  const u = new URL(iemUrl('SBEG', 2024));
  expect(u.searchParams.get('station')).toBe('SBEG');
  expect([u.searchParams.get('year1'), u.searchParams.get('year2')]).toEqual(['2024', '2025']);
  expect(u.searchParams.getAll('report_type')).toEqual(['3', '4']);
});
