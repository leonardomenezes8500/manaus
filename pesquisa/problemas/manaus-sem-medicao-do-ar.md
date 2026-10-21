---
id: manaus-sem-medicao-do-ar
titulo: Manaus quase sem medição de qualidade do ar
tema: ar
status: com-evidencia
atualizado_em: 2026-10-21
---
## O que é
Uma capital de 2 milhões de habitantes, que fica dentro da fumaça das queimadas todo ano, não tem rede oficial de monitoramento do ar.
Há uma estação de referência (desde jul/2026) e sensores baratos de universidade, MP e Sema; nenhum órgão municipal ou estadual mede com equipamento de referência.

## Evidências
- No OpenAQ, a caixa da região (lon −74 a −52, lat −15 a 3) tem 10 locais; em Manaus só 1, um sensor barato AirGradient do Greenpeace no Centro, ativo desde 2025-07-11 (OpenAQ, 2026-10-21; `bruto/openaq/2026/10/21/215300Z_locations-regiao.json`).
- Esse sensor ficou 64 dias sem dado (2025-07-16 a 2025-09-18) e outros 14 dias em 2026-04/05 (OpenAQ, 2026-10-21; `bruto/openaq/2026/10/21/*_sensor-13574643-pm25_2025-0[789].json`).
- Única estação de referência: FioAres (Fiocruz/MMA, no ILMD), no MonitorAr desde ~2026-07-02; o arquivo nacional de 2025 não tem nenhuma estação no AM (MonitorAr, 2026-10-21; requisição de teste no card `monitorar-mma`, ainda sem bruto: coletor em #40).
- Em 2026-09-09 o prefeito vetou os pontos municipais de monitoramento previstos na Lei 3.699/2026 (Revista Cenarium, 2026-09; ver `pesquisa/sensores-manaus.md`).
- A rede usada pela imprensa e pela Defesa Civil são ~34 PurpleAir (UEA/EducAIR, Sema-AM, MPAM, UFAM), 15 no ar às 21:30Z de 2026-10-21 (SELVA/UEA, 2026-10-21; card `selva-uea`, ainda sem bruto: coletor em #41).

## Quem é afetado
A população de Manaus: 2.063.689 pessoas no Censo 2022 (IBGE, SIDRA tabela 4709, consultada em 2026-10-21 pela API `servicodados.ibge.gov.br/api/v3/agregados/4709`). Ela não tem dado oficial para alerta de saúde nos dias de fumaça.

## Quem é responsável
- Município (SEMMAS) e Estado (IPAAM / Sema-AM): licenciamento e controle da qualidade do ar no seu território (Resolução Conama 506/2024 e Lei 14.850/2024, Política Nacional de Qualidade do Ar). A confirmar com o texto das normas no M5.
- MMA: coordena o MonitorAr.

## Soluções ligadas
Nenhuma ainda (M5). Ideias: coletar e calibrar os sensores existentes (#40, #41, #42).
