import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerPagina, setorDoOrgao } from './pncp.ts';

const pagina = JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__', 'pncp', 'dispensas.json'), 'utf8'));

test('emergency = dispensa under art. 75, VIII (amparo 38), not annulled; the rest of the row as published', () => {
  const l = lerPagina(pagina);
  expect(l.map((x) => [x.numero_controle, x.emergencia])).toEqual([
    ['34570820000130-1-000001/2023', true],
    ['34570820000130-1-000060/2023', false], // annulled
    ['04312658000190-1-000006/2024', true], // an emergency is not always a crisis (a data link)
    ['10792928000100-1-000001/2021', false], // art. 75, II: small value
    ['05562326000126-1-000006/2023', false],
  ]);
  expect(l[0]).toMatchObject({
    publicado_em: '2023-08-07T16:15:23-04:00',
    modalidade: 8,
    amparo: 38,
    esfera: 'E',
    municipio_ibge: 1302603,
    setor: 'saude',
  });
});

test('sector by the body name, without accents: health, environment (with civil defence) or other', () => {
  expect(setorDoOrgao('FUNDACAO CENTRO DE CONTROLE DE ONCOLOGIA')).toBe('saude');
  expect(setorDoOrgao('Secretaria de Estado de Saúde')).toBe('saude');
  expect(setorDoOrgao('SECRETARIA DE ESTADO DO MEIO AMBIENTE')).toBe('ambiente');
  expect(setorDoOrgao('SECRETARIA EXECUTIVA DE PROTECAO E DEFESA CIVIL')).toBe('ambiente');
  expect(setorDoOrgao('SECRETARIA MUNICIPAL DE FINANCAS E TECNOLOGIA DA INFORMACAO - SEMEF')).toBe('outro');
});
