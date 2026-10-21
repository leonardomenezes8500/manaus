---
id: nasa-earthdata
nome: NASA Earthdata (CMR + download)
publicador: NASA EOSDIS
url: https://www.earthdata.nasa.gov
acesso: api
chave: EARTHDATA_TOKEN
atualizacao: depende do produto (MCD19A2 é diário)
cobertura: global; MODIS desde 2000
licenca: dados abertos da NASA (sem restrição, citar)
tipo: medicao-satelite
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS -H "Authorization: Bearer $EARTHDATA_TOKEN" "https://cmr.earthdata.nasa.gov/search/granules.json?short_name=MCD19A2&page_size=1"'
---
- Com token válido a busca devolve 200; com token falso, 401 "Token does not exist". Também baixei 100 bytes de um arquivo MCD19A2 (tile h12v09, 2026-10-16) com o mesmo token: HDF4 válido.
- O token expira em 2026-12-20 e precisa ser renovado até 2026-12-10 (#7).
