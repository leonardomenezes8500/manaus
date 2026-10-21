---
id: fumaca-seca-2026
titulo: Fumaça em Manaus na seca de 2026
tema: fumaca
status: com-evidencia
atualizado_em: 2026-10-21
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
- De onde veio, pela heurística v0 (vento em linha reta, não é trajetória): ver `produtos/fumaca/temporada-2026.md` e os relatórios diários em `produtos/fumaca/AAAA-MM-DD/`.

## Quem é afetado
A população de Manaus: 2.063.689 pessoas no Censo 2022 (IBGE, SIDRA tabela 4709, consultada em 2026-10-21). O efeito na saúde (internações) entra no M4.

## Quem é responsável
Ainda não levantado com fonte. Controle do fogo e do desmatamento na origem (estados, Ibama, ICMBio) e alerta à população (Município, Estado, Defesa Civil): fica para o M4 e o M5.

## Soluções ligadas
Nenhuma ainda (M5).
