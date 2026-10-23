---
id: 'idade-internacao-fumaca'
titulo: 'Nos dias de fumaça a internação respiratória sobe mais em criança pequena e idoso'
fontes: 'ibge-agregados-setor, ibge-sidra, datasus-sih'
espera: 'taxa por 100 mil sobe mais em menores de 5 e em 60 anos ou mais; importa se a diferença passar de 20%'
defasagem: '0 a 7 dias'
epoca: 'anomalia sazonal da taxa'
comparacao: 'dias sem fumaça na mesma época'
teste: 'razão das taxas (fumaça ÷ sem fumaça) por faixa de idade, permutação em blocos de 7 dias'
rodada: '5'
status: 'testada'
escrita_em: '2026-10-22'
testada_em: '2026-10-23'
confianca: 'baixa'
resultado: 'alta das internações respiratórias de menores de 5 e de 60 anos ou mais nos 0 a 7 dias depois de um dia com FU ÷ a mesma alta de 5 a 59 anos, cada faixa contra a média do próprio ano, agosto a novembro, 2012–2025: 1.01×; p = 0.3259, p ajustado (BH da rodada 5) = 0.4345, não passa na correção'
---
## Por quê
Pulmão de criança pequena e de idoso aguenta menos partícula fina. A taxa precisa da população por idade (#63) no denominador.

## Como testar
Definições fixadas em 2026-10-23 (#87), antes de olhar o SIH: "dia de fumaça" é o dia de Manaus com pelo menos um FU no METAR de SBEG, como na série (#55); internação respiratória é a de diagnóstico principal de J00 a J99, de morador de Manaus (`MUNIC_RES` 130260), pela data da internação. O teste e o efeito esperado não mudam.

População por idade e sexo (#63) e internações do SIH (M4). Exploratório: homem × mulher em cada faixa.

## Resultado
alta das internações respiratórias de menores de 5 e de 60 anos ou mais nos 0 a 7 dias depois de um dia com FU ÷ a mesma alta de 5 a 59 anos, cada faixa contra a média do próprio ano, agosto a novembro, 2012–2025: 1.01×; p = 0.3259, p ajustado (BH da rodada 5) = 0.4345, não passa na correção. Segundo recorte (CAMS PM2,5 > 25 µg/m³ (modelado)): 0.97, p = 0.8830, não confirma. Confiança baixa: não passa na correção. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-23. Números em produtos/contexto/rodada-5.csv.
