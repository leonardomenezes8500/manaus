-- Where each fire spot fell (#77), MEASURED (satellite) crossed with official layers; the rule is classificar() in
-- analise/fogo/onde-queimou.ts. Dimensions and their categories:
--   ti: sim | nao                           (funai.terra_indigena)
--   uc: protecao_integral | uso_sustentavel | nao   (cnuc.unidade; integral wins where both)
--   protegida: sim | faixa_10km | nao       (inside a TI or UC; within 10 km of one; neither)
--   cnfp: A | B | nao                       (sfb.floresta_publica; B wins where both; a tipo A area created after the
--                                            year of the spot counts as B, it had no destination yet)
--   prodes: floresta | nao_floresta | hidrografia | residuo | desm_depois | desm_ano | desm_1a3 | desm_4mais | desm_ate2007 | sem_dado
--           (inpe-prodes COG, the year of the spot is the PRODES year: August to July)
--   deter: corte_raso | cicatriz | outro | nao   (an alert with image date in the 90 days up to the spot; corte_raso wins)
-- uf = state of the spot (ibge.municipio), 'fora' outside Brazil.

-- The series (#77): spots of the FIRMS SP archive (MODIS since 2000-11, VIIRS S-NPP since 2012) and the NRT after it,
-- the same ones as analise.focos_dia (ring 'regiao'), summed per Manaus day, sensor, state, dimension and category.
CREATE TABLE analise.onde_queimou_dia (
  dia       date NOT NULL,
  sensor    text NOT NULL,
  uf        text NOT NULL,
  dimensao  text NOT NULL,
  categoria text NOT NULL,
  focos     integer NOT NULL,
  frp       real NOT NULL,
  PRIMARY KEY (dia, sensor, uf, dimensao, categoria)
);

-- The denominator of the densities: area (km²) of each category per state and year (the static layers repeat every year).
-- protegida/faixa_10km: the 10 km band around TIs and UCs, outside any TI or UC. cnfp changes with the year (ano_criacao).
-- uf = '800km': the ring around Manaus, only for the prodes dimension (the second cut of deter-antes-da-fumaca).
CREATE TABLE analise.area_categoria_ano (
  ano       smallint NOT NULL,
  uf        text NOT NULL,
  dimensao  text NOT NULL,
  categoria text NOT NULL,
  km2       double precision NOT NULL,
  PRIMARY KEY (ano, uf, dimensao, categoria)
);

-- The spots of each day's v1 attribution, one row per spot (the 08h and 17h report fills it, the S4.3 chain reads it).
CREATE TABLE analise.onde_queimou_foco (
  foco   bigint PRIMARY KEY REFERENCES firms.foco ON DELETE CASCADE,
  uf     text NOT NULL,
  ti     text NOT NULL,
  uc     text NOT NULL,
  protegida text NOT NULL,
  cnfp   text NOT NULL,
  prodes text NOT NULL,
  deter  text NOT NULL,
  classificado_em timestamptz NOT NULL DEFAULT now()
);
