// A realistic day for the map and its e2e test (numbers shaped like 2026-10-21, not a real result).
import type { DayRow, SpotOut } from '../analise/fumaca/relatorio.ts';

export const row: DayRow = {
  dia: '2026-10-21', pm25_medido_media: 35.5, pm25_medido_max: 39.7, pm25_medido_horas: 17,
  pm25_cams_media: 28.1, pm25_cams_max: 41, horas_fu_hz: 6, visibilidade_min_m: 4000,
  vento: { de_graus: 80, velocidade_kmh: 22, constancia: 0.9, horas_com_dado: 24 },
  focos_contados: 3,
  ranking: { municipios: [{ nome: 'Autazes', uf: 'AM', parcela: 0.6, focos: 2 }, { nome: 'Itacoatiara', uf: 'AM', parcela: 0.4, focos: 1 }] },
  confianca: 'media', sinais: { steadyWind: true, spotsInSector: false, measuredAndModelAgree: true },
};

export const spots: SpotOut[] = [
  { lat: -3.58, lon: -59.13, peso: 4.2, frp: 12.5, em: '2026-10-20T17:32:00Z', municipio: 'Autazes/AM', distancia_km: 112 },
  { lat: -3.61, lon: -59.2, peso: 1.1, frp: 3.4, em: '2026-10-20T17:32:00Z', municipio: 'Autazes/AM', distancia_km: 107 },
  { lat: -3.14, lon: -58.44, peso: 2.3, frp: 8, em: '2026-10-21T05:16:00Z', municipio: 'Itacoatiara/AM', distancia_km: 176 },
];
