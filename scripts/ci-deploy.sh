#!/usr/bin/env bash
# Job deploy do CI: manda os secrets da aplicação pelo stdin para o deploy.sh da slice (único comando da chave).
# Entrada: SSH_KEY, KNOWN_HOSTS, DESTINO (user@host) e um SEGREDO_<NOME> por secret da aplicação, que vira NOME=valor.
set -euo pipefail
install -m 700 -d ~/.ssh
printf '%s\n' "$SSH_KEY" > ~/.ssh/deploy
chmod 600 ~/.ssh/deploy
printf '%s\n' "$KNOWN_HOSTS" > ~/.ssh/known_hosts
arquivos=$(cat compose.prod.yaml scripts/deploy.sh | sha256sum | cut -d' ' -f1)
for v in $(compgen -e | grep '^SEGREDO_' || true); do
  if [[ -n ${!v} ]]; then printf '%s=%s\n' "${v#SEGREDO_}" "${!v}"; fi # secret não cadastrado chega vazio: fica de fora
done | ssh -i ~/.ssh/deploy "$DESTINO" "$GITHUB_SHA $arquivos"
