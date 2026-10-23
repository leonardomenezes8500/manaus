import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { areaDoFoco, montarElos, nomePublico, textoCadeia, type Insumos } from './cadeia.ts';

// A small made-up day with the shapes the queries return: 3 spots (one in a settlement with a DETER clear-cut and
// two embargoes, one east of the layers box, one in a federal UC), hospitalisations not published yet.
const i: Insumos = JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__', 'cadeia-insumos.json'), 'utf8'));

test('the type of area of a spot, by the order of the rule: outside the box, federal UC, TI, state UC, settlement, public forest, rural land', () => {
  expect(i.focos.map(areaDoFoco)).toEqual(['assentamento', 'sem_regra', 'uc_federal']);
  expect(areaDoFoco({ ...i.focos[0], assentamento: null, cnfp: 'B' })).toBe('floresta_publica_nao_destinada');
  expect(areaDoFoco({ ...i.focos[0], assentamento: null })).toBe('imovel_rural');
  expect(areaDoFoco({ ...i.focos[0], municipio: 'Manaus', urbano: true })).toBe('manaus_urbano');
  expect(areaDoFoco({ ...i.focos[0], municipio: 'Manaus' })).toBe('assentamento'); // rural Manaus is not SEMMAS alone
  expect(areaDoFoco({ ...i.focos[0], uf: 'RO' })).toBe('sem_regra'); // the rule names AM agencies
  expect(areaDoFoco({ ...i.focos[0], prodes: null })).toBe('sem_regra'); // not classified yet
});

test('six links, each item with its label and its source; no data says so instead of a number', () => {
  const e = montarElos(i);
  expect(e.map((x) => x.titulo)).toEqual(['Dia', 'Focos', 'Áreas e imóveis', 'Embargos e autos', 'Internações', 'Órgãos e gastos']);
  for (const x of e) for (const it of x.itens) expect(it.rotulo && it.fonte).toBeTruthy();
  const texto = (n: number) => e[n].itens.map((x) => x.texto).join('\n');
  expect(texto(0)).toContain('FioAres: sem dado');
  expect(texto(0)).toContain('modelado');
  expect(texto(2)).toContain('imóvel do CAR: pendente (#83)');
  expect(texto(4)).toContain('ainda não publicado');
  expect(texto(5)).toContain('sem regra');
});

test('personal data: an individual appears only by the term number, a company by name', () => {
  const t = textoCadeia(i, montarElos(i));
  expect(t).not.toContain('FULANO');
  expect(t).toContain('AAA1');
  expect(t).toContain('EMPRESA EXEMPLO LTDA');
  expect(nomePublico('PJ', 'JOAO DA SILVA 12345678900')).toBeNull(); // MEI: the name of a person and the CPF
  expect(nomePublico('PJ', 'JOAO DA SILVA ME')).toBeNull(); // sole trader
  expect(nomePublico('PJ', 'AGROPECUARIA RIO BRANCO S/A')).toBe('AGROPECUARIA RIO BRANCO S/A');
  expect(nomePublico('PF', 'EMPRESA EXEMPLO LTDA')).toBeNull();
  expect(t).toContain('Um dia sozinho não prova nada');
});
