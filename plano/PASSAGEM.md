# Passagem (fora do git) — 2026-10-28, ~20h UTC

**PR #103 (branch `m4-sensores-ar`) com CI verde**; o diretor mergeia. Dois commits: #41 (SELVA a cada 10 min + gancho da API PurpleAir + hipótese `v1-sensores-selva`) e plano (IDEIAS + `plano/pedidos-lai.md`).
- #40 já estava pronta (24 arquivos por dia desde 23/10); comentado e marcado na issue.
- O SELVA não dá canais A/B: só pela API, com chave.
- Depois do merge: conferir 24 h de `bruto/selva-uea/` (144 arquivos por dia) e `selva.leitura` na produção, e fechar a #41 se o usuário não quiser esperar a chave.
- O `manaus_teste` tem leituras reais do SELVA de 18h56Z (somem no próximo teste).

# Passagem (fora do git) — 2026-10-28, ~19h UTC

**PR #102 da #101 (branch `m4-v1-diluida`) com CI verde**; o diretor mergeia. Um commit.
- A v1 agora dilui o peso pela largura do corredor (`diluicao: 1`); a de antes fica como `PARAMS_V1_SEM_DILUICAO`.
- Temporada refeita na produção (88 dias): ρ com PM2,5 medido 0,80 → 0,87; leste de −52 (média dos dias) 48% → 27%; topo mudou em 48 dias.
- Foto antes/depois em /tmp/claude-1000/-home-logger-code-manaus/b82558d2-e318-497c-9231-42d50d00d924/scratchpad/{antes,depois}.csv e {antes,depois}-peso.csv.
- Se o PR não for mergeado, o cron grava dias novos sem diluição: refazer a temporada.
- A foto com consulta paralela estourou a memória compartilhada do Postgres da slice: usar `SET max_parallel_workers_per_gather = 0` (foto2.sql).

# Passagem (fora do git) — 2026-10-27, ~19h UTC

**PR #100 da #99 (branch `m4-peso-distancia`) com CI verde**; o diretor mergeia. Um commit.
- Diluição do peso pela largura do corredor acerta mais o PM2,5 medido (ρ 0,80 → 0,87, IC da diferença 0,02 a 0,15); leste de −52 cai de 38% para 18%. Corredor mais estreito não muda nada.
- Só comparação: banco e relatório seguem com a v1. Em aberto (usuário): trocar a v1 pela versão com diluição e refazer a temporada.
- Arquivos no R2: `produtos/fumaca/comparacao-peso-distancia.md` e `.csv`. Pendência de R2 (10,7 GB) resolvida: o usuário paga o excedente.
- Suíte em partes: passar caminho absoluto ao `jparte.sh` (ele faz `cd`; caminho relativo roda a suíte inteira).

# Passagem (fora do git) — 2026-10-27, ~16h UTC

**PR #98 (branch `m4-rodadas-producao`) com CI verde**, mergeável; o diretor mergeia. 3 commits: rodadas 3 e 5, guarda no `rodada.ts` (sai com erro sem hipótese `escrita`) e a linha do IDEIAS do modelo v1.
- #94: só faltam `backup/pg` a partir de 05/11 (não passar de 14 dumps) e os itens da #57 (~30/10). O 17/10 e o 18/10 já estão em ERA5.
- ERA5 `_l44` completo (29/07 a 21/10) e temporada refeita na produção. Diferença na #56: 48% do peso da v1 vem de focos a leste de −52; achado do modelo no IDEIAS (caixa de entrada).
- R2 em 10,7 GB (acima dos 10 grátis): decisão do usuário. Foto antes/depois da temporada em /tmp/claude-1000/-home-logger-code-manaus/059ecd82-60cb-4f49-a91d-1cc0c6037dcb/scratchpad/{antes,depois}.csv.
- ROADMAP: nada mais sem depender de tempo ou do usuário (CAR #83, PurpleAir #41, início do M5, rodada 4 parcial sem CAR).

# Passagem (fora do git) — 2026-10-24, ~00h30 UTC

**PR #97 da #94 aberto** (branch `m4-conferencia`, CI verde): correção do `saude.ts` e o ROADMAP com o que espera o CAR. O diretor mergeia.
Cargas do M4 na produção feitas (lista no comentário da #94), menos o `onde-queimou --serie`: parou por falta de memória no PC
(outro projeto rodando Playwright junto), não gravou nada. Rodar de novo só com ok/PC livre, e depois `rodada.ts --rodada 3` e `--rodada 5` com `PGDATABASE=manaus`.

# Passagem (fora do git) — 2026-10-23, ~20h45 UTC

**PR #96 do M4 aberto** (branch `m4-onde-queimou`, 21 commits sobre a `main`). Parar aqui: o diretor mergeia com o CI verde.
Banco de trabalho: `manaus_dev_novo` (migrações até 041; municípios dos 12 estados carregados).

## Fechado nesta sessão
- #90, #91, #92 (refeita depois da revisão: comparação dentro do ano; óbitos +0,8%, p 0,79), #93 (sem Closes: CAR e rota na slice), #56 (validado em 17–21/10 com GFS `_l44`), #57 (fechada).
- `/ponytail-review` em 4 partes; correções nos commits de cada issue (fixup) e no da #56. Lista no corpo do PR.
- ROADMAP: "M4 em revisão". IDEIAS: linha do CDS triada; linha nova do `saude.ts`.

## Rodando em segundo plano neste PC
- ERA5 da caixa nova: `node coleta/era5.ts --history 2026-07-29` (semana a semana; log em
  `/tmp/claude-1000/-home-logger-code-manaus/ae048723-d4de-4e20-819f-a2b55cfed3c6/scratchpad/era5.log`, pid no `era5.pid` da mesma pasta).
  A fila do CDS estava com mais de 1 h por pedido. Se cair, rodar de novo (pula o que já tem `_l44`).

## Depois do merge (#94, lista completa no corpo da issue)
- Migrações pelo deploy; cargas na produção pelo túnel, na ordem da #94 (começa por `ibge-municipios`, agora 12 estados).
- Com o ERA5 `_l44` completo: `relatorio.ts --temporada 2026-08-01` na produção e a diferença no topo na #56.
- Apagar do dev, quando não servir mais: `analise.tmp_topo_antes_56` e `analise.tmp_traj_antes_56`.

## Pendências do usuário
- CAR (#83): bloqueia #83–#86 e o elo do imóvel na #93.
- PurpleAir (#41). #42 só depois de ~05/11.

## Regras desta sessão (continuam valendo)
- Job pesado: `systemd-run --user --scope -p MemoryMax=2500M -p MemorySwapMax=0`; duckdb 1500MB, 2 threads.
- Suíte em partes: `/tmp/manaus-passagem/jparte.sh <lista>` (partes de ~12 arquivos; a de 19 passou do tempo). Commit com `--no-verify`.
