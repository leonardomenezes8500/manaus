---
id: 'sigef-menos-fogo'
titulo: 'Área com parcela certificada no SIGEF queima menos por km² do que área só com CAR'
fontes: 'incra-sigef, sicar, nasa-firms'
espera: 'razão de densidade de focos (só CAR ÷ SIGEF) acima de 1,5'
defasagem: '0 (mesmo ano); a parcela só conta a partir do ano de data_aprov'
epoca: 'um valor por ano (o ano inteiro)'
comparacao: 'CAR que não toca parcela do SIGEF nem do SNCI, no mesmo estado e ano'
teste: 'log da razão de densidade por ano, 2014 a 2025, com permutação de sinais entre os anos'
rodada: '4'
status: 'escrita'
escrita_em: '2026-10-23'
---
## Por quê
A parcela certificada tem dono com título, georreferenciamento conferido e responsável técnico. A área só com CAR é autodeclarada e inclui a posse irregular, onde o fogo abre área.

## Como testar
SIGEF de AM, AC e RO e CAR dos mesmos estados; focos do VIIRS S-NPP. Segundo recorte: SNCI no lugar do SIGEF; MODIS.

## Resultado
Ainda não testada.
