---
id: salas-ar-limpo-escolas-ubs
titulo: Salas de ar limpo em escolas e unidades básicas de saúde
problemas: fumaca-seca-2026
proposta_por: US EPA; OMS Europa; Seduc-AM (orientação da NT Conjunta SES-AM/FVS-RCP 22/2026)
fonte: https://www.epa.gov/emergencies-iaq/wildfires-and-indoor-air-quality-schools-and-commercial-buildings
status: rascunho
classificacao:
atua_em:
teste_local:
classificada_em:
quem_se_beneficia: alunos, crianças pequenas e idosos atendidos nas escolas e UBS escolhidas (número na issue 114)
recursos_existentes: a conferir (#117): salas climatizadas do Censo Escolar (#111), UBS do CNES (#112), compras no PNCP
evidencia_de_que_funciona: purificador HEPA reduz o PM2,5 dentro da sala em 48 a 78% em dia de fumaça (Seattle, 2020); efeito na saúde com pouca evidência
---
Uma sala por escola ou UBS, fechada, com purificador HEPA (ou filtro no ar-condicionado), para onde vão os mais sensíveis nos dias de fumaça. Em Manaus não achamos proposta de compra de equipamento, só a orientação de manter os alunos em sala fechada e climatizada.

## Propostas
- US EPA: plano "Smoke-Ready" para escolas, com espaços de ar mais limpo, purificador portátil, filtro MERV 13 no ar-condicionado central e sensor interno; escolas como "cleaner air centers" (https://www.epa.gov/emergencies-iaq/wildfires-and-indoor-air-quality-schools-and-commercial-buildings, acesso em 2026-10-28).
- OMS Europa (16/06/2023): escolas, creches, asilos e hospitais podem ter salas climatizadas para os mais sensíveis (https://www.who.int/europe/news-room/questions-and-answers/item/public-health-advice-during-the-wildfires--how-to-protect-your-health-and-keep-safe, acesso em 2026-10-28).
- Seduc-AM, 13/10/2026, com base na Nota Técnica Conjunta SES-AM/FVS-RCP 22/2026: manter os alunos em ambientes "ventilados, climatizados ou equipados com mecanismos de melhoria da qualidade do ar". Só orientação; o texto da nota técnica não foi achado em site oficial (imprensa: https://www.pebsp.com/?p=51209, acesso em 2026-10-28).
- Não achamos proposta do MPAM, do MPF, da Defensoria, da Fiocruz, da UEA, da Semed ou de parlamentares para pôr purificador em escola ou UBS (busca de 2026-10-28).

## Evidências
- [terceiros] Purificador HEPA em casa durante fumaça de incêndio (Seattle, 2020): o PM2,5 dentro caiu de 48 a 78%; sem purificador, de 33 a 76% do PM2,5 de fora entra na casa. Só 5 casas e 1 a 2 dias; o efeito cai muito com janela aberta (Xiang et al., Sci Total Environ 2021; https://pmc.ncbi.nlm.nih.gov/articles/PMC8026580, acesso em 2026-10-28).
- [terceiros] Saúde: num ensaio com 45 adultos expostos a fumaça de lenha (Smithers, Canadá), o HEPA baixou ~60% do PM2,5 interno, melhorou a função endotelial (+9,4%) e baixou a PCR (−32,6%); um estudo de 2015 em Vancouver não repetiu o achado endotelial (Allen et al. 2011; https://pmc.ncbi.nlm.nih.gov/articles/PMC3080954/, acesso em 2026-10-28).
- [terceiros] Aprendizagem: filtro de ar em sala de aula subiu as notas em 0,1 a 0,2 desvio-padrão, num caso de vazamento de gás, não de fumaça (Gilraine, J. Human Resources 2025; https://jhr.uwpress.org/content/60/5/1469, acesso em 2026-10-28).
- [medido] No nosso dado, as internações respiratórias de moradores de Manaus não subiram depois de dias com fumaça (rodada 5, confiança baixa; problema `fumaca-seca-2026`). O ganho de saúde só tem evidência de fora.
- [terceiros] Limite: ar-condicionado split, comum nas escolas, recircula o ar mas filtra pouco. A queda de ~70% medida com climatização é de um prédio com sistema central (Wheeler et al. 2021, ver `abrigos-ar-limpo`).

## Como avaliar
Escrito em 2026-10-28 (#110), antes de baixar o INEP e o CNES. É uma conta de cobertura, não um cruzamento: não tem hipótese nem p-valor.
- Universo: escolas públicas (municipais, estaduais e federais) em atividade em Manaus com educação infantil ou ensino fundamental (Censo Escolar 2024 do INEP, #111); UBS de gestão municipal (CNES, tipo de unidade 02 e gestão M, #112).
- Ordem: escolas pelo número de matrículas de 0 a 14 anos (creche, pré-escola e fundamental); UBS pelo número de crianças de 0 a 4 anos e de idosos de 60 anos ou mais nos setores censitários cujo centro fica a até 1 km da UBS (Censo 2022, #63). A fumaça é tratada como igual na cidade toda, porque o CAMS é uma célula só.
- N: as 10, 50 e 100 primeiras escolas; as 10 e 30 primeiras UBS. Para cada N, quantas matrículas e quantas crianças e idosos ficam cobertos, e que parte do total de Manaus isso é.
- Dias letivos com fumaça por ano, 2012–2026: dias do calendário escolar oficial (#61) com 1 hora ou mais de FU no METAR do aeroporto (medido).
- Horas-aluno em dias de fumaça, 2025–2026: dias letivos com PM2,5 médio do sensor do Centro (AirGradient) acima do limiar do dia de fumaça, vezes as matrículas.
- Limiar do dia de fumaça (Em aberto, provisório): 50 µg/m³ na média de 24 h, o padrão diário em vigor da Conama 506/2024 (PI-2); a conta sai também com 15 µg/m³, o valor da OMS e padrão final da mesma resolução. Na temporada de 2026, 15 dias passaram de 50 e 61 passaram de 15 (já visto em #105, antes desta escolha).
- O quanto a sala reduz o PM2,5 dentro entra como faixa `[terceiros]` (48 a 78%), nunca como medido.
