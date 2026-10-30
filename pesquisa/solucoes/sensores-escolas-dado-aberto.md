---
id: sensores-escolas-dado-aberto
titulo: Sensores baratos de PM2,5 em escolas e faculdades, com dado aberto e projetos de quem quiser usar
problemas: manaus-sem-medicao-do-ar, fumaca-seca-2026
proposta_por: este projeto
fonte: https://appselva.com.br/
status: com-evidencia
classificacao: especulativa
atua_em: causa
teste_local: sensores-cobertura
classificada_em: 2026-10-30
quem_se_beneficia: 53 de 544 escolas públicas (7,9% dos alunos) estão hoje a até 2 km de um sensor no ar; 10 sensores em escolas cobririam mais 253.631 alunos (issue 115)
recursos_existentes: [registro] Lei municipal 3.699/2026 art. 3º II; o AM declarou ao MMA 64 estações indicativas (Relatório 2025)
evidencia_de_que_funciona: redes abertas de sensores baratos existem e o dado delas é usado por terceiros (mapa de fumaça da EPA, Qualiar-Ufam, rede do Acre); nenhum estudo achado sobre o efeito de pôr sensor em escola na exposição ou na política
---
Ampliar a rede SELVA com sensores baratos de PM2,5 em escolas e faculdades de Manaus e publicar o dado aberto e documentado: histórico, licença, posição, modelo do sensor e correção aplicada. Junto, chamar gente para usar o dado: feira ou olimpíada de dados nas escolas, projeto de hobby e análise de terceiros. A ideia é do usuário (2026-10-29).

Limite: sensor barato é indicativo. Pela Conama 506/2024, só método de referência ou equivalente serve para verificar o padrão e para a informação de saúde. Esta solução serve para cobertura (onde a fumaça está pior dentro da cidade) e para ciência e ensino; não serve para dizer se o padrão foi cumprido nem substitui a rede oficial (`rede-oficial-medicao-ar`). A correção local contra a FioAres (#42 e `calibrar-sensores-baratos`) baixa o erro, mas não torna o sensor equivalente para a norma; até ela existir, o dado sai rotulado como sem correção.

O que pode dar errado: sensor parado sem manutenção (o AirGradient do Centro ficou 64 dias sem dado em 2025), ninguém pagando reposição e internet, vandalismo, e a posição exata do sensor dizer onde ficam as crianças. Escola mais fácil de instalar tende a ser a mais bem equipada, o que enviesa onde a rede cresce.

## Propostas
- Este projeto, ideia do usuário (2026-10-29). As partes já existem em outros lugares (o EducAIR põe sensores e faz educação ambiental; a Coalizão pede rede maior e calibrada); o que é nosso é juntar sensor em escola e faculdade, dado aberto e documentado e incentivo a projetos com o dado. Não achamos essa combinação escrita por órgão, MP, ONG ou universidade em Manaus (busca de 2026-10-29).
- Coalizão Respira Amazônia (Instituto Ar, IPAM, INPA, UEA, Woodwell e outros), policy brief de nov/2024: ampliar o monitoramento na Amazônia Legal e calibrar os sensores baratos com os de referência (https://ipam.org.br/wp-content/uploads/2024/11/RESPIRA-AMAZONIA-v2-1-1.pdf, acesso em 2026-10-28).
- UEA, Programa de Educação Ambiental sobre Poluição do Ar (EducAIR): já instala sensores e faz educação ambiental com a rede SELVA, com o MPAM e a Sema-AM (https://appselva.com.br/, acesso em 2026-10-28). Não achamos página oficial do EducAIR com plano de ampliar para escolas.

## Evidências
- [medido] A rede SELVA tem 69 sensores cadastrados na Região Metropolitana de Manaus, 39 com leitura em 28/10/2026, todos PurpleAir sem correção (banco `manaus`, `selva.sensor` e `selva.leitura`; card `fontes/selva-uea.md`).
- [medido] O dado da SELVA não é aberto do jeito que esta solução pede: o site repassa só a leitura atual, por um endpoint sem documentação que pede cookie e cabeçalho Origin, sem histórico, sem canais A e B, sem umidade e sem licença declarada. Pedimos o acesso formal à UEA por LAI (card `fontes/selva-uea.md`, verificado em 2026-10-28; `plano/pedidos-lai.md`).
- [medido] No Sensor.Community, a rede aberta de sensores feitos por voluntários, havia 31 sensores no Brasil com leitura em 29/10/2026, o mais ao norte perto de 16° S, então nenhum na Amazônia (API pública; `bruto/sensor-community/2026/10/29/155807Z_9a7a45a4_country-BR.gz`).
- [terceiros] O Sensor.Community nasceu em Stuttgart (luftdaten.info) e publica como dado aberto tudo o que os sensores medem, com mapa, API e arquivo de histórico (https://sensor.community/en/, acesso em 2026-10-29).
- [terceiros] Rede de Qualidade do Ar do Acre: 30 sensores PurpleAir nas sedes dos 22 municípios, operando desde junho de 2019, feita pelo MPAC com a UFAC, com dado em tempo real; artigo da UFAC usou o dado de 2019 a 2021 e achou o PM2,5 acima da OMS na seca (Melo et al., SBSR 2023; https://dataserver-coids.inpe.br/queimadas/queimadas/Publicacoes-Impacto/material3os/2023_Melo_etal_QualidadeAr_XXSBSR_DE3os.pdf, acesso em 2026-10-29).
- [terceiros] Uso por terceiros em Manaus: a Comissão de Qualidade do Ar da UFAM (Portaria 2721/2026) montou o Qualiar-Ufam com os sensores PurpleAir da cidade, corrigidos pelo método da EPA por causa da umidade, e publica boletim e previsão de 24 h (Portal Amazônia, 25/10/2026; https://portalamazonia.com/meio-ambiente/ufam-plataforma-condicoes-ar/, acesso em 2026-10-29).
- [terceiros] Uso por terceiros nos EUA: desde agosto de 2020, o mapa de fogo e fumaça da EPA e do Serviço Florestal mostra o dado público da PurpleAir, corrigido e filtrado; eram ~7.500 sensores no lançamento e ~15.000 em 2024, com mais de 13 milhões de acessos de junho a agosto de 2023. Antes de abrir o mapa, a EPA pôs sensores ao lado de estações de referência para tirar a correção (EPA, apresentação de jul/2024; https://www.epa.gov/system/files/documents/2024-10/wed130_sensors_evans.pdf, acesso em 2026-10-29).
- [terceiros] Escolas: o SAMHE, no Reino Unido, monta uma rede de monitores (CO2, compostos orgânicos voláteis e PM) representativa das escolas do país, com os alunos lendo o dado da própria sala (Universidade de York; https://www.york.ac.uk/yesi/research/environment-health/samhe/, acesso em 2026-10-29). Mede o ar de dentro da sala, não a fumaça de fora, e não conferimos se o dado é aberto. No Brasil, o Projeto Ares mede CO2, temperatura, umidade, material particulado e compostos orgânicos voláteis em salas de aula com sensores baratos (Gomes et al., Engenharia Urbana em Debate, 2026; https://doi.org/10.14244/engurbdebate.v7i1.170, acesso em 2026-10-29).
- [terceiros] Competição com dado de sensor: o Smogathon de Cracóvia (2015) teve 44 projetos e 250 participantes, e dele saiu a Airly, que hoje vende sensores de PM2,5 (https://smogathon.com/lasteditions/smogathon-2015/, acesso em 2026-10-29). Não achamos estudo que mostre que feira, olimpíada ou hackathon de dados mudou a exposição ou a política do ar.
- [terceiros] Sensor barato sem correção superestima o PM2,5 em cerca de 40% (PurpleAir, EUA); a correção da EPA baixa o erro de 8 para 3 µg/m³ (Barkjohn et al., AMT 2021; https://amt.copernicus.org/articles/14/4617/2021/, acesso em 2026-10-28). Nunca foi validada no aerossol de Manaus.
- [registro] Conama 506/2024 art. 5º: para verificar o padrão e para a informação de saúde, só método de referência ou equivalente (`bruto/dou-in/2026/10/28/215649Z_f743b031_index.php.gz`).
- [registro] O Amazonas declarou ao MMA 64 estações indicativas e nenhuma de referência em 2024 (Relatório 2025 do MMA, Tabela 7; `bruto/monitorar-mma/2026/10/28/221834Z_c0ec80f5_relatorio-anual-qualidade-do-ar-2025.pdf.gz`).
- [registro] Cobertura em 29/10/2026 (#115): 53 de 544 escolas públicas com ponto (7,9% dos alunos) e 26 de 232 privadas (13,4%) ficam a até 2 km do único sensor "no ar"; os próximos 10 sensores em escolas, escolhidos um a um, cobririam mais 253.631 alunos (`produtos/solucoes/sensores-cobertura.md`).

## Como avaliar
Escrito em 2026-10-29, antes de cruzar escolas e sensores. É conta de cobertura, como em `rede-oficial-medicao-ar`, sem hipótese nem p-valor. Entra na #115:
- quantas escolas de Manaus (CNEFE, #22; públicas e privadas à parte pelo INEP, #111; faculdades só se o CNEFE separar) ficam a até 2 km de um sensor no ar, com o mesmo "no ar" da #115 (leitura em 80% das horas dos últimos 14 dias);
- quantas passariam a ficar se os próximos 10 sensores fossem em escolas, escolhidas uma a uma pelo maior número de alunos novos cobertos;
- referência (FioAres) e indicativos (SELVA, AirGradient) contados à parte, com os indicativos rotulados como sem correção até a #42;
- os 2 km medem cobertura, não exposição nem benefício.

## Segunda visão (Codex, 2026-10-29)
O Codex leu a solução, o critério e as vizinhas. Aceitamos: a contagem da SELVA (70 virou 69, como no problema), a correção que não garante equivalência, os riscos de manutenção, custo, privacidade e viés, e deixar claro que a combinação é nossa e as partes não.
Onde discordamos:
- `proposta_por`: ele queria qualificar o campo; ficou `este projeto`, que é o valor que o critério usa na tabela-resumo, e a seção Propostas diz o que já existia.
- Escolha dos próximos 10 por alunos novos cobertos: ele sugeriu pesar fumaça e vulnerabilidade. Fica por alunos (a #115 usa pessoas, com a mesma regra) porque o CAMS é uma célula só e a fumaça é tratada como igual na cidade; pesar vulnerabilidade fica em aberto.
- "No ar" = 80% das horas em 14 dias: ele achou que pode não representar a seca. Fica igual ao da #115, para as duas contas baterem.
- Classe: ele previu especulativa (ou prática na causa, se verba e órgão forem conferidos). Não gravamos: a classe sai na #117, com o critério, para todas de uma vez.

## Classificação
Especulativa: o dado aberto do SELVA não existe hoje (pedido LAI pendente), o único registro de verba é o parecer da PGM que diz "sem dotação", e o sensor barato segue indicativo (Conama 506 art. 5º). A cobertura de 29/10 reflete também a nossa coleta com menos de 14 dias. (critério v1, 2026-10-30, #117)
