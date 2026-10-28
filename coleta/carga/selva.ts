// SELVA load (#41): the map answer (PurpleAir /v1/sensors format: `fields` + `data` rows) → selva.sensor and
// selva.leitura. Every file repeats the last reading of each sensor, so a reading is stored once by (sensor, last_seen).
import type pg from 'pg';
import { naCaixa } from '../regiao.ts';
import { loadOnce } from './lib.ts';

export type Leitura = {
  sensor: number;
  nome: string;
  lat: number;
  lon: number;
  visto_em: string;
  pm25: number | null;
  temperatura_f: number | null;
};

type Resposta = { fields: string[]; data: unknown[][] };

/** Rows as objects keyed by field name (the same format comes from the PurpleAir API). */
export const porCampo = (j: Resposta) => j.data.map((r) => Object.fromEntries(j.fields.map((f, i) => [f, r[i]])) as Record<string, any>);

export function parseSelva(texto: string): Leitura[] {
  return porCampo(JSON.parse(texto)).map((r) => ({
    sensor: r.sensor_index,
    nome: r.name,
    lat: r.latitude,
    lon: r.longitude,
    visto_em: new Date(r.last_seen * 1000).toISOString(),
    pm25: r['pm2.5'] ?? null,
    temperatura_f: r.temperature ?? null,
  }));
}

/** The answer with only the sensors inside `caixa` (what goes to the raw files: the whole world is ~7× bigger). */
export function cortar(texto: string, caixa: Parameters<typeof naCaixa>[0]): string {
  const j = JSON.parse(texto);
  const [lat, lon] = ['latitude', 'longitude'].map((f) => j.fields.indexOf(f));
  return JSON.stringify({ ...j, data: j.data.filter((r: any[]) => naCaixa(caixa, r[lat], r[lon])) });
}

/** Inserts the new readings; returns how many were new. */
export function loadSelva(db: pg.ClientBase, arquivo: number, linhas: Leitura[]): Promise<number> {
  return loadOnce(db, arquivo, 'selva.leitura', async () => {
    let n = 0;
    for (const l of linhas) {
      await db.query(
        `INSERT INTO selva.sensor (id, nome, geom) VALUES ($1, $2, ST_SetSRID(ST_Point($3, $4), 4326))
         ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, geom = excluded.geom
         WHERE (selva.sensor.nome, ST_AsBinary(selva.sensor.geom)) IS DISTINCT FROM (excluded.nome, ST_AsBinary(excluded.geom))`,
        [l.sensor, l.nome, l.lon, l.lat],
      );
      const r = await db.query(
        `INSERT INTO selva.leitura (sensor, visto_em, pm25, temperatura_f, arquivo) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [l.sensor, l.visto_em, l.pm25, l.temperatura_f, arquivo],
      );
      n += r.rowCount ?? 0;
    }
    return n;
  });
}
