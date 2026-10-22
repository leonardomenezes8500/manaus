---
id: nasa-maiac
nome: NASA MAIAC (MCD19A2, aerossol do MODIS a 1 km)
publicador: NASA LP DAAC
url: https://lpdaac.usgs.gov/products/mcd19a2v061/
acesso: download
chave: EARTHDATA_TOKEN
atualizacao: diária, uns 4 dias depois da passagem
cobertura: global, desde 2000; o tile h12v09 cobre Manaus e o ATTO
licenca: dados abertos da NASA (sem restrição, citar)
tipo: medicao-satelite
confiabilidade: media
status: verificada
verificado_em: 2026-10-22
teste: 'curl -sS "https://cmr.earthdata.nasa.gov/search/granules.json?short_name=MCD19A2&version=061&temporal=2024-09-10T00:00:00Z,2024-09-10T23:59:59Z&bounding_box=-60.1,-3.2,-60,-3&page_size=2"'
---
- Tema: fumaça. AOD a 550 nm medida por satélite (Terra ~10h30 e Aqua ~13h30, hora local): é um algoritmo sobre a imagem, então tem erro. Serve para a série e para conferir a atribuição; não entra no relatório do dia.
- Caminho usado no #54 (sem a senha do Earthdata, que o AppEEARS exige): o token baixa o HDF4 do tile (~8 MB por dia), `analise/maiac/extrair.py` (Python com `pyhdf`, porque nem o GDAL deste PC nem o JS abrem HDF4) tira o quadrado de 3 × 3 pixels em volta de Manaus e do ATTO, e o CSV extraído vai para o bruto (`nasa-maiac`). O HDF não é guardado. A média do dia só usa pixel de melhor qualidade (`AOD_QA`: céu limpo, sem nuvem ao lado, qualidade 0000).
- `node coleta/maiac.ts --comparacao 2026-08-01`: os dias com FU/HZ no SBEG desde 01/08 e o mesmo número de dias limpos. Em 2026-10-22: 37 dias com arquivo (2026-10-20 não estava no CMR), 17 sem nenhum pixel bom. Nos dias com valor, AOD média em Manaus de 0,33 nos dias com FU e 0,14 nos limpos.
- Limite: a fumaça densa costuma ser marcada como nuvem, então o MAIAC some justo nos piores dias (2026-09-23 veio sem pixel bom). Isso puxa a média dos dias de fumaça para baixo.
- O MODIS está no fim da vida. O substituto é o MAIAC do VIIRS (`VCD19A2CMG`).
- MAIAC × AERONET no ATTO, nos 16 dias em comum: correlação 0,71; o MAIAC (550 nm) fica 0,10 abaixo do AERONET (500 nm), média 0,12 × 0,23. Uns 13% da diferença vêm do comprimento de onda; o resto é subestimativa do MAIAC.
