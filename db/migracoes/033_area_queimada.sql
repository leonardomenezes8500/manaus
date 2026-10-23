-- Burned area per month (#76), MEASURED (satellite), computed on this PC by analise/fogo/area-queimada.ts.
-- produto: mapbiomas-fogo (Landsat 30 m, collection 5, cobertura floresta / nao_floresta by the land cover class of
-- what burned) or inpe-aq1km (MODIS 1 km, collection 2, cobertura total only). recorte: '800km' (ring around Manaus),
-- 'regiao' (the smoke region box) or a state (AM, AC, RO, PA, RR, MT; only the part inside the box).
CREATE TABLE analise.area_queimada_mes (
  ano       smallint NOT NULL,
  mes       smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  produto   text NOT NULL CHECK (produto IN ('mapbiomas-fogo', 'inpe-aq1km')),
  recorte   text NOT NULL,
  cobertura text NOT NULL CHECK (cobertura IN ('floresta', 'nao_floresta', 'total')),
  hectares  double precision NOT NULL,
  PRIMARY KEY (ano, mes, produto, recorte, cobertura)
);
