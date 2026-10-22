---
id: mma-cnuc
nome: CNUC (Cadastro Nacional de Unidades de Conservação)
publicador: MMA
url: https://dados.mma.gov.br/dataset/unidadesdeconservacao
acesso: download
chave: nenhuma
atualizacao: semestral (o shapefile público mais novo é de 2025-08)
cobertura: Brasil; UCs federais, estaduais e municipais, com esfera e órgão gestor
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSI "https://dados.mma.gov.br/dataset/44b6dc8a-dc82-4a84-8d95-1b0da7c85dac/resource/6ba9a557-87e8-4882-acb7-b3e0f0ea192d/download/shp_cnuc_2025_08.zip"'
---
- Tema: território e quem deveria agir. Shapefile (polígonos e pontos, SIRGAS 2000) no CKAN do MMA. Os shapefiles de 2026 estão só no SharePoint do MMA (pede login Microsoft); o CSV de 2026-07 é público, sem geometria.
- Carga (#30): `node coleta/areas-protegidas.ts` → `cnuc.unidade`: 292 UCs na região de influência (de 3.122 no país). ICMBio e SEMA-AM com camada própria entram depois como fontes separadas.
- Focos INPE da temporada 2026 (01/08 a 20/10 no dia de Manaus, todas as detecções de todos os satélites) na região: 937.287; 77.530 em TI, 119.451 em UC, 195.321 em alguma das duas. Por órgão: FUNAI 77.530, ICMBio 53.831, IDEFLOR-Bio/PA 37.767, SEDAM/RO 14.441, SEMA-AM 7.550, SEMA-MT 5.590.
