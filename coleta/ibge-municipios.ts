// Base mínima (#8): baixa as malhas municipais dos estados da região (+ Manaus em resolução máxima) e os nomes,
// grava no bruto pelo baixar() e carrega em ibge.municipio. Recoleta anual (malha nova do IBGE): rodar à mão.
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { baixar } from './lib/baixar.ts';
import { carregarMunicipios, type Malha } from './carga/municipios.ts';
import { registrar, marcarCarregado } from './carga/lib.ts';
import { MANAUS, UFS } from './regiao.ts';

const MALHAS = 'https://servicodados.ibge.gov.br/api/v4/malhas';
const GEOJSON = 'formato=application/vnd.geo%2Bjson';
const coletor = 'ibge-municipios';
const json = async (caminho: string) => JSON.parse(await readFile(caminho, 'utf8'));

const db = new pg.Client();
await db.connect();
try {
  const malhas: Malha[] = [];
  const nomes = new Map<number, string>();
  const arquivos: number[] = [];
  for (const uf of UFS) {
    const malha = await baixar({
      fonte: 'ibge-malhas', coletor, nome: `municipios-${uf}.geojson`, parametros: { uf, qualidade: 'intermediaria' },
      url: `${MALHAS}/estados/${uf}?intrarregiao=municipio&qualidade=intermediaria&${GEOJSON}`,
    });
    const lista = await baixar({
      fonte: 'ibge-localidades', coletor, nome: `municipios-${uf}.json`, parametros: { uf },
      url: `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
    });
    for (const m of await json(lista.caminho)) nomes.set(m.id, m.nome);
    const id = await registrar(db, malha);
    arquivos.push(id, await registrar(db, lista));
    malhas.push({ arquivo: id, uf, geojson: await json(malha.caminho) });
  }
  const manaus = await baixar({
    fonte: 'ibge-malhas', coletor, nome: 'manaus-maxima.geojson', parametros: { municipio: MANAUS.codigo, qualidade: 'maxima' },
    url: `${MALHAS}/municipios/${MANAUS.codigo}?qualidade=maxima&${GEOJSON}`,
  });
  const idManaus = await registrar(db, manaus);
  arquivos.push(idManaus);
  malhas.push({ arquivo: idManaus, uf: 'AM', geojson: await json(manaus.caminho) });

  console.log('municípios carregados:', await carregarMunicipios(db, malhas, nomes));
  for (const a of arquivos) await marcarCarregado(db, a, 'ibge.municipio');
} finally {
  await db.end();
}
