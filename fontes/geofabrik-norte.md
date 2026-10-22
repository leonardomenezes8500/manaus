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
status: coletando
verificado_em: 2026-10-21
teste: 'curl -sSIL "https://download.geofabrik.de/south-america/brazil/norte-latest.osm.pbf"'
coleta: 7d
---
- `norte-latest.osm.pbf` redireciona para o arquivo datado (`norte-261020.osm.pbf`, 161 MB em 2026-10-21): bom para o bruto imutável.
- Estado da réplica em `norte-updates/state.txt`. O histórico de edições fica no próprio OSM, por isso a coleta é semanal.
- Confiabilidade média: colaborativo, cobertura desigual entre bairros.
- Coleta e carga (#23): `coleta/osm-norte.ts`, domingo às 03h na slice. Baixa o arquivo datado e o `.md5`, confere o hash e troca `osm.ponto`, `osm.linha` e `osm.poligono` pelo recorte de Manaus (município + ~5 km). Os snapshots antigos ficam no bruto.
- Snapshot 2026-10-20, dentro do município: 33.473 vias `highway` (7.289 km) e 46.841 edificações `building` (pouco: as do Google e da Overture vêm na #26). Limite de Manaus `admin_level=8` (`r332493`, 11.291 km²; o IBGE dá 11.401 km²) e 57 bairros em `admin_level=10`.
