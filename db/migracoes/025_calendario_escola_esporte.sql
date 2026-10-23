-- Official calendar (2) (#61): school (SEDUC, SEMED: start of the school year, recesses, suspended classes) and sports
-- (FIFA, COB, IPC, CBF, FAF: World Cups, Olympic and Paralympic Games, matches in Manaus). Same table; two new
-- columns at the end of contexto.dia.
ALTER TABLE contexto.periodo DROP CONSTRAINT periodo_tipo,
  ADD CONSTRAINT periodo_tipo CHECK (tipo IN ('feriado', 'ponto_facultativo', 'eleicao', 'festa', 'escola', 'esporte'));

CREATE OR REPLACE VIEW contexto.dia AS
SELECT d::date AS dia,
       extract(isodow FROM d) IN (6, 7) AS fim_de_semana,
       string_agg(p.nome, '; ' ORDER BY p.nome) FILTER (WHERE p.tipo = 'feriado') AS feriado,
       string_agg(p.nome, '; ' ORDER BY p.nome) FILTER (WHERE p.tipo = 'ponto_facultativo') AS ponto_facultativo,
       string_agg(p.nome, '; ' ORDER BY p.nome) FILTER (WHERE p.tipo = 'eleicao') AS eleicao,
       string_agg(p.nome, '; ' ORDER BY p.nome) FILTER (WHERE p.tipo = 'festa') AS festa,
       coalesce(jsonb_agg(jsonb_build_object('tipo', p.tipo, 'nome', p.nome, 'abrangencia', p.abrangencia, 'fonte', p.fonte,
                                             'ato', p.ato, 'url', p.url) ORDER BY p.tipo, p.nome)
                FILTER (WHERE p.tipo IS NOT NULL), '[]') AS eventos,
       string_agg(p.nome, '; ' ORDER BY p.nome) FILTER (WHERE p.tipo = 'escola') AS escola,
       string_agg(p.nome, '; ' ORDER BY p.nome) FILTER (WHERE p.tipo = 'esporte') AS esporte
FROM generate_series('1994-01-01'::date, '2030-12-31'::date, '1 day') d
LEFT JOIN contexto.periodo p ON d::date BETWEEN p.inicio AND p.fim
GROUP BY d;
