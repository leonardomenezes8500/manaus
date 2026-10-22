#!/usr/bin/env bash
# Imagem roda sem root, sem .env, com crontab válido, supercronic, gdal (lendo GRIB) e pg_dump, e a API carrega. Uso: scripts/ci-testar-imagem.sh <imagem>
set -euo pipefail
imagem=${1:?uso: ci-testar-imagem.sh <imagem>}
test "$(docker run --rm "$imagem" id -u)" != 0
docker run --rm "$imagem" sh -c 'test ! -e .env && supercronic -test coleta/crontab && ogr2ogr --version && gdallocationinfo --version && gdal_translate -q -of ENVI analise/trajetoria/__fixtures__/gfs_2026102100_f000.grib /tmp/g.bin && pg_dump --version && node --version'
# The API module loads with the production dependencies only (no database needed to import it).
docker run --rm "$imagem" node --input-type=module -e "await import('/app/api/app.ts')"
