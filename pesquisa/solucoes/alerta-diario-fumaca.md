---
id: alerta-diario-fumaca
titulo: Alerta diário de fumaça para a população, com previsão
problemas: fumaca-seca-2026, manaus-sem-medicao-do-ar
proposta_por: UFAM (Qualiar-Ufam); UEA/EducAIR (app SELVA, com o MPAM); Fiocruz e Sesai (AlertAr Saúde); Coalizão Respira Amazônia; MPF/AM (boletins diários aos órgãos)
fonte: https://portalamazonia.com/meio-ambiente/ufam-plataforma-condicoes-ar/
status: com-evidencia
classificacao: paliativa
atua_em: efeito
teste_local: previsao-cams-amanha
classificada_em: 2026-10-30
quem_se_beneficia: a população de Manaus, 2.063.689 pessoas no Censo 2022 (issue 63), sobretudo 153.545 crianças de 0 a 4 e 199.781 idosos de 60+
recursos_existentes: [registro] Lei 14.850/2024 art. 18 (IQAr) e art. 13, III (plano para episódios críticos); a previsão do CAMS é pública (card ecmwf-ads)
evidencia_de_que_funciona: Toronto 2003–2012: o alerta de poluição reduziu ~25% as idas à emergência por asma, sem efeito em mortes e internações (Chen et al. 2018)
---
Um aviso na véspera, quando a previsão indica dia de fumaça, para escolas, unidades de saúde e população se prepararem. Hoje a Defesa Civil de Manaus avisa no próprio dia, sem limiar publicado. Este projeto testa na rodada 6 (#116) se a previsão do CAMS separa os dias de fumaça.

## Propostas
- UFAM, Comissão de Qualidade do Ar (Portaria 2721/2026), Qualiar-Ufam: previsão de 24 h, hora a hora, nas classes do IQAr, para Manaus e mais 5 municípios, com boletins 4 vezes por dia (imprensa, 25/10/2026: https://portalamazonia.com/meio-ambiente/ufam-plataforma-condicoes-ar/, acesso em 2026-10-28).
- UEA/EducAIR, com o MPAM: o app SELVA manda notificação em 3 níveis a partir dos sensores (imprensa, 15/07/2024: https://revistacenarium.com.br/en/air-pollution-in-amazonas-reduces-life-expectancy-by-12-year-warns-educair-coordinator, acesso em 2026-10-28).
- Fiocruz (Observatório de Clima e Saúde) e Sesai: AlertAr Saúde, que junta previsão de PM2,5 e focos para avisar com antecedência os distritos de saúde indígena (imprensa, 14/10/2026: https://portalamazonia.com/saude/fiocruz-queimada-saude-indigena/, acesso em 2026-10-28).
- Coalizão Respira Amazônia (nov/2024): alertas de risco à saúde por aplicativo e redes sociais (https://ipam.org.br/wp-content/uploads/2024/11/RESPIRA-AMAZONIA-v2-1-1.pdf, acesso em 2026-10-28).
- MPF/AM, recomendação de 13/10/2026: vigiar focos e plumas rumo à região metropolitana de Manaus "diária e ininterruptamente" e emitir "boletins preventivos diários", para os órgãos operacionais (https://www.mpf.mp.br/o-mpf/unidades/pr-am/noticias/mpf-recomenda-reforco-urgente-no-combate-a-queimadas-e-desmatamento-no-amazonas, acesso em 2026-10-28).
- Hoje: a Defesa Civil de Manaus emite alerta no dia, como em 17/10/2026, sem limiar publicado (imprensa: https://www.diariodepernambuco.com.br/brasil/2026/10/11726911-defesa-civil-alerta-para-qualidade-do-ar-pessima-em-manaus-devido-a-fumaca-de-queimadas.html, acesso em 2026-10-28).

## Evidências
- [terceiros] Toronto, 2003–2012: o alerta de poluição reduziu cerca de 25% as idas à emergência por asma, sem efeito em mortes nem em internações cardiovasculares; os autores concluem que o alerta sozinho protege pouco (Chen et al., Lancet Planetary Health 2018; https://www.publichealthontario.ca/en/about/news/2018/air-pollution-alerts, acesso em 2026-10-28).
- [terceiros] Revisão de 21 estudos: a parte das pessoas que reduz a atividade ao ar livre depois do alerta vai de 9,7% a 57% (mediana 31%) (D'Antoni et al., Environmental Health 2017; https://pmc.ncbi.nlm.nih.gov/articles/PMC5610416/, acesso em 2026-10-28).
- [registro] A Lei 14.850/2024 não tem dever expresso de alerta: tem o IQAr (art. 18) e o Plano para Episódios Críticos (art. 13, III). A Conama 506/2024 (art. 5º) só aceita método de referência ou equivalente para a informação de saúde, o que limita um alerta oficial feito só com sensor barato (`bruto/dou-in/2026/10/28/215649Z_f743b031_index.php.gz`).
- [modelado] O teste deste projeto: a rodada 6 (#116) mede se o PM2,5 do CAMS separa os dias com fumaça no aeroporto (hipótese `cams-separa-dias-fumaca`) e se a previsão de amanhã acerta mais do que repetir hoje (`previsao-cams-amanha`).
- [modelado] Rodada 6 (#116): o PM2,5 do CAMS EAC4 separa os dias com FU dos outros (AUC 0,89, 2012–2025, confiança alta; `cams-separa-dias-fumaca`); a previsão para o dia seguinte acerta mais do que repetir hoje (AUC 0,72 contra 0,63, p 0,019, confiança média; `previsao-cams-amanha`). Como alerta pelo limiar de 50 µg/m³, a previsão pega só 14% dos dias com FU e 70% dos alertas são falsos: o CAMS ordena bem os dias, mas erra o nível, e o alerta precisaria de limiar próprio.

## Classificação
Age no efeito: avisa para as pessoas se protegerem. Há evidência de fora (Toronto) e o teste local da rodada 6 mostra que a previsão do CAMS ordena os dias melhor do que repetir hoje. (critério v1, 2026-10-30, #117)
