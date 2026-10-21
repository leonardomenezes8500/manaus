#!/usr/bin/env bash
# Imagem roda sem root, sem .env, com crontab válido, supercronic, gdal e pg_dump. Uso: scripts/ci-testar-imagem.sh <imagem>
set -euo pipefail
imagem=${1:?uso: ci-testar-imagem.sh <imagem>}
test "$(docker run --rm "$imagem" id -u)" != 0
docker run --rm "$imagem" sh -c 'test ! -e .env && supercronic -test coleta/crontab && ogr2ogr --version && pg_dump --version && node --version'
