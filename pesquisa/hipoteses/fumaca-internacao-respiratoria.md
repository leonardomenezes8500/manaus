---
id: 'fumaca-internacao-respiratoria'
titulo: 'Nos 0 a 7 dias depois de um dia de fumaça, sobe a internação respiratória de moradores de Manaus'
fontes: 'datasus-sih, iem-asos, ecmwf-ads'
espera: 'alta de 5% ou mais nas internações respiratórias por dia'
defasagem: '0 a 7 dias'
epoca: 'agosto a novembro, em anomalia sazonal (anomalia)'
comparacao: 'dias sem fumaça na mesma época'
teste: 'diferença da anomalia média de internações por dia entre as janelas depois de dia com FU e os outros dias, 2012 a 2025, com permutação em blocos de 7 dias'
rodada: '5'
status: 'testada'
escrita_em: '2026-10-23'
testada_em: '2026-10-23'
confianca: 'baixa'
resultado: 'internações respiratórias de moradores de Manaus nos 0 a 7 dias depois de um dia com FU, em anomalia sazonal e contra os outros dias do mesmo ano, agosto a novembro, 2012–2025: -2.3% de um dia comum; p = 0.3134, p ajustado (BH da rodada 5) = 0.4345, não passa na correção, na direção contrária à esperada: a hipótese não se confirma'
---
## Por quê
A partícula fina da fumaça inflama as vias aéreas e piora asma, bronquite e pneumonia. O efeito aparece em dias, não no mesmo dia só.

## Como testar
Dia de fumaça: dia de Manaus com pelo menos um FU no METAR de SBEG (série da #55). Internação respiratória: diagnóstico principal J00 a J99, morador de Manaus, pela data da internação (SIH, só meses com 6 meses de processamento depois). Segundo recorte: PM2,5 do CAMS acima de 25 µg/m³ (modelado) no lugar do FU. Exploratório: doenças do aparelho circulatório (I00 a I99).

## Resultado
internações respiratórias de moradores de Manaus nos 0 a 7 dias depois de um dia com FU, em anomalia sazonal e contra os outros dias do mesmo ano, agosto a novembro, 2012–2025: -2.3% de um dia comum; p = 0.3134, p ajustado (BH da rodada 5) = 0.4345, não passa na correção, na direção contrária à esperada: a hipótese não se confirma. Segundo recorte (CAMS PM2,5 > 25 µg/m³ (modelado)): -0.05, p = 0.0037, confirma. Confiança baixa: não passa na correção. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-23. Números em produtos/contexto/rodada-5.csv.
