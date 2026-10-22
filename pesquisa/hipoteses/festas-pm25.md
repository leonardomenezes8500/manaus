---
id: 'festas-pm25'
titulo: 'Grandes festas de Manaus deixam o ar da noite pior'
fontes: 'openaq, cmm-manaus, manaus-dom'
espera: 'PM2.5 maior entre 20h e 2h na noite de festa (réveillon, Carnaval, aniversário de Manaus e Boi Manaus); importa se passar de 20%'
defasagem: '0 horas'
epoca: 'mesma hora das noites da semana anterior e da seguinte'
comparacao: 'as noites da semana anterior e da seguinte'
teste: 'razão do PM2.5 noturno (festa ÷ noites vizinhas), permutando as noites'
rodada: '1'
status: 'testada'
escrita_em: '2026-10-22'
testada_em: '2026-10-22'
confianca: 'baixa'
resultado: 'PM2.5 da noite de festa ÷ noites uma semana antes e depois (20 noites desde 07/2025): +10%; p = 0.8550, p ajustado (BH da rodada 1) = 0.9745, não passa na correção'
---
## Por quê
Fogos de artifício, trânsito e churrasco soltam partícula fina. O aniversário de Manaus (24/10) cai no meio da fumaça e tem que ser olhado à parte.

## Como testar
Festas de `contexto.dia` (#60) e o sensor do Centro (OpenAQ).

## Resultado
PM2.5 da noite de festa ÷ noites uma semana antes e depois (20 noites desde 07/2025): +10%; p = 0.8550, p ajustado (BH da rodada 1) = 0.9745, não passa na correção. Confiança baixa: menos de 8 anos de dado. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-22. Números em produtos/contexto/rodada-1.csv.
