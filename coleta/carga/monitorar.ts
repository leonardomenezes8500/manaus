// MonitorAr load (#40): backend answer → monitorar.estacao and monitorar.medicao. Each hourly file repeats the last
// 24 h, so an hour already stored is overwritten by the newer file (the index can be revised when validated).
import type pg from 'pg';
import { loadOnce } from './lib.ts';

export type Medicao = {
  estacao: number;
  nome: string;
  lat: number;
  lon: number;
  poluente: number;
  hora_local: string;
  iqar: number;
  classificacao: string | null;
  validado: boolean | null;
};

export function parseMonitorar(texto: string): Medicao[] {
  return (JSON.parse(texto) as any[]).flatMap((e) =>
    (e.poluentes ?? []).flatMap((p: any) =>
      (p.medicoes ?? [])
        .filter((m: any) => typeof m.indiceQualidadeAr === 'number')
        .map((m: any) => ({
          estacao: e.idEstacao,
          nome: e.noEstacao,
          lat: Number(e.nuLatitude),
          lon: Number(e.nuLongitude),
          poluente: p.idPoluente,
          hora_local: m.dtMedicao,
          iqar: m.indiceQualidadeAr,
          classificacao: m.classificacaoIqAr?.noClassificacao ?? null,
          validado: m.stDadoValidado ?? null,
        })),
    ),
  );
}

export function loadMonitorar(db: pg.ClientBase, arquivo: number, linhas: Medicao[]): Promise<number> {
  return loadOnce(db, arquivo, 'monitorar.medicao', async () => {
    for (const e of new Map(linhas.map((l) => [l.estacao, l])).values())
      await db.query(
        `INSERT INTO monitorar.estacao (id, nome, geom) VALUES ($1, $2, ST_SetSRID(ST_Point($3, $4), 4326))
         ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, geom = excluded.geom`,
        [e.estacao, e.nome, e.lon, e.lat],
      );
    for (const l of linhas)
      await db.query(
        `INSERT INTO monitorar.medicao (estacao, poluente, hora_local, iqar, classificacao, validado, arquivo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (estacao, poluente, hora_local) DO UPDATE SET iqar = excluded.iqar, classificacao = excluded.classificacao,
           validado = excluded.validado, arquivo = excluded.arquivo`,
        [l.estacao, l.poluente, l.hora_local, l.iqar, l.classificacao, l.validado, arquivo],
      );
    return linhas.length;
  });
}
