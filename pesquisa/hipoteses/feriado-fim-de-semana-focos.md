---
id: 'feriado-fim-de-semana-focos'
titulo: 'Tem mais foco de fogo no fim de semana e no feriado do que nos dias úteis da mesma semana'
fontes: 'nasa-firms, planalto-legislacao, cmm-manaus'
espera: 'mais focos no sábado, domingo e feriado; importa se passar de 15%'
defasagem: '0 dias'
epoca: 'só agosto a novembro; cada fim de semana comparado com os dias úteis da mesma semana'
comparacao: 'dias úteis da mesma semana'
teste: 'razão de focos (fim de semana e feriado ÷ dia útil) por semana, permutando os rótulos dos dias dentro de cada semana'
rodada: '1'
status: 'escrita'
escrita_em: '2026-10-22'
---
## Por quê
A queimada da roça e do pasto é trabalho. Quem tem outro emprego queima no dia de folga. Os satélites passam todo dia na mesma hora, então o dia da semana não muda o que eles veem.

## Como testar
Focos VIIRS S-NPP a até 800 km de Manaus (`analise.focos_dia`, 2012–2026), dia da semana e feriados de `contexto.dia` (#60). Teste principal: a razão acima. Exploratório: o mesmo só para os focos do AM.

## Resultado
Ainda não testada.
