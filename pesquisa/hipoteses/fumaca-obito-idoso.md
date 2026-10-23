---
id: 'fumaca-obito-idoso'
titulo: 'Nos 0 a 7 dias depois de um dia de fumaça, morrem mais idosos de Manaus por doença respiratória ou do coração'
fontes: 'datasus-sim, iem-asos, ecmwf-ads'
espera: 'alta de 5% ou mais nos óbitos por dia de moradores de 60 anos ou mais, causa básica J ou I'
defasagem: '0 a 7 dias'
epoca: 'agosto a novembro, em anomalia sazonal (anomalia)'
comparacao: 'dias sem fumaça na mesma época'
teste: 'diferença da anomalia média de óbitos por dia entre as janelas depois de dia com FU e os outros dias, 2012 a 2024, com permutação em blocos de 7 dias'
rodada: '5'
status: 'testada'
escrita_em: '2026-10-23'
testada_em: '2026-10-23'
confianca: 'baixa'
resultado: 'óbitos de moradores de Manaus com 60 anos ou mais por causa respiratória ou circulatória nos 0 a 7 dias depois de um dia com FU, em anomalia sazonal e contra os outros dias do mesmo ano, agosto a novembro, 2012–2024: 0.8% de um dia comum; p = 0.7920, p ajustado (BH da rodada 5) = 0.7920, não passa na correção'
---
## Por quê
Em idoso, a fumaça agrava doença do pulmão e do coração que já existe, e parte disso acaba em morte nos dias seguintes.

## Como testar
SIM, óbitos de moradores de Manaus com 60 anos ou mais e causa básica nos capítulos J ou I. O SIM de 2025 é preliminar e fica exploratório. Segundo recorte: PM2,5 do CAMS acima de 25 µg/m³ (modelado) no lugar do FU.

## Resultado
óbitos de moradores de Manaus com 60 anos ou mais por causa respiratória ou circulatória nos 0 a 7 dias depois de um dia com FU, em anomalia sazonal e contra os outros dias do mesmo ano, agosto a novembro, 2012–2024: 0.8% de um dia comum; p = 0.7920, p ajustado (BH da rodada 5) = 0.7920, não passa na correção. Segundo recorte (CAMS PM2,5 > 25 µg/m³ (modelado)): 0.03, p = 0.1855, não confirma. Confiança baixa: não passa na correção. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-23. Números em produtos/contexto/rodada-5.csv.
