---
id: fumaca-seca-2026
titulo: Fumaça em Manaus na seca de 2026
tema: fumaca
status: com-evidencia
atualizado_em: 2026-10-22
---
## O que é
Entre agosto e outubro de 2026, o ar de Manaus passou a maior parte dos dias acima do limite diário de PM2.5 da OMS, e o aeroporto registrou fumaça.
Outubro é o pior mês até agora. Os números de PM2.5 medido vêm de um único sensor barato, então mostram a tendência, não o valor exato para a cidade.

## Evidências
- PM2.5 medido, média diária, de 01/08 a 20/10 (81 dias, todos com 18 h ou mais de dado): 54 dias acima da diretriz diária da OMS (15 µg/m³) e 30 dias acima do dobro (OpenAQ, sensor AirGradient do Centro, 2026-10-21; `bruto/openaq/2026/10/21/215149Z_sensor-13574643-pm25_2026-08.json`, `…215211Z_…_2026-09.json`, `…215231Z_…_2026-10.json`).
- Média mensal do mesmo sensor: agosto 9,8, setembro 31,9 e outubro (até dia 20) 74,5 µg/m³ (mesma fonte e arquivos).
- Pior dia: 17/10, com média de 197 µg/m³, 13 vezes a diretriz da OMS (mesma fonte; `…_2026-10.json`).
- Modelo CAMS no ponto de Manaus, mesmo período: média de 27,2 µg/m³. É modelo, não medição (Open-Meteo, 2026-10-21; `bruto/open-meteo-qualidade-ar/2026/10/21/215904Z_manaus-ar_2026-08-01_2026-08-31.json` e os dois meses seguintes).
- Aeroporto Eduardo Gomes (SBEG): 129 horas com fumaça (FU) ou névoa seca (HZ) entre 01/08 e 20/10, em 19 dias. Os dias com mais horas foram 12/10 (17 h), 18/10 (15 h) e 23/09 (12 h) (METAR via IEM, 2026-10-21; `bruto/iem-asos/2026/10/21/220158Z_SBEG_2026.csv`).
- No mesmo intervalo (1/ago a 20/out), 2024 teve 165 horas e 2023 teve 126; 2015 teve 114. Antes de 2012 o arquivo não tem esse campo (METAR via IEM; `bruto/iem-asos/2026/10/21/220145Z_SBEG_2024.csv`, `…220139Z_SBEG_2023.csv`, `…220050Z_SBEG_2015.csv`).
- Série 2012–2026 (`produtos/fumaca/serie-2012-2026.md` e `.csv`, gerada em 2026-10-22; METAR do SBEG, focos VIIRS S-NPP a até 800 km do arquivo FIRMS, cota do Rio Negro da ANA, AOD do AERONET): os anos com muitos dias de fumaça são 2015 (34 dias com FU), 2023 (33), 2024 (27) e 2026 (20, até 21/10). Nos outros anos foram de 0 a 5.
- Os dias com visibilidade abaixo de 5 km sem chuva nem névoa acompanham os dias com FU: 26, 26, 18 e 14 nesses quatro anos, e 0 em 2019, 2020, 2021 e 2025. Então o zero de FU desses anos é ar limpo de fato, e não um costume do observador (mesma série).
- Nos 14 anos completos (2012–2025), o número de dias com FU acompanha mais a seca do que os focos. Correlação de postos (Spearman) entre anos: −0,72 com a cota mínima do Rio Negro, 0,48 com os focos de agosto a novembro e 0,70 com a AOD de setembro e outubro (mesma série; são só 14 anos, então é tendência, não prova). Refeito pelo método na rodada 1 (#64, hipótese `cheia-seca-fumaca`, escrita antes): Spearman −0,76 entre a cota mínima de agosto a novembro e os dias com FU, p ajustado 0,025, passa na correção da rodada; confiança média (falta um segundo recorte independente).
- Nenhuma das duas coisas explica sozinha. 2020 teve tantos focos quanto 2015 (203 mil contra 201 mil) e nenhum dia com FU; 2012 teve a cota mínima igual à de 2015 (16,0 m) e só 2 dias com FU. Os anos de mais fumaça juntam seca forte e muitos focos: 2023 e 2024 tiveram as duas menores cotas da série (12,6 e 12,1 m) e os maiores números de focos. Falta o vento, que a série não mede: é o que a atribuição v1 olha (mesma série).
- De onde veio, pela heurística v0 (vento em linha reta, não é trajetória): ver `produtos/fumaca/temporada-2026.md` e os relatórios diários em `produtos/fumaca/AAAA-MM-DD/`.

## Quem é afetado
A população de Manaus: 2.063.689 pessoas no Censo 2022 (IBGE, SIDRA tabela 4709, consultada em 2026-10-21). O efeito na saúde (internações) entra no M4.

## Quem é responsável
Ainda não levantado com fonte. Controle do fogo e do desmatamento na origem (estados, Ibama, ICMBio) e alerta à população (Município, Estado, Defesa Civil): fica para o M4 e o M5.

## Soluções ligadas
Nenhuma ainda (M5).
