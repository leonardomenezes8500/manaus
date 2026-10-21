#!/usr/bin/env bash
# Roda na slice, na pasta do projeto, como único comando da chave de deploy (#4). Linha no authorized_keys:
#   command="<pasta>/deploy.sh",restrict ssh-ed25519 <chave pública só de deploy> manaus-deploy
# O job deploy do CI chama:  printf 'NOME=valor\n'... | ssh <user>@<host> "<sha do commit> <sha256 de compose.prod.yaml + deploy.sh>"
# Reescreve o .env (600) com os secrets do stdin + APP_TAG, faz pull, sobe o banco, migra e sobe o resto; se algo falhar,
# volta a tag anterior.
#
# A chave só roda o deploy.sh instalado, então o job não atualiza este arquivo nem o compose (se pudesse, valeria tanto
# quanto root). Quando um dos dois muda, reinstalar à mão antes do merge, com a versão exata do commit:
#   scp compose.prod.yaml <user>@<host>:<pasta>/ && scp scripts/deploy.sh <user>@<host>:<pasta>/
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"
trap '' HUP # termina (ou volta a tag) mesmo se o job derrubar a conexão

read -r tag arquivos _ <<< "${SSH_ORIGINAL_COMMAND:-}"
if ! [[ ${tag:-} =~ ^[0-9a-f]{40}$ && ${arquivos:-} =~ ^[0-9a-f]{64}$ ]]; then
  echo "uso: <sha do commit, 40 hex> <sha256 de compose.prod.yaml + deploy.sh>" >&2
  exit 2
fi
if [[ $(cat compose.prod.yaml deploy.sh | sha256sum | cut -d' ' -f1) != "$arquivos" ]]; then
  echo "compose.prod.yaml/deploy.sh instalados diferem do repo: reinstalar à mão (ver o topo do deploy.sh)" >&2
  exit 3
fi

novo=$(mktemp .env.XXXXXX) # mktemp cria com 600
trap 'rm -f "$novo"' EXIT
while IFS= read -r linha || [[ -n $linha ]]; do
  nome=${linha%%=*}
  valor=${linha#*=}
  # Aspas simples: o compose não interpola $ dentro delas. Nunca imprimir a linha (é segredo).
  if ! [[ $linha == *=* && $nome =~ ^[A-Z0-9_]+$ && $nome != APP_TAG && $valor != *"'"* && ! $valor =~ [[:cntrl:]] ]]; then
    echo "stdin inválido: cada linha tem que ser NOME=valor (NOME em [A-Z0-9_], valor numa linha só, sem aspas simples)" >&2
    exit 2
  fi
  printf "%s='%s'\n" "$nome" "$valor" >> "$novo"
done
echo "APP_TAG=$tag" >> "$novo"

anterior=$(sed -n 's/^APP_TAG=//p' .env 2>/dev/null || true)
mv "$novo" .env

compose() { docker compose -f compose.prod.yaml "$@"; }
log() { echo "$(date -Is) $tag $*" >> deploys.log; }

# Migrações com a imagem nova antes de trocar o coletor; se falharem, a versão antiga continua (migração só acrescenta).
if compose pull -q && compose up -d --wait --wait-timeout 120 db && compose run --rm -T coletor node db/migrar.ts \
  && compose up -d --wait --wait-timeout 120; then
  log ok
  exit 0
fi

echo "versão nova não ficou saudável: voltando para ${anterior:-nada}" >&2
log rollback "${anterior:-nada}"
if [[ -n $anterior ]]; then
  sed -i "s/^APP_TAG=.*/APP_TAG=$anterior/" .env
  compose up -d --wait --wait-timeout 120 || true
fi
exit 1
