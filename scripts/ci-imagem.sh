#!/usr/bin/env bash
# Job image do CI: build e push da imagem ghcr.io/<repo>:<sha>. Entrada: REGISTRY_TOKEN (o GITHUB_TOKEN do job).
set -euo pipefail
imagem="ghcr.io/$GITHUB_REPOSITORY:$GITHUB_SHA"
printf '%s' "$REGISTRY_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin
docker build --build-arg "GIT_COMMIT=$GITHUB_SHA" -t "$imagem" .
docker push "$imagem"
