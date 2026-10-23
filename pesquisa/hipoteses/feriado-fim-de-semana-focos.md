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
status: 'testada'
escrita_em: '2026-10-22'
testada_em: '2026-10-22'
confianca: 'baixa'
resultado: 'focos no fim de semana e feriado ÷ dias úteis da mesma semana (mediana das semanas, agosto a novembro, 15 anos): +0%; p = 0.9745, p ajustado (BH da rodada 1) = 0.9745, não passa na correção'
---
## Por quê
A queimada da roça e do pasto é trabalho. Quem tem outro emprego queima no dia de folga. Os satélites passam todo dia na mesma hora, então o dia da semana não muda o que eles veem.

## Como testar
Focos VIIRS S-NPP a até 800 km de Manaus (`analise.focos_dia`, 2012–2026), dia da semana e feriados de `contexto.dia` (#60). Teste principal: a razão acima. Exploratório: o mesmo só para os focos do AM.

## Resultado
focos no fim de semana e feriado ÷ dias úteis da mesma semana (mediana das semanas, agosto a novembro, 15 anos): +0%; p = 0.9745, p ajustado (BH da rodada 1) = 0.9745, não passa na correção. Confiança baixa: não passa na correção. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-22. Números em produtos/contexto/rodada-1.csv.
