-- City context layer (#60): the official calendar. One row per event (holiday, ponto facultativo, election round,
-- festival), each with the act and the official document (in the raw files). OFFICIAL RECORD, never estimated: a year
-- without a document has no row. #61 and #62 add types and columns to the view.
CREATE SCHEMA IF NOT EXISTS contexto; -- #63 (024) may come first
CREATE TABLE contexto.periodo (
  tipo        text NOT NULL CONSTRAINT periodo_tipo CHECK (tipo IN ('feriado', 'ponto_facultativo', 'eleicao', 'festa')),
  nome        text NOT NULL,
  inicio      date NOT NULL,
  fim         date NOT NULL CHECK (fim >= inicio),
  abrangencia text NOT NULL CHECK (abrangencia IN ('BR', 'AM', 'Manaus')),
  fonte       text NOT NULL,               -- catalog id (fontes/)
  ato         text NOT NULL,               -- e.g. 'Lei 662/1949, art. 1º'
  url         text NOT NULL,               -- official document
  arquivo     bigint REFERENCES bruto.arquivo, -- the document in the raw files
  PRIMARY KEY (tipo, nome, inicio, abrangencia)
);

-- One Manaus day per row, 1994-2030, a column per type (names joined) and every event with its act and source.
CREATE VIEW contexto.dia AS
SELECT d::date AS dia,
       extract(isodow FROM d) IN (6, 7) AS fim_de_semana,
       string_agg(p.nome, '; ' ORDER BY p.nome) FILTER (WHERE p.tipo = 'feriado') AS feriado,
       string_agg(p.nome, '; ' ORDER BY p.nome) FILTER (WHERE p.tipo = 'ponto_facultativo') AS ponto_facultativo,
       string_agg(p.nome, '; ' ORDER BY p.nome) FILTER (WHERE p.tipo = 'eleicao') AS eleicao,
       string_agg(p.nome, '; ' ORDER BY p.nome) FILTER (WHERE p.tipo = 'festa') AS festa,
       coalesce(jsonb_agg(jsonb_build_object('tipo', p.tipo, 'nome', p.nome, 'abrangencia', p.abrangencia, 'fonte', p.fonte,
                                             'ato', p.ato, 'url', p.url) ORDER BY p.tipo, p.nome)
                FILTER (WHERE p.tipo IS NOT NULL), '[]') AS eventos
FROM generate_series('1994-01-01'::date, '2030-12-31'::date, '1 day') d
LEFT JOIN contexto.periodo p ON d::date BETWEEN p.inicio AND p.fim
GROUP BY d;
