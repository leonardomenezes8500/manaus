#!/usr/bin/env bash
# Uso: coleta/rodar.sh <script> [args]   Roda coleta/<script>.ts [args] (ou analise/<...>.ts, se começar com analise/) e anexa a saída, com data, em $MANAUS_LOGS/<script>-AAAA-MM-DD.log.
# Um arquivo por dia para poder apagar os de mais de 30 dias. Código de saída ≠ 0 fica no log e no stdout (docker logs).
set -uo pipefail
nome=${1:-}
shift || true
if ! [[ $nome =~ ^[a-z0-9-]+(/[a-z0-9-]+)*$ ]]; then
  echo "uso: coleta/rodar.sh <script> (roda coleta/<script>.ts)" >&2
  exit 2
fi
cd "$(dirname "$0")/.."
logs=${MANAUS_LOGS:-/dados/logs}
mkdir -p "$logs"
find "$logs" -name '*.log' -mtime +30 -delete
log="$logs/${nome//\//-}-$(date +%F).log"

echo "== $(date -Is) início" >> "$log"
script="coleta/$nome.ts"
[[ $nome == analise/* ]] && script="$nome.ts"
node "$script" "$@" >> "$log" 2>&1
codigo=$?
if ((codigo)); then
  echo "== $(date -Is) $nome ERRO código $codigo" | tee -a "$log" >&2
else
  echo "== $(date -Is) $nome ok" | tee -a "$log"
fi
exit "$codigo"
