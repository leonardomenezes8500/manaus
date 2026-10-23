---
id: 'gasto-federal-fogo-reativo'
titulo: 'O gasto federal do fogo no AM, no AC e em RO acompanha os focos do ano, como reação'
fontes: 'portal-transparencia, nasa-firms'
espera: 'Spearman de 0,5 ou mais entre os focos do ano e o valor liquidado de agosto a dezembro'
defasagem: '0 (mesmo ano)'
epoca: 'um valor por ano: liquidado de agosto a dezembro'
comparacao: 'os outros anos'
teste: 'Spearman entre os focos do ano (VIIRS S-NPP, AM + AC + RO) e o valor liquidado de agosto a dezembro das ações 214M, 214N, 214P, 218X e 20X7 com localizador nesses estados, corrigido pelo IPCA (#65), 2014 a 2025, permutando os anos'
rodada: '5'
status: 'escrita'
escrita_em: '2026-10-23'
---
## Por quê
Se o gasto é reação, ele sobe no ano em que o fogo já está alto e chega depois da temporada começar. Prevenção apareceria antes, de janeiro a julho, e não acompanharia os focos.

## Como testar
Execução da despesa do Portal da Transparência por mês, ação e UF do localizador: 214M (Prevfogo, IBAMA), 214N (fiscalização, IBAMA), 214P (fiscalização e incêndios, ICMBio), 218X (GLO) e 20X7 (emprego conjunto das Forças Armadas). Segundo recorte: só o Prevfogo (214M). Exploratório: o valor de janeiro a julho.

## Resultado
Ainda não testada.
