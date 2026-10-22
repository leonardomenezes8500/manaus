// Fusion (#32): municipalities and bairros into entidade.* and the divergence report to
// produtos/territorio/divergencias-bairros.md on R2. Runs after the weekly OSM load (coleta/crontab) or by hand:
//   node analise/fusao/fundir.ts
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { enviar } from '../../coleta/lib/baixar.ts';
import { divergencias, fundirBairros, fundirMunicipios } from './territorio.ts';

const db = new pg.Client();
await db.connect();
try {
  console.log('municípios:', await fundirMunicipios(db));
  console.log('bairros:', await fundirBairros(db));
  const arquivo = join(tmpdir(), `divergencias-bairros-${process.pid}.md`);
  await writeFile(arquivo, await divergencias(db));
  await enviar(arquivo, 'produtos/territorio/divergencias-bairros.md', { sobrescrever: true });
} finally {
  await db.end();
}
