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
status: 'escrita'
escrita_em: '2026-10-22'
---
## Por quê
O preparo da roça e do pasto espera a terra secar. A janela de preparo sai de uma regra escrita (é derivada, não é dado oficial), porque não há calendário oficial de roça do AM com data.

## Como testar
Focos por dia (`analise.focos_dia`) e cota (`ana.cota_dia`), 2012–2026. Início dos focos = primeiro dia com média de 7 dias acima do percentil 75 do ano.

## Resultado
Ainda não testada.
