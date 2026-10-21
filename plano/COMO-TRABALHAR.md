# Como trabalhar

## Ciclo
1. **Próxima issue:** em `ROADMAP.md`, veja o "Sprint atual" e pegue, no GitHub, a issue aberta de menor número com a label desse sprint (`gh issue list --label S0.1`) cujas dependências (os `#N` no corpo) estejam todas fechadas.
2. **Começar:** label `em andamento` na issue e uma branch a partir da `main` atualizada: `N-assunto-curto` (ex.: `3-bruto-r2`).
3. **Durante:** achados e desvios viram comentário na issue, em 1 a 3 linhas. O repo é público: nada de chave, IP, host, usuário ou caminho da VPS em issue, comentário ou commit. Ideia nova no meio do trabalho: uma linha no `IDEIAS.md` e volte ao que estava fazendo.
4. **Fechar:** marque os itens de "Pronto quando" no corpo da issue (só com todos [x] ela fecha). Commits em português, como no resto do repo (`#N: o que mudou`). Abra o PR com `Closes #N` no corpo, espere o CI e faça o merge você mesmo: `gh pr checks <pr> --watch --fail-fast && gh pr merge <pr> --merge --delete-branch`. PR só de `.md`/`plano/` não tem check: confira `gh pr diff <pr> --name-only` e faça o merge com `--admin`. Nunca merge com CI vermelho.
5. **Fim de sprint:** triagem do `IDEIAS.md`, atualizar o "Sprint atual" e contar ao usuário em 3 linhas o que ficou pronto.

## Onde fica cada coisa
- Código e issues: GitHub `leonardomenezes8500/manaus` (público). Caminho local e detalhes da VPS: `CLAUDE.local.md`.
- Deploy: merge na `main` → Actions roda o CI, publica a imagem no GHCR e faz o deploy por SSH na slice. Nunca build nem `git pull` na slice. Quando `compose.prod.yaml` ou `deploy.sh` mudam, reinstalar à mão antes do merge (ver a issue de CI/CD).
- Dados: Cloudflare R2 (`R2_BUCKET`), com `bruto/`, `normalizado/`, `produtos/`, `estado/` e `backup/`. Daqui, pelo remoto `r2` do rclone. O disco da slice é só buffer/cache.
- Coleta contínua: container `coletor` na slice, cron pelo `coleta/crontab` (supercronic) chamando `coleta/rodar.sh`. Logs no volume `logs` do projeto.
- Trabalho pesado e ocasional: neste PC, sob demanda, lendo e gravando no R2 (e no banco pelo túnel). Nunca nada contínuo aqui.
- Banco: container `db` (PostGIS) na slice, só em 127.0.0.1. Daqui, pelo túnel `ssh -fNL 5433:127.0.0.1:<porta> slice` (porta na issue do Postgres).
- Slice compartilhada: só o projeto compose `manaus`. Todo container com `cpus` e `mem_limit`. Nunca tocar em container, volume, rede ou proxy de outro projeto.
- Chaves: `.env` local (fora do git) e secrets do GitHub. Chave nova ou trocada: pôr no `.env` local e `gh secret set NOME` (valor pelo stdin); o próximo deploy reescreve o `.env` da slice. Nunca imprimir, logar, colar em arquivo, issue ou chat, pôr na imagem ou mandar para o R2.

## Actions (gasto)
O repo é público, então o Actions é grátis. Mesmo assim, CI enxuto sempre:
- nada de `schedule:` (cron) no Actions;
- `paths-ignore` para `**/*.md` e `plano/**`; cache de dependências; `timeout-minutes` curto; `concurrency` com `cancel-in-progress` em PR;
- não repetir no push da `main` o que o PR já rodou (job `gate`).

## Regras
- **Fonte só entra no catálogo depois de uma requisição real que funcionou** (o card registra `verificado_em` e `teste`).
- **Bruto é imutável:** o arquivo baixado nunca é editado nem sobrescrito; cada download novo é um arquivo novo, com data. Tudo tem que poder ser refeito a partir do bruto.
- **Fusão em 3 camadas:** (1) bruto; (2) uma tabela por fonte, sem misturar; (3) `entidade.*` liga os registros de todas as fontes, guarda o que cada uma diz (fonte + data) e escolhe o valor por uma regra de prioridade escrita para cada campo. Uma fonte nunca sobrescreve outra.
- Medido ≠ modelado: todo número diz de onde veio e se foi medido ou modelado.
- Horário no banco em UTC. Nos relatórios, "dia" é o dia de Manaus (UTC−4).
- A menor coisa que funciona por inteiro. Teste Jest em lógica de verdade (parser, cálculo, regra), não em código de ligação.
- Comece a coletar cedo: histórico que não foi salvo está perdido.
