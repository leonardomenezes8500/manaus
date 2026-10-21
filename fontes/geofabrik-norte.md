---
id: geofabrik-norte
nome: OpenStreetMap, extrato Região Norte
publicador: Geofabrik (dados OpenStreetMap)
url: https://download.geofabrik.de/south-america/brazil/norte.html
acesso: download
chave: nenhuma
atualizacao: diária
cobertura: Região Norte do Brasil; só o estado atual do mapa
licenca: ODbL 1.0 (exige atribuição e compartilhamento pela mesma licença)
tipo: colaborativo
confiabilidade: media
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSIL "https://download.geofabrik.de/south-america/brazil/norte-latest.osm.pbf"'
---
- `norte-latest.osm.pbf` redireciona para o arquivo datado (`norte-261020.osm.pbf`, 161 MB em 2026-10-21): bom para o bruto imutável.
- Estado da réplica em `norte-updates/state.txt`. O histórico de edições fica no próprio OSM, por isso a coleta é semanal.
- Confiabilidade média: colaborativo, cobertura desigual entre bairros.
