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
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://firms.modaps.eosdis.nasa.gov/api/area/csv/$FIRMS_MAP_KEY/VIIRS_SNPP_NRT/-61,-4,-59,-2/1"'
---
- O teste devolveu CSV com 1 foco VIIRS perto de Manaus em 2026-10-21.
- Limite: 5000 transações a cada 10 min (`/mapserver/mapkey_status/?MAP_KEY=`). A API de área aceita de 1 a 10 dias por chamada.
- Foco = pixel quente, não área queimada. NRT é provisório; o arquivo SP (padrão) substitui depois.
