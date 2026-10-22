---
id: anadem
nome: ANADEM v1, modelo digital de terreno da América do Sul
publicador: ANA e UFRGS (Laipelt et al. 2024)
url: https://metadados.snirh.gov.br/geonetwork/srv/api/records/93664c15-1ff8-4e87-bbed-2bb69d321309
acesso: download
chave: nenhuma
atualizacao: estática (v1, arquivos de 2025-08-20)
cobertura: América do Sul, 30 m, terreno sem vegetação nem prédios
licenca: CC BY 4.0 (citar Laipelt et al. 2024, Remote Sens. 16(13):2321)
tipo: modelo
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSI "https://metadados.snirh.gov.br/files/anadem_v1_tiles/anadem_v1_20M.tif"'
---
- Tema: território. Altitude do chão, para alagamento, igarapés e o terreno do 3D. É modelado: deriva do Copernicus DEM com a vegetação e os prédios tirados.
- Um COG por zona MGRS (6° × 8°, Float32, nodata -9999). Manaus usa `20M` e `21M` (1,7 e 2,0 GB), lidos por janela via `/vsicurl/` (sem baixar inteiros). O mosaico inteiro (`anadem_v1_compressed.tif`, 54 GB, em faixas) não serve para recorte.
- Recorte (#28): `node coleta/relevo.ts` → `normalizado/anadem/anadem_v1_rmm.tif` no R2 (RM de Manaus, 23007 × 17070 px, 1,16 GB).
- Altitude: Teatro Amazonas 44,2 m; Praia da Ponta Negra 12,0 m; Encontro das Águas 11,0 m (o Copernicus dá 46,4, 12,0 e 11,0). Na água os dois são iguais (superfície achatada que o ANADEM herdou do Copernicus); na cidade o ANADEM fica ~2 m abaixo. Datum vertical não declarado no arquivo (provavelmente EGM2008).
