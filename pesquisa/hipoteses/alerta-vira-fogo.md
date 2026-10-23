---
id: 'alerta-vira-fogo'
titulo: 'A área do alerta de desmatamento queima nos 12 meses depois da detecção'
fontes: 'mapbiomas-alerta, inpe-deter, nasa-firms'
espera: 'densidade de focos no alerta acima de 3 vezes a da faixa em volta'
defasagem: '0 a 12 meses depois de DataDetec'
epoca: 'um valor por ano de detecção (12 meses depois de cada alerta)'
comparacao: 'a faixa de 0,5 a 1,5 km em volta do alerta, fora de outros alertas, no mesmo período (começa a 0,5 km pelo tamanho do pixel)'
teste: 'log da razão de densidade por ano de detecção, 2019 a 2024, com permutação de sinais entre os anos'
rodada: '4'
status: 'escrita'
escrita_em: '2026-10-23'
---
## Por quê
Depois do corte, a vegetação derrubada seca e é queimada para limpar a área (fogo de limpeza), em geral na seca seguinte.

## Como testar
Alertas validados do MapBiomas Alerta na caixa da região; focos do VIIRS S-NPP. 2025 ainda não tem 12 meses no arquivo FIRMS. Poucos anos (6): confiança baixa pela regra. Segundo recorte: alerta de corte raso do DETER (#74) no lugar do MapBiomas.

## Resultado
Ainda não testada.
