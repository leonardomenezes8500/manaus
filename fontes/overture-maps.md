---
id: overture-maps
nome: Overture Maps (edificações)
publicador: Overture Maps Foundation
url: https://docs.overturemaps.org/
acesso: download
chave: nenhuma
atualizacao: mensal (um release por mês)
cobertura: global; prédios, lugares, transporte, divisas
licenca: ODbL 1.0 no tema buildings (os outros temas variam)
tipo: colaborativo
confiabilidade: media
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?list-type=2&prefix=release/&delimiter=/"'
---
- Tema: território. Junta OSM, Microsoft e Google em GeoParquet no S3 público; o DuckDB lê só a caixa de Manaus (~6 min neste PC).
- Carga (#26): `node coleta/edificacoes.ts` → recorte inteiro no bruto (`guardar()`, release no meta) e `overture.edificacao`. Cada release troca a tabela.
- Release 2026-10-21.0: 775.674 prédios na caixa, 693.219 no município. Origem: Google Open Buildings 657.363, Microsoft 69.218, OSM 49.093.
- Onde há OSM, usa o desenho do OSM; onde não há, repete o Google (só os de confiança mais alta).
