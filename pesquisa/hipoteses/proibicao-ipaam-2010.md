---
id: 'proibicao-ipaam-2010'
titulo: 'Depois da proibição do IPAAM de 2010, a fatia dos focos de agosto a outubro cai no AM em relação a RO e AC'
fontes: 'nasa-firms, doe-am, ana-telemetria'
espera: 'a fatia dos focos do ano que cai de agosto a outubro diminui no AM mais do que em RO e AC depois de 2010; importa se a diferença passar de 10 pontos percentuais'
defasagem: '0 (mesmo ano)'
epoca: 'fatia anual de agosto a outubro (a sazonalidade fica dentro da fatia)'
comparacao: 'RO e AC no mesmo ano, e os anos de 2003 a 2009 contra 2010 a 2025'
teste: 'diferença das diferenças da fatia de agosto a outubro (AM menos a média de RO e AC), 2003–2009 contra 2010–2025, MODIS, permutando os rótulos dos anos'
rodada: '3'
status: 'testada'
escrita_em: '2026-10-23'
testada_em: '2026-10-26'
confianca: 'media'
resultado: 'fatia dos focos do ano de agosto a outubro, AM menos a média de RO e AC (MODIS), 2010–2025 menos 2003–2009: 7.1 pontos percentuais; p = 0.0055, p ajustado (BH da rodada 3) = 0.0083, passa na correção, na direção contrária à esperada: a hipótese não se confirma'
---
## Por quê
A Portaria IPAAM 127/2010 proíbe a queima no AM de agosto a outubro. Se a regra pega, parte do fogo do AM muda de mês ou deixa de acontecer, e os estados vizinhos sem essa regra não mudam do mesmo jeito. Substitui a `proibicao-fogo-focos`, que ficou sem teste porque todo ano desde 2010 tem a proibição.

## Como testar
Focos MODIS do arquivo FIRMS (desde 2000-11) por estado. Começa em 2003 porque o Aqua só entra em 2002-07 e mudaria a fatia daquele ano. RO e AC também têm proibições próprias, o que pode diminuir a diferença. Exploratório: se o fogo foi para julho ou novembro, e o decreto do AM de 2024 (RMM e Sul do AM).

## Resultado
fatia dos focos do ano de agosto a outubro, AM menos a média de RO e AC (MODIS), 2010–2025 menos 2003–2009: 7.1 pontos percentuais; p = 0.0055, p ajustado (BH da rodada 3) = 0.0083, passa na correção, na direção contrária à esperada: a hipótese não se confirma. Confiança media: falta um segundo recorte independente. Dado medido; 9999 permutações, semente 64, banco manaus em 2026-10-26. Números em produtos/contexto/rodada-3.csv.
