---
id: gasto-federal-fogo-sem-local
titulo: O gasto federal com o fogo não diz onde foi gasto
tema: fumaca
status: com-evidencia
atualizado_em: 2026-10-28
---
## O que é
Quase todo o dinheiro federal das ações de prevenção e combate ao fogo é registrado como "Nacional" ou por região, e não por estado. Não dá para saber quanto foi gasto no AM nem nos estados de onde vem a fumaça de Manaus, nem cruzar o gasto com o fogo.

## Evidências
- [registro] Liquidado nas ações do fogo (lista em `coleta/transparencia.ts`) com localizador no AM, AC, RO ou PA: R$ 3,5 mil em 2024, zero em 2025 e R$ 100 mil em 2026 até outubro. Com localizador "Nacional": R$ 500 milhões em 2024, R$ 695 milhões em 2025 e R$ 550 milhões em 2026 até outubro (Portal da Transparência, execução mensal de 2014-01 a 2026-10; `bruto/portal-transparencia/`; banco `manaus`, `transparencia.despesa_fogo_mes`, consultado em 2026-10-28; #90).
- [registro] Em 2025, 98% do liquidado do Ministério do Meio Ambiente nessas ações (R$ 634 milhões) e 86% do Ministério da Defesa (R$ 73 milhões) saíram como "Nacional" (mesma fonte).
- [registro] Por isso a hipótese `gasto-federal-fogo-reativo` (o gasto federal sobe no ano seguinte a um ano de fumaça) ficou sem teste na rodada 5: o gasto com localizador no AM, AC ou RO só aparece em 1 dos 12 anos de 2014 a 2025 (#92).

## Quem é afetado
Quem quer cobrar ou avaliar a política do fogo na Amazônia: o Congresso, os órgãos de controle, a imprensa e a população.

## Quem é responsável
Os órgãos que executam as ações (MMA, IBAMA, ICMBio, Ministério da Defesa) e a lei orçamentária, que define o localizador de cada ação. Quem escolhe o localizador, e por qual norma, ainda não foi conferido.

## Soluções ligadas
- `gasto-fogo-com-local` (sem classe, falta conferir, problema principal)
