---
id: fumaca-vem-de-fora-do-am
titulo: A maior parte da fumaça de Manaus vem de fogo fora do Amazonas
tema: fumaca
status: com-evidencia
atualizado_em: 2026-10-28
---
## O que é
Pelo modelo de trajetórias (v1), mais da metade da fumaça que chegou a Manaus em 2026 saiu de focos fora do AM, quase toda do Pará. O que o Estado e a Prefeitura fazem dentro do AM alcança menos da metade do problema.

## Evidências
- [modelado] Na temporada de 01/08 a 28/10 de 2026, 58% do peso somado da v1 (com a diluição da #101) vem de focos fora do AM: PA 51%, MA 4,1%, AP 1,3%, PI 1,0%, TO 0,5%, BA 0,1%. O AM tem 42% (banco `manaus`, `analise.fumaca_foco` × `analise.onde_queimou_foco`, consultado em 2026-10-28).
- [modelado] Antes da diluição, 48% do peso vinha de focos a leste de −52 (Cerrado do MA, PI e TO); com ela, 27% na média dos dias, e ainda acima de 30% em 29 dias, quase todos em agosto (#101, 2026-10-28). Os municípios que mais aparecem no topo do dia são Itacoatiara/AM (23 dias), Urucurituba/AM (15), Uruará/PA (11) e Careiro da Várzea/AM (10).
- [medido] Contagem de focos sem vento: dos focos VIIRS S-NPP de 01/08 a 26/10 de 2026 na região da série (#77), 25% estão no AM, 37% no PA, 14% em MT, 6% no AC, 3% em RO e 14% fora do Brasil (banco `manaus`, `analise.onde_queimou_dia`, consultado em 2026-10-28).
- [medido] A v1 diluída acompanha o PM2,5 medido no Centro: Spearman 0,87 entre o peso do dia e o PM2,5 medido em 88 dias da temporada 2026, contra 0,80 sem a diluição (#99, #101). É um sensor barato e uma temporada só, então a comparação entre versões vale, o valor absoluto não.

## Quem é afetado
A população de Manaus: 2.063.689 pessoas no Censo 2022 (IBGE, SIDRA tabela 4709, consultada em 2026-10-21).

## Quem é responsável
- [registro] Dentro do AM, a regra da #91 (`analise/fogo/responsavel.ts`, lida no texto oficial em 2026-10-23): ver o problema `fumaca-seca-2026`.
- Fora do AM: os órgãos ambientais do PA e dos outros estados, e a União (IBAMA, ICMBio, FUNAI, SFB) nas áreas federais. Ainda não está escrito aqui com a lei de cada um.

## Soluções ligadas
- `cooperacao-interestadual-fogo` (especulativa, problema principal)
- `proibicao-sazonal-fogo` (especulativa)
