// Teste da #4: o cron da slice grava no R2 pelo helper. Sai do crontab depois de 1 h funcionando.
import { baixar } from './lib/baixar.ts';

const r = await baixar({
  fonte: '_teste',
  url: 'https://servicodados.ibge.gov.br/api/v4/malhas/municipios/1302603?formato=application/vnd.geo+json',
  nome: 'manaus.geojson',
  coletor: 'teste-r2',
});
console.log(r.chave, r.bytes, r.sha256);
