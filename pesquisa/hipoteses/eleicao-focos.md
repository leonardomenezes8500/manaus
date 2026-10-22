---
id: 'eleicao-focos'
titulo: 'Ano de eleição tem mais foco de fogo em agosto e setembro'
fontes: 'tse-dados-abertos, nasa-firms, ana-telemetria'
espera: 'mais focos em agosto e setembro nos anos pares (eleição), descontada a seca; importa se passar de 20%'
defasagem: '0 meses (agosto e setembro do próprio ano)'
epoca: 'só agosto e setembro; a seca entra pela cota mínima do Rio Negro do ano'
comparacao: 'anos ímpares (sem eleição), 2012–2025'
teste: 'diferença das medianas pares × ímpares no resíduo de focos depois de tirar a cota mínima (em postos), permutando os anos'
rodada: '1'
status: 'testada'
escrita_em: '2026-10-22'
testada_em: '2026-10-22'
confianca: 'baixa'
resultado: 'anos de eleição − anos sem, no resíduo dos focos de agosto e setembro depois de tirar a cota mínima: 1.5 postos em 14; p = 0.7267, p ajustado (BH da rodada 1) = 0.9745, não passa na correção'
---
## Por quê
Em ano de eleição a fiscalização pode afrouxar e há promessas para quem desmata. Todo ano par tem eleição (geral ou municipal), então a comparação é par × ímpar.

## Como testar
Focos de agosto e setembro (`analise.focos_dia`), datas das eleições do TSE (#60) e cota mínima (`ana.cota_dia`). São 14 anos: a confiança fica baixa mesmo se passar.

## Resultado
anos de eleição − anos sem, no resíduo dos focos de agosto e setembro depois de tirar a cota mínima: 1.5 postos em 14; p = 0.7267, p ajustado (BH da rodada 1) = 0.9745, não passa na correção. Confiança baixa: não passa na correção. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-22. Números em produtos/contexto/rodada-1.csv.
