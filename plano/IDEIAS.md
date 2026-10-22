# Ideias (caixa de entrada)

Qualquer ideia que surgir no meio do trabalho vem para cá, numa linha com a data. O sprint atual não muda por causa dela.
Entre um sprint e outro, a triagem decide cada linha: vira issue ou milestone no `ROADMAP.md`, fica no backlog ou é descartada (com o motivo).
A linha triada sai da caixa de entrada e vai para "Triadas", com o destino escrito.

## Caixa de entrada
- [2026-10-21] Asfalto: tipo e qualidade das ruas (onde tem, quando foi feito, quem fez, quanto durou).
- [2026-10-21] Cabos nos postes: fiação em excesso ou irregular (quem é o dono, quem fiscaliza).
- [2026-10-21] Águas de Manaus: cobertura de água e esgoto, falta d'água, qualidade e reclamações.
- [2026-10-21] Preço dos combustíveis por posto ao longo do tempo (levantamento da ANP).
- [2026-10-21] Preço da água potável ao longo do tempo (tarifa + garrafão de 20 L).
- [2026-10-21] Conta de energia: tarifa, quedas de luz (DEC/FEC) e comparação com outras capitais.
- [2026-10-21] Apps de transporte (Uber, 99, inDrive): preço e tempo de espera por região.
- [2026-10-21] Licitações: quais empresas ganham em cada setor e como isso muda com o tempo (PNCP, TCE-AM, Prefeitura, Estado).
- [2026-10-21] (do planejamento) Instalar sensores de PM2.5 baratos em pontos escolhidos (depende do resultado da 015).
- [2026-10-21] (#10) OpenAQ: há AirGradient em Porto Velho (5616182) e Lábrea (5616694), no caminho da fumaça que vem do sul. Coletar junto com o de Manaus para ver a pluma chegando.
- [2026-10-21] (#13) Manaus não tem rede oficial de qualidade do ar: 1 estação de referência (FioAres, Fiocruz) e ~34 PurpleAir de UEA/Sema/MPAM. O município vetou os pontos de monitoramento da Lei 3.699/2026 (9/9/2026). Coletores novos para a triagem: #40, #41, #42.
- [2026-10-22] (M2) Backup diário do banco vai crescer com as edificações e a telemetria (banco de dev: 1,2 GB). Tirar do `pg_dump` diário os esquemas que se refazem do bruto (`overture`, `openbuildings`, `osm`, `ana.leitura`) para o R2 continuar abaixo dos 10 GB grátis.
- [2026-10-22] (#24) Tentar de novo o geoportal da Prefeitura/IMPLURB (estava fora do ar) antes de mexer na fusão de bairros.
- [2026-10-22] (#49) A caixa da região termina em −52° de longitude, só 8° a leste de Manaus. Em 2026-10-18 (vento de leste), 17 das 24 trajetórias saíram da caixa antes das 72 h. Avaliar crescer a caixa para leste (vento e focos do FIRMS) junto com a região de influência (#8).
- [2026-10-22] (#49) HYSPLIT para conferir as trajetórias: o download pede e-mail e aceite dos termos da NOAA (proíbe redistribuir). Só se o usuário quiser fazer o cadastro; até lá a conferência é GFS × ERA5 (#51).
- [2026-10-22] (#54) MAIAC: a fumaça densa vira "nuvem" no QA e o dado some nos piores dias. Testar aceitar também o QA "possivelmente nublado" só nos dias com FU, ou trocar pelo MAIAC do VIIRS quando o MODIS parar.
- [2026-10-22] (#47) A fila do CDS (ERA5) passou de 1,5 h por pedido em 22/10 (o cron espera até 3 h). Se isso virar regra, ler o ERA5 do espelho público na nuvem (ARCO-ERA5, Zarr) em vez do CDS.
- [2026-10-22] (usuário) Milestone de "cidade básica": água e esgoto (Águas de Manaus, SINISA, SISAGUA), energia (ANEEL), licitações e gastos por setor (PNCP, TCE-AM, transparência, SICONFI, Querido Diário). Não é problema novo: são variáveis a mais para a análise da fumaça (correlação com focos, saúde e gastos). Cards já existem. Planejar logo depois do M3.
- [2026-10-22] (usuário) Calendário cultural e de períodos de Manaus, do AM e do Brasil: feriados, festas (Carnaval, Parintins, Boi Manaus, festas juninas), férias escolares, eleições, safra e época de preparo da roça, cheia e seca. Não é problema novo: serve para explicar a fumaça (quando queima, quando adoece, quando gasta). Planejar junto com a "cidade básica".
- [2026-10-22] (usuário) População detalhada: idade, sexo, cor/raça, renda, alfabetização por setor censitário (Censo 2022, demais tabelas dos "Agregados por setores"; hoje só a "basico" está no banco, com total de pessoas e domicílios) + projeções anuais por município (IBGE/SIDRA). Para pesar a exposição à fumaça por grupo (crianças, idosos). Planejar junto com a "cidade básica".
- [2026-10-22] (usuário) Método para cruzar as variáveis novas com a fumaça, antes de coletar: cada fonte entra com uma hipótese escrita (o que ela explicaria e por quê); separar a época do ano (seca, cheia, preparo da roça) para não confundir estação com causa; olhar defasagem (fumaça hoje, internação dias depois); grupo de comparação (dias sem fumaça, outras capitais); cuidado com muitas comparações (achado por acaso); cada conclusão com grau de confiança e medido ≠ modelado. Planejar junto com a "cidade básica".

## Triadas
- [2026-10-21] Alerta diário de fumaça para a população → M5 / S5.2
- [2026-10-21] Salas de ar limpo em escolas e postos de saúde → M5 / S5.2
- [2026-10-21] Fusão de edificações (OSM × Overture × Open Buildings) → M7
- [2026-10-21] (#25) IBGE SIDRA: população, PIB e produção por município, para pesar a fumaça pelo número de pessoas. Card `ibge-sidra`. → M5 / S5.2 (pesar a exposição pela população)
- [2026-10-21] (#25) DATASUS SIH/SUS: internações por CID e município, para ligar doença respiratória aos dias de fumaça. Card `datasus-sih`. → M4 / S4.3
- [2026-10-21] (#25) DATASUS CNES: hospitais e postos de saúde com endereço e leitos, para o mapa da rede de saúde. Card `datasus-cnes`. → M5 / S5.2
- [2026-10-21] (#25) ANA Telemetria: nível do Rio Negro em Manaus de 15 em 15 minutos, para cheia e seca. Card `ana-telemetria`. → M2 / #29
- [2026-10-21] (#25) INPE DETER: alertas de desmatamento e queimada com polígono e data, para ligar foco de fogo a desmatamento. Card `inpe-deter`. → M4 / S4.1
- [2026-10-21] (#25) Tesouro SICONFI: receitas e despesas oficiais da Prefeitura e do Estado, para o orçamento público. Card `siconfi`. → M4 / S4.3
- [2026-10-21] (#25) IBAMA áreas embargadas: quem foi autuado por desmatar ou queimar e onde, para donos e responsáveis. Card `ibama-embargos`. → M4 / S4.2
- [2026-10-21] (#25) AERONET: aerossol medido do chão no ATTO, para conferir satélite e modelo de fumaça. Card `aeronet`. → M3 / S3.2
- [2026-10-21] (#25) Querido Diário: texto do Diário Oficial de Manaus com busca, para decretos e contratos. Card `querido-diario`. → M4 / S4.3
- [2026-10-21] (#25) PNCP: licitações e contratos de todas as esferas em Manaus, para ver quem ganha em cada setor. Card `pncp`. → M4 / S4.3
