---
id: nasa-firms
nome: NASA FIRMS (focos de calor)
publicador: NASA LANCE / FIRMS
url: https://firms.modaps.eosdis.nasa.gov/api/
acesso: api
chave: FIRMS_MAP_KEY
atualizacao: quase tempo real (~3 h após a passagem do satélite)
cobertura: global; NRT dos últimos meses pela API, arquivo desde 2000 (MODIS) e 2012 (VIIRS)
licenca: dados abertos da NASA (sem restrição, citar)
tipo: medicao-satelite
confiabilidade: alta
status: coletando
verificado_em: 2026-10-21
teste: 'curl -sS "https://firms.modaps.eosdis.nasa.gov/api/area/csv/$FIRMS_MAP_KEY/VIIRS_SNPP_NRT/-74,-15,-52,3/2"'
coleta: 3h
---
- O teste devolveu CSV com 1 foco VIIRS perto de Manaus em 2026-10-21.
- Limite: 5000 transações a cada 10 min (`/mapserver/mapkey_status/?MAP_KEY=`). A API de área aceita de 1 a **5** dias por chamada (`Invalid day range. Expects [1..5]`); com data: `/<dias>/<AAAA-MM-DD>` = da data em diante.
- Foco = pixel quente, não área queimada. NRT é provisório; o arquivo SP (padrão) substitui depois.
- Coleta (#9): `coleta/firms.ts` a cada 3 h, 4 sensores (`VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_NRT`), caixa da região, últimos 2 dias. Histórico: `--historico 2026-08-01` (janelas de 5 dias). O NRT da API começa em 2026-07-01 (VIIRS) e 2026-08-01 (MODIS) (`/api/data_availability/csv/<chave>/ALL`).
- Zero focos = CSV só com o cabeçalho, sem quebra de linha. Erro vem com HTTP 200 e texto: o coletor confere o cabeçalho.
- Buraco da fonte: `VIIRS_SNPP_NRT` em 2026-08-03 não tem foco na região (no mundo inteiro só ~2 mil, contra dezenas de milhares num dia normal). Os outros 3 sensores cobrem o dia.
