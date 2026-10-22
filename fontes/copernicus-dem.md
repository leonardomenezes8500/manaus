---
id: copernicus-dem
nome: Copernicus DEM GLO-30 (relevo)
publicador: ESA / Copernicus
url: https://registry.opendata.aws/copernicus-dem/
acesso: download
chave: nenhuma
atualizacao: estática (2011 a 2015)
cobertura: global, 30 m, superfície (inclui árvores e prédios)
licenca: licença Copernicus DEM GLO-30 (uso livre, inclusive comercial, com atribuição a DLR, Airbus e Copernicus)
tipo: medicao-satelite
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSI "https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S04_00_W061_00_DEM/Copernicus_DSM_COG_10_S04_00_W061_00_DEM.tif"'
---
- Tema: território. Relevo de Manaus para o 3D e para áreas de alagamento. A diferença para o ANADEM (terreno) dá a altura de árvores e prédios (ideia para o M7).
- Tiles COG de 1° × 1° no S3 público, com o nome do canto sudoeste (`S04_W061` = lat -4 a -3, lon -61 a -60). Os arquivos não declaram nodata.
- Recorte (#28): `node coleta/relevo.ts` lê os 42 tiles da RM de Manaus por janela → `normalizado/copernicus-dem/glo30_rmm.tif` no R2 (22321 × 16561 px, 1,37 GB, nodata -9999).
- Altitude: Teatro Amazonas 46,4 m; Praia da Ponta Negra 12,0 m; Encontro das Águas 11,0 m.
