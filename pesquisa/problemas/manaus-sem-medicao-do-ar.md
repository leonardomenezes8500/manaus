---
id: manaus-sem-medicao-do-ar
titulo: Manaus quase sem medição de qualidade do ar
tema: ar
status: com-evidencia
atualizado_em: 2026-10-28
---
## O que é
Uma capital de 2 milhões de habitantes, que fica dentro da fumaça das queimadas todo ano, não tem rede oficial de monitoramento do ar.
Há uma estação de referência (desde jul/2026) e sensores baratos de universidade, MP e Sema. Nenhum órgão municipal ou estadual mede com equipamento de referência, que é o que a Conama 506/2024 exige para verificar o padrão e informar a população.

## Evidências
- [medido] No OpenAQ, a caixa da região (lon −74 a −52, lat −15 a 3) tem 10 locais; em Manaus só 1, um sensor barato AirGradient do Greenpeace no Centro, ativo desde 2025-07-11 (OpenAQ, 2026-10-21; `bruto/openaq/2026/10/21/215300Z_locations-regiao.json`).
- [medido] Esse sensor ficou 64 dias sem dado (2025-07-16 a 2025-09-18) e outros 14 dias em 2026-04/05 (OpenAQ, 2026-10-21; `bruto/openaq/2026/10/21/*_sensor-13574643-pm25_2025-0[789].json`).
- [medido] Única estação de referência: FioAres (Fiocruz/MMA, no ILMD), no MonitorAr desde ~2026-07-02; o arquivo nacional de 2025 não tem nenhuma estação no AM. Coletada desde 21/10 (#40): 123 horas de IQAr de 21/10 15h a 28/10 16h, hora local. O MonitorAr só publica o índice, não a concentração (banco `manaus`, `monitorar.medicao`, consultado em 2026-10-28).
- [medido] Sensores baratos da rede SELVA (UEA/EducAIR, com Sema-AM, MPAM e UFAM): 69 cadastrados na região metropolitana, 39 com leitura nas últimas 24 h em 28/10. Coletados a cada 10 min desde 28/10 (#41), sem correção (banco `manaus`, `selva.sensor` e `selva.leitura`).
- [registro] A Lei municipal 3.699/2026 (saúde respiratória) previa pontos de monitoramento do ar com divulgação dos índices (art. 3º II). O prefeito vetou esse inciso em 08/09/2026 (Mensagem 81/2026), e a Câmara derrubou o veto em 26/10/2026; se a parte derrubada já foi promulgada não foi conferido (SAPL da CMM; `bruto/cmm-manaus/2026/10/28/221822Z_d46cf0b9_lei_n_3699_de_08_set_2026.pdf.gz`, `bruto/cmm-manaus/2026/10/28/221826Z_9e99d6c9_vp_019_pl_166-2025_ver._thaysa_lippy_mens.81_2026.pdf.gz`, `bruto/cmm-manaus/2026/10/28/221831Z_40424227_53029.gz`).
- [registro] O Amazonas declarou ao MMA não ter estação de referência e operar só rede indicativa de sensores baratos: 64 estações indicativas e nenhuma de referência em 2024 (Relatório Anual de Acompanhamento da Qualidade do Ar 2025, p. 17 e Tabela 7; `bruto/monitorar-mma/2026/10/28/221834Z_c0ec80f5_relatorio-anual-qualidade-do-ar-2025.pdf.gz`).
- [registro] Lei 14.850/2024 (Política Nacional de Qualidade do Ar): o monitoramento é dos órgãos do Sisnama, que devem criar uma Rede Nacional de Monitoramento (art. 7º). Os estados integram os dados ao MonitorAr, fazem o Relatório de Avaliação da Qualidade do Ar todo ano e divulgam os dados (art. 7º § 2º, II a IV), com o IQAr (art. 18). O plano estadual prevê a expansão da rede (art. 16, VII). Ao município cabe só contribuir com o inventário estadual de emissões (art. 11, parágrafo único); o art. 9º, que deixava estados e municípios fixarem limites mais restritivos, foi vetado (Mensagem 166/2024). Estado sem esses instrumentos fica impedido de receber recursos do orçamento geral da União (art. 23, parágrafo único) (planalto.gov.br, `_ato2023-2026/2024/lei/L14850.htm`, lido em 2026-10-28; bruto pendente: o Planalto derrubou a conexão nesse dia, ver `pesquisa/documentos.csv`).
- [registro] Resolução Conama 506/2024: a verificação do padrão e a informação de saúde usam método de referência ou equivalente (art. 5º); o MMA e os órgãos estaduais divulgam o IQAr em tempo real, por hora ou por dia (art. 8º), com os sistemas atualizados desde 01/01/2026 (art. 8º § 2º) (DOU de 09/07/2024; `bruto/dou-in/2026/10/28/215649Z_f743b031_index.php.gz`).

## Quem é afetado
A população de Manaus: 2.063.689 pessoas no Censo 2022 (IBGE, SIDRA tabela 4709, consultada em 2026-10-21 pela API `servicodados.ibge.gov.br/api/v3/agregados/4709`). Ela não tem dado oficial para alerta de saúde nos dias de fumaça.

## Quem é responsável
- [registro] O órgão ambiental do Estado: rede, relatório anual, divulgação pelo IQAr e plano estadual (Lei 14.850/2024 arts. 7º, 16 e 18; Conama 506/2024 art. 8º). No AM, a lei federal não diz se é o IPAAM ou a SEMA-AM; falta ler a lei estadual.
- [registro] MMA: integra e divulga no MonitorAr os dados das estações estaduais (Lei 14.850/2024 art. 17) e faz o Guia Técnico com os estados (art. 7º § 1º; Conama 506/2024 art. 7º).
- [registro] Município: na lei federal, só o inventário de emissões quando o estado pedir (Lei 14.850/2024 art. 11, parágrafo único). Pela Lei municipal 3.699/2026, com o veto derrubado em 26/10/2026, a Prefeitura passa a ter de pôr pontos de monitoramento (ver acima).

## Soluções ligadas
`rede-oficial-medicao-ar`, `calibrar-sensores-baratos`, `alerta-diario-fumaca`, `plano-episodios-criticos-am`, `sensores-escolas-dado-aberto`.
