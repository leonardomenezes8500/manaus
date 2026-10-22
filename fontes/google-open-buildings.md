---
id: google-open-buildings
nome: Google Open Buildings v3
publicador: Google Research
url: https://sites.research.google/gr/open-buildings/
acesso: download
chave: nenhuma
atualizacao: irregular (versões; a v3 é de 2023)
cobertura: África, Ásia e América Latina; Manaus inteira cabe no tile S2 927
licenca: CC BY 4.0 ou ODbL (à escolha)
tipo: modelo
confiabilidade: media
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSI "https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/927_buildings.csv.gz"'
---
- Tema: território. Contorno de prédio detectado por IA em imagem de satélite, com nota de confiança (0,65 a 1). É modelado, não medido.
- Carga (#26): `node coleta/edificacoes.ts` → tile 927 inteiro no bruto (155 MB) e `openbuildings.edificacao`, só o que cai na caixa de Manaus (1.058.053; alguns `plus_code` se repetem). Lista dos tiles: `https://openbuildings-public-dot-gweb-research.uw.r.appspot.com/public/tiles.geojson`.
- No município: 952.039 prédios, 669.689 com confiança ≥ 0,75. Tem ~35% mais polígonos que a Overture; a diferença é quase toda de baixa confiança (casas pequenas e coladas, às vezes unidas num polígono só). 4 contornos vêm como multipolígono.
