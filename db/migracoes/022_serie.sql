-- Smoke series 2012–2026 (#55): one Manaus day (UTC-4) per row, every column MEASURED, each from one source:
--   horas_fu, horas_hz, vis_min_sem_chuva_m, metar_obs: METAR of SBEG (Eduardo Gomes airport). The visibility only
--     counts hours without rain, drizzle, showers, thunderstorm, fog or mist. No METAR that day = null, not zero.
--   focos_800km, frp_800km: FIRMS VIIRS S-NPP spots within 800 km of Manaus (analise.focos_dia, #52). focos_dia only has
--     days with spots: a day with S-NPP spots in the region but none within 800 km is 0; a day with none in the whole
--     region is null (a sensor outage, e.g. late July 2022), never 0.
--   cota_cm: Rio Negro at Manaus, ANA station 14990000 (ana.cota_dia, #29).
--   aod_aeronet, angstrom_440_870, aeronet_site: AERONET daily AOD at 500 nm (#53), Manaus_EMBRAPA, else ATTO.
--   aod_maiac: MAIAC (MCD19A2) AOD at 550 nm over the Centro, mean of Terra and Aqua (#54).
CREATE VIEW analise.serie_dia AS
WITH dias AS (
  SELECT d::date AS dia FROM generate_series('2012-01-01'::date, (now() AT TIME ZONE 'America/Manaus')::date, '1 day') d
), metar AS (
  SELECT (observado_em AT TIME ZONE 'America/Manaus')::date AS dia,
         count(DISTINCT date_trunc('hour', observado_em)) FILTER (WHERE EXISTS (SELECT 1 FROM unnest(tempo) t WHERE t ~ 'FU'))::int AS horas_fu,
         count(DISTINCT date_trunc('hour', observado_em)) FILTER (WHERE EXISTS (SELECT 1 FROM unnest(tempo) t WHERE t ~ 'HZ'))::int AS horas_hz,
         min(visibilidade_m) FILTER (WHERE NOT EXISTS (SELECT 1 FROM unnest(tempo) t WHERE t ~ '(RA|DZ|SH|TS|FG|BR)')) AS vis_min_sem_chuva_m,
         count(*)::int AS metar_obs
  FROM metar.observacao WHERE estacao = 'SBEG' AND observado_em >= '2012-01-01T04:00:00Z' GROUP BY 1
), aeronet AS (
  SELECT DISTINCT ON (dia) dia, aod_500, angstrom_440_870, site FROM aeronet.aod_dia_melhor WHERE aod_500 IS NOT NULL
  ORDER BY dia, CASE site WHEN 'Manaus_EMBRAPA' THEN 0 WHEN 'ATTO-Campina' THEN 1 ELSE 2 END
)
SELECT d.dia, m.horas_fu, m.horas_hz, m.vis_min_sem_chuva_m, m.metar_obs,
       CASE WHEN g.dia IS NOT NULL THEN coalesce(f.focos, 0) END AS focos_800km,
       CASE WHEN g.dia IS NOT NULL THEN coalesce(f.frp, 0) END AS frp_800km,
       c.cota_cm,
       a.aod_500 AS aod_aeronet, a.angstrom_440_870, a.site AS aeronet_site,
       (SELECT avg(x.aod_550) FROM maiac.aod x WHERE x.ponto = 'manaus' AND x.dia = d.dia)::real AS aod_maiac
FROM dias d
LEFT JOIN metar m ON m.dia = d.dia
LEFT JOIN analise.focos_dia f ON f.dia = d.dia AND f.sensor = 'VIIRS_SNPP' AND f.anel = '800km'
LEFT JOIN analise.focos_dia g ON g.dia = d.dia AND g.sensor = 'VIIRS_SNPP' AND g.anel = 'regiao'
LEFT JOIN ana.cota_dia c ON c.dia = d.dia AND c.estacao = 14990000
LEFT JOIN aeronet a ON a.dia = d.dia;
