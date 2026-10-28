// PurpleAir API (#41, part b): ready for when there is a PURPLEAIR_API_KEY; not in the cron yet (each call spends
// points: the user decides how often). Current reading of the sensors of the Manaus metropolitan region with the A/B
// channels (cf_1, what the EPA correction uses) and humidity, into the raw files. Same answer format as the SELVA map.
//   node coleta/purpleair.ts
// Next, with the first real answer: the card goes to `verificada`, a purpleair.* table and its load (like selva.*),
// the history (/v1/sensors/:id/history) and the line in verificar-chaves.ts.
import { readRaw, baixar } from './lib/baixar.ts';
import { porCampo } from './carga/selva.ts';
import { RMM_BBOX } from './regiao.ts';

export const CAMPOS = ['name', 'latitude', 'longitude', 'last_seen', 'humidity', 'temperature', 'pm2.5_cf_1_a', 'pm2.5_cf_1_b'];

/** /v1/sensors for the outdoor sensors inside `caixa`, with CAMPOS. */
export const urlSensores = (c: { oeste: number; sul: number; leste: number; norte: number }) =>
  `https://api.purpleair.com/v1/sensors?fields=${CAMPOS.join(',')}&location_type=0&max_age=0&nwlng=${c.oeste}&nwlat=${c.norte}&selng=${c.leste}&selat=${c.sul}`;

async function main() {
  const chave = process.env.PURPLEAIR_API_KEY;
  if (!chave) throw new Error('falta PURPLEAIR_API_KEY no ambiente (ver fontes/purpleair.md)');
  const b = await baixar({
    fonte: 'purpleair',
    coletor: 'purpleair',
    nome: 'sensores_rmm.json',
    url: urlSensores(RMM_BBOX),
    headers: { 'X-API-Key': chave },
    parametros: { caixa: RMM_BBOX, campos: CAMPOS },
  });
  const linhas = porCampo(JSON.parse(await readRaw(b.chave)));
  console.log(b.chave, `${linhas.length} sensores`, `${linhas.filter((l) => l['pm2.5_cf_1_b'] != null).length} com canal B`);
}

if (import.meta.main)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
