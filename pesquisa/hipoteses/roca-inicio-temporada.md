---
id: 'roca-inicio-temporada'
titulo: 'A temporada de fogo começa mais cedo quando a seca começa mais cedo'
fontes: 'nasa-firms, inpe-queimadas, ana-telemetria'
espera: 'o dia em que os focos passam do normal anda junto com o dia em que o rio começa a baixar; importa se a correlação passar de 0,5'
defasagem: '0 a 30 dias'
epoca: 'uma data por ano'
comparacao: 'os outros anos'
teste: 'Spearman entre o dia de início dos focos e o dia de início da vazante, por ano, com permutação dos anos'
rodada: '1'
status: 'testada'
escrita_em: '2026-10-22'
testada_em: '2026-10-22'
confianca: 'baixa'
resultado: 'Spearman entre o dia em que o rio começa a baixar (dia seguinte à cota máxima) e o início da temporada de focos: -0.09 (15 anos); p = 0.7409, p ajustado (BH da rodada 1) = 0.9745, não passa na correção'
---
## Por quê
O preparo da roça e do pasto espera a terra secar. A janela de preparo sai de uma regra escrita (é derivada, não é dado oficial), porque não há calendário oficial de roça do AM com data.

## Como testar
Focos por dia (`analise.focos_dia`) e cota (`ana.cota_dia`), 2012–2026. Início dos focos = primeiro dia com média de 7 dias acima do percentil 75 do ano.

## Resultado
Spearman entre o dia em que o rio começa a baixar (dia seguinte à cota máxima) e o início da temporada de focos: -0.09 (15 anos); p = 0.7409, p ajustado (BH da rodada 1) = 0.9745, não passa na correção. Confiança baixa: não passa na correção. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-22. Números em produtos/contexto/rodada-1.csv.
