---
id: 'previsao-cams-amanha'
titulo: 'A previsão do CAMS para amanhã acerta os dias de fumaça melhor do que repetir o dia de hoje'
fontes: 'ecmwf-ads, iem-asos, open-meteo-qualidade-ar, openaq, monitorar-mma'
espera: 'a AUC da previsão é maior que a de repetir hoje; importa se a diferença for 0,05 ou mais; diferença zero ou negativa contradiz um alerta pela previsão do CAMS'
defasagem: 'previsão feita no dia anterior (rodada de 00 UTC de D−1, antecedência de 28 a 52 h para o dia de Manaus D)'
epoca: 'só a temporada do fogo (agosto a novembro)'
comparacao: 'repetir hoje: as horas com FU do dia D−1 como previsão do dia D'
teste: 'diferença de AUC entre a previsão do CAMS (PM2,5 médio previsto para o dia D) e as horas com FU de D−1, para separar os dias D com 1 hora ou mais de FU; os dois escores em postos dentro da temporada; p por permutação pareada em blocos de 7 dias (troca, bloco a bloco, os postos dos dois escores)'
rodada: '6'
status: 'escrita'
escrita_em: '2026-10-28'
testada_em:
confianca:
resultado:
---
## Por quê
O alerta só serve se avisar antes. A base mais simples para avisar é repetir hoje: se hoje teve fumaça, amanhã também. A fumaça dura dias seguidos, então essa base já acerta muito. A previsão do CAMS só vale a pena se acertar mais do que ela.

## Como testar
Plano A, se o arquivo de previsões do CAMS no ADS funcionar (testado em 2026-10-28: um dia de 2015 com 24 h de antecedência ficou pronto em 41 s, card `ecmwf-ads`): as temporadas de agosto a novembro de 2015 a 2025 (#113), contra as horas com FU do METAR do SBEG (`analise.serie_dia`). Teste principal acima.

Plano B, se o plano A não andar: a previsão do CAMS guardada pelo Open-Meteo desde 21/10/2026 (`openmeteo.ar_hora`, com `rodada_em` e `valido_em`), e como verdade o PM2,5 medido do AirGradient do Centro (OpenAQ) e o IQAr da FioAres (MonitorAr) acima do limiar do dia de fumaça (provisório: 50 µg/m³, padrão diário em vigor da Conama 506/2024; também 15 µg/m³, da OMS). São poucas semanas no fim da temporada: o teste sai fraco e o resultado diz isso.

Exploratório (e diz isso): a mesma conta com 48 h de antecedência; acertos e alarmes falsos no limiar do dia de fumaça (para a solução do alerta, #116).

## Resultado
Vazio até testar.
