---
id: 'previsao-cams-amanha'
titulo: 'A previsão do CAMS para amanhã acerta os dias de fumaça melhor do que repetir o dia de hoje'
fontes: 'ecmwf-ads, iem-asos, open-meteo-qualidade-ar, openaq, monitorar-mma'
espera: 'a AUC da previsão é maior que a de repetir hoje; importa se a diferença for 0,05 ou mais; diferença zero ou negativa contradiz um alerta pela previsão do CAMS'
defasagem: 'previsão feita no dia anterior (rodada de 00 UTC de D−1, antecedência de 28 a 52 h para o dia de Manaus D)'
epoca: 'só a temporada do fogo (agosto a novembro)'
comparacao: 'repetir hoje: as horas com FU do dia D−1 como previsão do dia D'
teste: 'diferença de AUC entre a previsão do CAMS (PM2,5 médio previsto para o dia D) e as horas com FU de D−1, para separar os dias D com 1 hora ou mais de FU; os dois escores em postos dentro da temporada e a AUC só com pares de dias da mesma temporada (corrigido em 2026-10-30, ver Resultado); p por permutação pareada em blocos de 7 dias (troca, bloco a bloco, os postos dos dois escores)'
rodada: '6'
status: 'testada'
escrita_em: '2026-10-28'
testada_em: '2026-10-30'
confianca: 'baixa'
resultado: 'AUC da previsão do CAMS para o dia seguinte 0.76 contra 0.75 de repetir as horas com FU de hoje, 1342 dias de agosto a novembro, 11 temporadas (2015–2025), só pares de dias da mesma temporada; diferença +0.01 (importa a partir de 0,05); p = 0.7603, p ajustado (BH da rodada 6) = 0.7603, não passa na correção'
---
## Por quê
O alerta só serve se avisar antes. A base mais simples para avisar é repetir hoje: se hoje teve fumaça, amanhã também. A fumaça dura dias seguidos, então essa base já acerta muito. A previsão do CAMS só vale a pena se acertar mais do que ela.

## Como testar
Plano A, se o arquivo de previsões do CAMS no ADS funcionar (testado em 2026-10-28: um dia de 2015 com 24 h de antecedência ficou pronto em 41 s, card `ecmwf-ads`): as temporadas de agosto a novembro de 2015 a 2025 (#113), contra as horas com FU do METAR do SBEG (`analise.serie_dia`). Teste principal acima.

Plano B, se o plano A não andar: a previsão do CAMS guardada pelo Open-Meteo desde 21/10/2026 (`openmeteo.ar_hora`, com `rodada_em` e `valido_em`), e como verdade o PM2,5 medido do AirGradient do Centro (OpenAQ) e o IQAr da FioAres (MonitorAr) acima do limiar do dia de fumaça (provisório: 50 µg/m³, padrão diário em vigor da Conama 506/2024; também 15 µg/m³, da OMS). São poucas semanas no fim da temporada: o teste sai fraco e o resultado diz isso.

Exploratório (e diz isso): a mesma conta com 48 h de antecedência; acertos e alarmes falsos no limiar do dia de fumaça (para a solução do alerta, #116).

## Resultado
AUC da previsão do CAMS para o dia seguinte 0.76 contra 0.75 de repetir as horas com FU de hoje, 1342 dias de agosto a novembro, 11 temporadas (2015–2025), só pares de dias da mesma temporada; diferença +0.01 (importa a partir de 0,05); p = 0.7603, p ajustado (BH da rodada 6) = 0.7603, não passa na correção. Confiança baixa: não passa na correção. Previsão do CAMS modelada contra FU medido no METAR; 9999 permutações, semente 64, banco manaus em 2026-10-30. Números em produtos/contexto/rodada-6.csv.

Correção de método (2026-10-30, segunda visão do Codex no PR do M5): a primeira conta punha os postos dentro da temporada, mas a AUC comparava dias de temporadas diferentes. Isso não media o que o teste diz, e prejudicava repetir hoje: quase todos os dias têm zero hora com FU, e o posto desse empate muda de uma temporada para outra. Com a primeira conta saiu 0,72 contra 0,63 (diferença +0,09, p 0,019). Vale a conta corrigida, acima.

Exploratório (2026-10-30, mesmos dias, não entra na correção): com 2 dias de antecedência a AUC da previsão fica em 0,74. Como alerta de dia com FU (93 dias com FU), a previsão para o dia seguinte acima de 50 µg/m³ dá 44 alertas, 13 acertos (14% dos dias com FU) e 31 alarmes falsos (70% dos alertas); acima de 15 µg/m³, 661 alertas, 87 acertos (94%) e 574 alarmes falsos (87%). O valor absoluto do CAMS não serve de limiar, e a ordem dos dias que ele dá é a mesma de repetir hoje.
