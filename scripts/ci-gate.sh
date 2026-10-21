#!/usr/bin/env bash
# Job gate do CI: no push da main, diz se esta árvore já passou no PR (artefato tested-<árvore>, 14 dias).
# Entrada: GH_TOKEN, ARVORE (tree id do commit). Saída: testado=true|false no $GITHUB_OUTPUT.
set -euo pipefail
n=$(gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=tested-$ARVORE" --jq '[.artifacts[] | select(.expired | not)] | length' || echo 0)
echo "testado=$([[ $n -gt 0 ]] && echo true || echo false)" | tee -a "$GITHUB_OUTPUT"
