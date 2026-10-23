**Sprint atual: M4 em revisão** (PR único do M4, aberto em 2026-10-23). S4.2 e S4.3 fecharam em 2026-10-23, menos o que espera o CAR ([#83](https://github.com/leonardomenezes8500/manaus/issues/83) a #86 e o elo do imóvel na #93, download à mão do usuário), a #42 (a partir de ~05/11) e a #41 (decisão do usuário). A conferência do M4 é a [#94](https://github.com/leonardomenezes8500/manaus/issues/94); a do M3 ([#57](https://github.com/leonardomenezes8500/manaus/issues/57)) fechou com 24 h de cron. Atualizar ao fim de cada sprint, depois da triagem do `IDEIAS.md`.

Visão geral. O trabalho em si está no GitHub: [milestones](https://github.com/leonardomenezes8500/manaus/milestones) M0–M7, [issues](https://github.com/leonardomenezes8500/manaus/issues) com uma label por sprint (`S0.1`...). Sprint = ~1 semana de trabalho de agente. M0–M3 e o M3.5 já têm issues; do M4 em diante são só linhas aqui, que viram issues quando chegar a vez.

## Decisões tomadas (o usuário precisa confirmar)
- **(2026-10-21) Repo público no GitHub** (`leonardomenezes8500/manaus`), com issues e sprints lá. Público porque o Actions é grátis em repo público e o usuário já queria abrir o projeto. Nada sensível no repo (ver `CLAUDE.md`).
- **(2026-10-21) Nada roda em servidor local do usuário.** A coleta contínua 24h roda na VPS **slice**, em Docker, num projeto compose próprio (`manaus`). A slice já roda produção de outros projetos, então: limite de CPU e memória em todo container, nada exposto (Postgres só em 127.0.0.1, acesso por túnel ssh) e nunca tocar em container, volume ou proxy de outro projeto.
- **Deploy pelo GitHub Actions:** testes, imagem no GHCR e deploy por SSH na slice, com o `.env` de lá escrito a partir dos secrets. Nada de `schedule:` no Actions: a coleta periódica é o cron da slice. CI enxuto (ver `COMO-TRABALHAR.md`).
- O dado bruto vai para o **Cloudflare R2** (S3), imutável e datado. O disco da slice é só buffer/cache.
- Postgres + PostGIS em container na slice, com limite de memória e backup diário (`pg_dump`) para o R2.
- Processamento pesado e ocasional (raster MapBiomas, relevo, reprocessar histórico) roda **neste PC**, sob demanda, lendo e gravando no R2. Nada contínuo depende dele.
- **TypeScript** em coleta, análise e API, com testes Jest. O GDAL na linha de comando (`ogr2ogr`, `gdalwarp`) carrega os mapas. Python só se não houver outra saída (ex.: HYSPLIT, NetCDF), com o motivo escrito na issue.
- Mapas raster (MapBiomas, relevo) ficam como arquivo COG em `normalizado/` no R2, fora do PostGIS. A consulta por ponto usa `gdallocationinfo` direto no R2 (`/vsis3/`).
- Horários vão para o banco em UTC. "Dia" é o dia de Manaus (UTC−4).
- OSM é baixado **toda semana**, porque o próprio OSM guarda o histórico. Fonte que perde histórico se não for salva tem coleta frequente.
- A atribuição v0 da fumaça é uma heurística (vento local em linha reta). Retrotrajetória de verdade só no M3, e o relatório tem que dizer isso.
- **(2026-10-22) Fonte nova só entra com hipótese escrita antes** (método da [#59](https://github.com/leonardomenezes8500/manaus/issues/59)): o que ela explicaria e por quê, a época, a defasagem e o grupo de comparação. Um teste do catálogo barra fonte nova em `coletando` sem hipótese. Vale do M3.5 em diante, inclusive no M4.

## Em aberto (decisão do usuário)
- **(2026-10-21) Língua do código.** Código novo (identificadores e comentários) é em inglês; docs, issues e PRs em pt-BR. Renomear o código que já existe (`coleta/`, `db/migracoes/`, scripts `migrar`/`tipos`, funções e tabelas em português) espera o usuário. Até lá, nada existente é renomeado, e tabela nova segue o nome em português que a issue já fixou, para não misturar dentro do mesmo esquema.
- **(2026-10-22) Camada de contexto (M3.5) antes do M4.** O M4 (do fogo ao dono, à saúde e ao gasto) começa uns 2 sprints depois. Se o usuário preferir o M4 primeiro, o S4.3 espera o método e a população do M3.5.
- **(2026-10-22) O que conta como fonte oficial no calendário (M3.5):** lei e decreto (Planalto, Assembleia do AM, Câmara de Manaus), TSE, secretarias de educação (SEDUC, SEMED), FIFA, COI/COB, CBF e FAF. O Querido Diário entra só como busca no Diário Oficial de Manaus, sempre com o link da edição oficial.
- **(2026-10-22) Recorte do calendário (M3.5):** Brasil, AM e Manaus (do interior, só o Festival de Parintins). Eleições e esportes desde 1994; escola e festas desde 2012, o período da série da fumaça. "Jogo relevante no Amazonas" = jogo das competições nacionais da CBF com mando em Manaus, finais do Amazonense e os jogos da Copa de 2014 e dos Jogos de 2016 na Arena da Amazônia.
- **(2026-10-22) Copa × eleição:** desde 1994 toda eleição presidencial caiu em ano de Copa, então não há ano para comparar. Fica escrita como hipótese sem teste; no máximo, desempenho da seleção × voto no governo (n ≈ 9, confiança baixa).

## Pendências do usuário
- **R2:** criar o bucket e um token **só de leitura e escrita de objetos, só nesse bucket**; no bucket, a regra de ciclo de vida "apagar `backup/pg/` com mais de 14 dias" (o código nunca apaga nada no R2). Depois pôr `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET` no `.env` local e no GitHub com `gh secret set <NOME>` (o valor é digitado no prompt, nunca colado no chat). Bloqueia a [#3](https://github.com/leonardomenezes8500/manaus/issues/3) e o resto do M0.
- Renovar o token NASA Earthdata **até 2026-12-10**, porque ele expira em 2026-12-20 ([#7](https://github.com/leonardomenezes8500/manaus/issues/7)).
- **Earthdata, usuário e senha (M3, [#54](https://github.com/leonardomenezes8500/manaus/issues/54)):** pôr `EARTHDATA_USER` e `EARTHDATA_PASSWORD` no `.env` deste PC (só aqui, não vai para a slice nem para o GitHub). O AppEEARS, que dá a série do MAIAC num CSV pequeno, não aceita o token. Sem isso, o MAIAC fica só nos dias da comparação, e a série 2012–2026 sai sem ele.
- **PurpleAir ([#41](https://github.com/leonardomenezes8500/manaus/issues/41), foi para o M4 em 2026-10-22):** decidir entre pedir à UEA/EducAIR autorização para ler o mapa do SELVA e/ou criar uma chave da API PurpleAir (grátis no começo, depois paga por uso). Saiu do M3 sem decisão.
- Conta no Copernicus Data Space: não faz mais falta no M3, porque o Sentinel-5P saiu dele. Fica para quando ele voltar.
- **CAR (S4.2, [#83](https://github.com/leonardomenezes8500/manaus/issues/83)):** baixar à mão, na "Base de downloads" do SICAR, os perímetros dos imóveis de AM, AC, RO e PA (4 zips, tem captcha de imagem, ~5 min). O passo a passo está na #83. Sem isso, o S4.2 para no #84.
- Confirmar as decisões acima.

---

## [M0](https://github.com/leonardomenezes8500/manaus/milestone/1) — Fundação (1 sprint)
**Objetivo:** repo com esqueleto, formato fixo do catálogo, bruto imutável no R2, CI/CD pelo Actions e a slice pronta para cron e banco em Docker.
**Pronto quando:** `npm test` passa aqui e no CI; um cron de teste na slice grava no R2 pelo helper; o PostGIS responde pelo túnel; existe um backup diário no R2; `estado/chaves.md` mostra todas as chaves OK; o deploy sai sozinho do merge na `main`; os containers dos outros projetos da slice continuam iguais.

- **S0.1**
  - [#1](https://github.com/leonardomenezes8500/manaus/issues/1) Esqueleto do monorepo (TS + Jest)
  - [#2](https://github.com/leonardomenezes8500/manaus/issues/2) Formato do catálogo de fontes + cards das já verificadas
  - [#3](https://github.com/leonardomenezes8500/manaus/issues/3) Bruto imutável no R2 + helper `baixar()`
  - [#4](https://github.com/leonardomenezes8500/manaus/issues/4) Slice + CI/CD: compose, Actions → GHCR → deploy por SSH, cron e `.env`
  - [#5](https://github.com/leonardomenezes8500/manaus/issues/5) Postgres + PostGIS em container na slice, migrações, backup no R2
  - [#6](https://github.com/leonardomenezes8500/manaus/issues/6) Verificador de chaves (`estado/chaves.md`)
  - [#7](https://github.com/leonardomenezes8500/manaus/issues/7) Lembrete: renovar token Earthdata até 2026-12-10 (não bloqueia o sprint)

## [M1](https://github.com/leonardomenezes8500/manaus/milestone/2) — Fumaça v0: "De onde veio a fumaça de hoje?" (2 sprints)
**Objetivo:** todo dia sai um relatório curto com mapa dizendo de quais municípios a fumaça provavelmente veio, com PM2.5 medido e de modelo.
**Pronto quando:** relatório e mapa saem sozinhos por 7 dias seguidos; a temporada 2026 (desde 01/08) está reprocessada; a saúde da coleta não mostra atraso; o primeiro problema está em `pesquisa/` com evidência.

- **S1.1 — A coleta começa** (base mínima + coletores contínuos)
  - [#8](https://github.com/leonardomenezes8500/manaus/issues/8) Base mínima: municípios (IBGE) e região de influência
  - [#9](https://github.com/leonardomenezes8500/manaus/issues/9) Coletor NASA FIRMS (focos) + histórico desde 01/08
  - [#10](https://github.com/leonardomenezes8500/manaus/issues/10) Coletor OpenAQ (sensor do Centro) + histórico
  - [#11](https://github.com/leonardomenezes8500/manaus/issues/11) Coletor METAR SBEG/SBMN + histórico IEM; testar INMET
  - [#12](https://github.com/leonardomenezes8500/manaus/issues/12) Coletor Open-Meteo (vento em altitude + CAMS)
  - [#13](https://github.com/leonardomenezes8500/manaus/issues/13) Pesquisa: sensores de solo reais em Manaus (prioridade)
- **S1.2 — Banco, atribuição e relatório**
  - [#14](https://github.com/leonardomenezes8500/manaus/issues/14) Coletor INPE Queimadas (focos oficiais)
  - [#15](https://github.com/leonardomenezes8500/manaus/issues/15) Carga no banco: focos FIRMS e INPE
  - [#16](https://github.com/leonardomenezes8500/manaus/issues/16) Carga no banco: OpenAQ, METAR, Open-Meteo
  - [#17](https://github.com/leonardomenezes8500/manaus/issues/17) Atribuição v0 (heurística de vento)
  - [#18](https://github.com/leonardomenezes8500/manaus/issues/18) Relatório diário + mapa + temporada 2026
  - [#19](https://github.com/leonardomenezes8500/manaus/issues/19) Saúde da coleta (`estado/saude.md`)
  - [#20](https://github.com/leonardomenezes8500/manaus/issues/20) Formato de `pesquisa/` + primeiros problemas

## [M1.5](https://github.com/leonardomenezes8500/manaus/milestone/9) — Normalização do projeto (depois do M1, antes do M2)
- [#39](https://github.com/leonardomenezes8500/manaus/issues/39) `.editorconfig`, `.nvmrc`, eslint, prettier, `.env.example`, `compose.yaml` de dev e um `npm run check` só (pre-commit e CI)

## [M2](https://github.com/leonardomenezes8500/manaus/milestone/3) — Base territorial, fusão e API v0 (3 sprints)
**Objetivo:** Manaus no PostGIS com várias fontes lado a lado, a 3ª camada (entidades com proveniência) e a primeira API local.
**Pronto quando:** `GET /bairros/:id` mostra o que cada fonte diz e qual venceu pela regra; `GET /onde?lat=&lon=` devolve município, bairro, setor, altitude, cobertura do solo e área protegida; os testes Jest passam.

- **S2.1 — IBGE, OSM e bairros**
  - [#21](https://github.com/leonardomenezes8500/manaus/issues/21) IBGE: setores censitários 2022 + população
  - [#22](https://github.com/leonardomenezes8500/manaus/issues/22) IBGE: CNEFE (endereços com coordenada)
  - [#23](https://github.com/leonardomenezes8500/manaus/issues/23) OSM: extrato "norte" semanal + carga de Manaus
  - [#24](https://github.com/leonardomenezes8500/manaus/issues/24) Bairros oficiais (Prefeitura/IMPLURB) e IBGE
  - [#25](https://github.com/leonardomenezes8500/manaus/issues/25) Inventário amplo de fontes candidatas
- **S2.2 — Camadas físicas e ambientais**
  - [#26](https://github.com/leonardomenezes8500/manaus/issues/26) Edificações: Overture + Google Open Buildings
  - [#27](https://github.com/leonardomenezes8500/manaus/issues/27) MapBiomas: cobertura do solo 1985→hoje
  - [#28](https://github.com/leonardomenezes8500/manaus/issues/28) Relevo: ANADEM + Copernicus DEM
  - [#29](https://github.com/leonardomenezes8500/manaus/issues/29) ANA: cota do Rio Negro (desde 1902) + hidrografia
  - [#30](https://github.com/leonardomenezes8500/manaus/issues/30) Terras indígenas e unidades de conservação
- **S2.3 — Fusão e API v0**
  - [#31](https://github.com/leonardomenezes8500/manaus/issues/31) Modelo de fusão (camada 3)
  - [#32](https://github.com/leonardomenezes8500/manaus/issues/32) Fusão de municípios e bairros + divergências
  - [#33](https://github.com/leonardomenezes8500/manaus/issues/33) BrasilAPI CEP/CNPJ com cache
  - [#34](https://github.com/leonardomenezes8500/manaus/issues/34) API v0 (TS, local)

## [M3](https://github.com/leonardomenezes8500/manaus/milestone/4) — Fumaça v1: trajetórias e mais evidência (2 sprints)
**Objetivo:** trocar a heurística por retrotrajetória, medir a fumaça por satélite e montar a série histórica.
**Pronto quando:** a atribuição diária usa trajetórias; v0 e v1 foram comparadas nos dias com FU no METAR; existe a série 2012–2026 de fumaça × focos × seca.

- **S3.1 — Trajetórias**
  - [#47](https://github.com/leonardomenezes8500/manaus/issues/47) ERA5 (CDS): vento em níveis de pressão na região, todo dia + histórico desde 29/07
  - [#48](https://github.com/leonardomenezes8500/manaus/issues/48) GFS 0,5° (NOMADS) recortado: o vento dos últimos dias, 4x por dia
  - [#49](https://github.com/leonardomenezes8500/manaus/issues/49) Retrotrajetórias em TS: leitor de vento, integrador e trajetórias do dia no banco
  - [#50](https://github.com/leonardomenezes8500/manaus/issues/50) Atribuição v1: focos perto da trajetória, no relatório e no mapa
  - [#51](https://github.com/leonardomenezes8500/manaus/issues/51) Comparar v0 e v1 nos dias com fumaça (FU) no METAR, temporada 2026
- **S3.2 — Evidência e histórico**
  - [#40](https://github.com/leonardomenezes8500/manaus/issues/40) Coletor MonitorAr: estação de referência FioAres (Manaus), de hora em hora
  - ~~#41 Coletor PurpleAir~~: foi para o M4 sem a decisão do usuário.
  - [#52](https://github.com/leonardomenezes8500/manaus/issues/52) Arquivo FIRMS (SP) desde 2012: focos por dia de Manaus, sem carregar 14 anos no banco
  - [#53](https://github.com/leonardomenezes8500/manaus/issues/53) Coletor AERONET (ATTO e Manaus_EMBRAPA): aerossol medido do chão, diário + histórico
  - [#54](https://github.com/leonardomenezes8500/manaus/issues/54) MAIAC MCD19A2: AOD de satélite (1 km) em Manaus e no ATTO, 2012–2026
  - [#55](https://github.com/leonardomenezes8500/manaus/issues/55) Série 2012–2026: fumaça (FU/HZ, visibilidade, AOD) × focos × cota do Rio Negro
- **Depois do merge:** [#57](https://github.com/leonardomenezes8500/manaus/issues/57) (conferência no padrão da #44): 24 h de cron de GFS, ERA5, AERONET e FioAres; o ERA5 de setembro e outubro e a temporada inteira refeita com ele (v1 e comparação v0 × v1); um dia da v1 que saiu com GFS e foi refeito com ERA5 sem mão humana; as análises no banco de produção; começa a contar as 2 semanas de FioAres da #42.

**Decisões do M3 (2026-10-22, provisórias; o usuário pode mudar):**
- **Trajetória com integrador próprio em TS**, testado com Jest. O HYSPLIT confere 3 dias, uma vez, neste PC. Motivo: ele só lê vento no formato ARL da NOAA (a conversão é em Fortran, ou seriam arquivos globais de centenas de MB por semana), a licença não é declarada e não dá para testar.
- **Vento:** GFS 0,5° nos últimos dias (provisório) e ERA5 no histórico e na versão final, que chega uns 5 dias depois; aí a v1 do dia é refeita. Os dois usam a mesma grade (0,5°, de 3 em 3 h, 1000–700 hPa, caixa da região) e o mesmo código. Juntos, ~0,4 GB/ano no R2.
- As trajetórias saem a 950, 900 e 850 hPa (mais ou menos 500, 1000 e 1500 m), para não precisar do geopotencial.
- **Aerossol:** AERONET (medido do chão, diário) + MAIAC (satélite, rodado neste PC para a série). GOES-19 e Sentinel-5P saem do M3: trazem formatos novos (netCDF/HDF5), o GOES-19 só tem dado desde 2025 e o Sentinel-5P dependia da conta Copernicus. Entram na triagem do `IDEIAS.md` no fim do S3.2.
- **Área queimada** (MCD64A1, MapBiomas Fogo, INPE AQ1km) vai para o M4/S4.1. A série do M3 usa focos e FRP por dia; área queimada é mensal e serve para cruzar com imóveis.
- **Focos de 2012 em diante:** VIIRS S-NPP (o mesmo sensor no período todo) e MODIS para conferir, bruto em gzip. Os 14 anos não entram em `firms.foco` (seriam uns 5 milhões de linhas no banco da slice e no backup diário); só os totais por dia.
- A comparação v0 × v1 usa a temporada 2026 (20 dias com FU até 22/10). 2023 e 2024 (33 e 27 dias) ficam para depois, se precisar.
- [#42](https://github.com/leonardomenezes8500/manaus/issues/42) (calibrar sensores baratos com a FioAres) foi para o M4: precisa de 2 semanas de horas da FioAres, e a coleta só começa na slice com o merge do M3.
- **R2:** o M3 soma ~0,6 GB no primeiro ano (ERA5 0,24; GFS 0,15; arquivo FIRMS 0,14; o resto é pequeno). O uso vai de ~5,3 para ~6 GB dos 10 grátis.

## [M3.5](https://github.com/leonardomenezes8500/manaus/milestone/10) — Camada de contexto da cidade (2 sprints)
**Objetivo:** uma camada de contexto da cidade que serve para qualquer cruzamento, não só para a fumaça: calendário oficial, população detalhada e cidade básica (gasto, contratos, água, energia). Não abre problema novo. Nada é coletado sem hipótese escrita antes, e os cruzamentos seguem um método escrito.
**Pronto quando:** o método e o registro de hipóteses existem e um teste barra fonte nova sem hipótese; `contexto.dia` cobre 1994–2026 com fonte oficial em cada linha; idade, sexo, cor ou raça e alfabetização estão por setor, com a série anual de população; gasto por função, contratos, água e energia de Manaus estão no banco; as rodadas 1 e 2 de cruzamentos saíram, cada hipótese com grau de confiança.

- **S3.5.1 — Método, calendário e população**
  - [#59](https://github.com/leonardomenezes8500/manaus/issues/59) Método para cruzar variáveis: hipótese escrita antes de coletar, registro de hipóteses e teste que barra fonte sem hipótese (vem antes de todas)
  - [#60](https://github.com/leonardomenezes8500/manaus/issues/60) Calendário oficial (1): feriados, pontos facultativos, eleições e festas, com `contexto.dia` e `/contexto/:dia`
  - [#61](https://github.com/leonardomenezes8500/manaus/issues/61) Calendário oficial (2): escola (SEDUC, SEMED) e esportes (FIFA, COI, CBF, FAF)
  - [#62](https://github.com/leonardomenezes8500/manaus/issues/62) Calendário oficial (3): proibição do fogo, roça, cheia e seca
  - [#63](https://github.com/leonardomenezes8500/manaus/issues/63) População detalhada: idade, sexo, cor ou raça e alfabetização por setor (Censo 2022) + série anual por município
  - [#64](https://github.com/leonardomenezes8500/manaus/issues/64) Rodada 1 de cruzamentos: as hipóteses do calendário e da população, pelo método
- **S3.5.2 — Cidade básica** (cada fonte com a hipótese já escrita na #59):
  - [#65](https://github.com/leonardomenezes8500/manaus/issues/65) Gasto por setor: SICONFI (despesa por função e subfunção da Prefeitura e do Estado, desde 2015), com IPCA
  - [#66](https://github.com/leonardomenezes8500/manaus/issues/66) Contratos e licitações: PNCP (Manaus, todas as esferas, desde 2021), com coleta diária leve na slice. O Querido Diário está fora do ar (erro 500) desde 2026-10-22; TCE-AM e portais de transparência só se uma hipótese pedir.
  - [#67](https://github.com/leonardomenezes8500/manaus/issues/67) Água e esgoto: Censo 2022 por setor (domicílio), SISAGUA de Manaus e SINISA
  - [#68](https://github.com/leonardomenezes8500/manaus/issues/68) Energia: DEC/FEC da ANEEL dos conjuntos de Manaus e a tarifa residencial
  - [#69](https://github.com/leonardomenezes8500/manaus/issues/69) Rodada 2 de cruzamentos, com o mesmo método e a mesma correção

**Decisões do M3.5 (2026-10-22, provisórias; o usuário pode mudar):**
- **Antes do M4.** O método vem antes de qualquer cruzamento novo, inclusive internações × fumaça no M4. Gasto e contratos são coletados uma vez aqui, para todos os setores, e o S4.3 só filtra os órgãos do fogo. A população por idade e o calendário escolar servem ao S4.3 e ao M5. Enquanto isso, a FioAres junta as 2 semanas de dados que a #42 precisa.
- **O método é o portão do escopo:** sem hipótese escrita, a fonte não entra. É isso que segura o milestone em 2 sprints. Páginas sem exportação (TCE-AM, portais de transparência, Águas de Manaus) ficam de fora até uma hipótese pedir.
- **Calendário só de fonte oficial.** Data que vem de lei sai de código testado; data que só existe no documento do ano fica num CSV no repo, com o link do documento, que vai para o bruto. Ano sem documento fica vazio, nunca estimado.
- **População:** setores do AM, como o básico (só Manaus, se passar de ~1 milhão de linhas no banco). Em 2026-10-22 o IBGE ainda não publicou renda por setor; até lá, a do município. Projeção por idade só existe por estado.
- **Muitas comparações:** Benjamini–Hochberg por rodada (S3.5.1 = rodada 1, S3.5.2 = rodada 2), por isso cada sprint fecha com uma issue de rodada.
- **Custo:** quase tudo é carga anual ou única, rodada neste PC. Na slice, só o PNCP diário, que é leve. R2: ~0,2 GB no S3.5.1 (Censo) e ~0,3 GB no S3.5.2 (Censo domicílio, PNCP em gzip, SISAGUA só do AM). O uso vai de ~6 para ~6,5 GB dos 10 grátis.

## [M4](https://github.com/leonardomenezes8500/manaus/milestone/5) — Fumaça v2: do fogo ao responsável (3 sprints)
**Objetivo:** para cada foco relevante, dizer onde ele caiu (desmatamento, imóvel, área protegida), quem é o dono ou responsável, qual o efeito na saúde e quem deveria agir e quanto gastou.
**Pronto quando:** existe o relatório "cadeia completa" de um dia (dia → focos → áreas/imóveis → embargos/autos → internações → órgãos e gastos), com fonte em cada elo.

- **S4.1 — Onde queimou** (cada fonte com a hipótese escrita na #72 antes de coletar):
  - [#72](https://github.com/leonardomenezes8500/manaus/issues/72) Hipóteses do S4.1 (rodada 3) antes de coletar: desmatamento, florestas públicas, áreas protegidas, área queimada e a proibição do IPAAM antes e depois de 2010 (vem antes de todas)
  - [#73](https://github.com/leonardomenezes8500/manaus/issues/73) Backup diário sem os dados que se refazem do bruto, antes das camadas grandes (vem do `IDEIAS.md`)
  - [#74](https://github.com/leonardomenezes8500/manaus/issues/74) Desmatamento do INPE: DETER (alertas desde 2016, coleta semanal leve na slice) e PRODES (mapa anual em COG, fora do PostGIS)
  - [#75](https://github.com/leonardomenezes8500/manaus/issues/75) Florestas públicas: CNFP 2025 do SFB na região e a conferência com TIs e UCs (#30)
  - [#76](https://github.com/leonardomenezes8500/manaus/issues/76) Área queimada por mês: MapBiomas Fogo (30 m) e INPE AQ1km (1 km), no anel de 800 km e por estado; MCD64A1 fica no backlog
  - [#77](https://github.com/leonardomenezes8500/manaus/issues/77) Onde caiu cada foco: estado, TI, UC, floresta pública, PRODES e DETER, no arquivo FIRMS desde 2001 (focos por estado da #64) e nos focos da v1 de cada dia
  - [#78](https://github.com/leonardomenezes8500/manaus/issues/78) Rodada 3 de cruzamentos, com o mesmo método e a mesma correção
- **S4.2 — De quem é** (issues criadas em 2026-10-23; cada fonte testada com uma requisição real):
  - [#56](https://github.com/leonardomenezes8500/manaus/issues/56) Crescer a caixa da região para leste (vem do M3; vai primeiro). Só a caixa do vento e do FIRMS cresce; as camadas de terra ficam na caixa atual
  - [#79](https://github.com/leonardomenezes8500/manaus/issues/79) Hipóteses do S4.2 (rodada 4), antes de coletar
  - [#80](https://github.com/leonardomenezes8500/manaus/issues/80) Terra certificada do INCRA: SIGEF, SNCI e assentamentos de AM, AC, RO e PA
  - [#81](https://github.com/leonardomenezes8500/manaus/issues/81) Embargos e autos de infração do IBAMA e do ICMBio na região
  - [#82](https://github.com/leonardomenezes8500/manaus/issues/82) MapBiomas Alerta pelo WFS público (sem token; a ligação com o CAR é feita aqui)
  - [#83](https://github.com/leonardomenezes8500/manaus/issues/83) CAR (SICAR) de AM, AC, RO e PA, cabendo no R2 (o download é à mão, pelo usuário: tem captcha)
  - [#84](https://github.com/leonardomenezes8500/manaus/issues/84) Onde caiu cada foco (2): imóvel do CAR, título do INCRA, embargo e alerta
  - [#85](https://github.com/leonardomenezes8500/manaus/issues/85) Lista de imóveis com fogo recorrente que já foram embargados
  - [#86](https://github.com/leonardomenezes8500/manaus/issues/86) Rodada 4 de cruzamentos
- **S4.3 — Saúde e poder público:**
  - [#42](https://github.com/leonardomenezes8500/manaus/issues/42) Calibrar sensores baratos com a FioAres (vem do M3; a partir de ~05/11). [#41](https://github.com/leonardomenezes8500/manaus/issues/41) PurpleAir continua esperando a decisão do usuário
  - [#87](https://github.com/leonardomenezes8500/manaus/issues/87) Hipóteses do S4.3 (rodada 5), antes de coletar
  - [#88](https://github.com/leonardomenezes8500/manaus/issues/88) Internações e óbitos: SIH e SIM do DATASUS, moradores de Manaus, desde 2012
  - [#89](https://github.com/leonardomenezes8500/manaus/issues/89) PM2,5 modelado do CAMS (EAC4) em Manaus, no lugar do SISAM
  - [#90](https://github.com/leonardomenezes8500/manaus/issues/90) Gasto federal do fogo: Portal da Transparência, desde 2014
  - [#91](https://github.com/leonardomenezes8500/manaus/issues/91) Quem deveria agir: órgão responsável por tipo de área, com a lei, e os gastos e contratos de cada órgão
  - [#92](https://github.com/leonardomenezes8500/manaus/issues/92) Rodada 5 de cruzamentos
  - [#93](https://github.com/leonardomenezes8500/manaus/issues/93) Relatório "cadeia completa" de um dia e a rota `/cadeia/:dia`
  - [#94](https://github.com/leonardomenezes8500/manaus/issues/94) Conferência pós-merge do M4
- Toda fonte nova do M4 entra com hipótese escrita (portão da #59).

**Decisões do S4.1 (2026-10-23, provisórias; o usuário pode mudar):**
- **R2 mais cheio do que se pensava:** 6,95 GiB em 23/10, e o backup diário tem 103 MB (14 dias = ~1,4 GB). A #73 tira do backup o que se refaz do bruto. O S4.1 soma ~0,5 a 0,65 GB e termina perto de 8,5 a 9 GB. O CAR do S4.2 não cabe nos 10 GB grátis: aí o usuário decide se paga (~US$ 0,015 por GB por mês acima de 10 GB). Conferir a regra de 14 dias do `backup/pg/` contando os dumps a partir de 05/11.
- MapBiomas Alerta vai para o S4.2; MCD64A1 vai para o backlog (o AQ1km já dá a segunda visão, mais leve).
- PRODES em COG fora do PostGIS; MapBiomas Fogo não é guardado, só os totais. CNFP só na edição 2025.
- DETER com cron semanal na slice; AQ1km à mão uma vez por mês.
- Rodadas: 3 = S4.1, 4 = S4.2, 5 = S4.3. Todas as camadas usam a caixa atual da região.

**Decisões do S4.2 e S4.3 (2026-10-23, provisórias; Em aberto para o usuário):**
- **Backup:** em 23/10 o dump diário de produção foi a 451 MB (as cargas do M3.5) e o R2 a 8,07 GiB. A #73 saiu antes do M4, no PR [#95](https://github.com/leonardomenezes8500/manaus/pull/95), para o R2 não passar dos 10 GB em ~4 dias.
- **CAR no R2:** só a parte dentro da caixa, geometria intacta, em FlatGeobuf com gzip (como o CNFP). Se o total passar de 9,5 GB, primeiro recomprimir os 2 COGs de relevo (2,36 GiB) com LERC (erro máximo de 1 cm, economia de ~1 a 1,5 GB). Pagar o excedente (~US$ 0,015 por GB por mês) ou guardar o backup por 7 dias em vez de 14 é decisão do usuário.
- **Dados pessoais:** o banco guarda o que o IBAMA e o ICMBio publicam; produtos e relatórios mostram nome só de empresa, e pessoa física pelo número do auto. Mostrar nome de pessoa física fica em aberto.
- **SISAM** trocado pelo CAMS EAC4 (mesmo modelo; o SISAM só exporta por e-mail). Portais de transparência do AM e de Manaus ficam de fora (pedem token ou sessão): o gasto estadual e municipal vem do SICONFI por subfunção e as compras de cada órgão do PNCP.
- **Achados do M4 (2026-10-23):** o gasto federal do fogo quase nunca vem com o estado no localizador (em 2024, R$ 3,5 mil com AM contra R$ 500 milhões "nacional"), então a `gasto-federal-fogo-reativo` ficou sem teste. Na rodada 5, a fumaça não aparece nas internações nem nos óbitos dos dias seguintes depois de comparar cada dia com o próprio ano (a primeira versão confundia a tendência dos anos com efeito, achado da revisão); a volta às aulas de fevereiro aparece nas internações de crianças. A caixa do vento até −44 (#56) faz 59% das trajetórias chegarem às 72 h (eram 19%).
- SIH, SIM, embargos e alertas atualizados à mão neste PC; cron mensal ou semanal na slice fica em aberto. O dia de exemplo da cadeia completa é 17/10/2026: agosto de 2026 não teve nenhum dia com FU, e 17/10 é o dia com FU e mais focos na v1 (as internações dele saem em dezembro).

## [M5](https://github.com/leonardomenezes8500/manaus/milestone/6) — Pesquisa: problemas e soluções da fumaça (2 sprints)
**Objetivo:** ter a lista de problemas com evidência e a lista de soluções propostas, avaliadas com critério escrito.
**Pronto quando:** cada solução tem classificação (prática / paliativa / especulativa), quem se beneficia e quais recursos e dados existentes a sustentam.

- **S5.1:** levantar problemas e soluções já propostas (governo, MP, academia, ONGs, imprensa), cada uma com fonte.
- **S5.2:** avaliar com os dados do M1–M4. Na cidade: alerta diário (CAMS + sensores) e salas de ar limpo em escolas (INEP/CNEFE) e UBS (CNES), por ordem de exposição (população por idade da #63).

## [M6](https://github.com/leonardomenezes8500/manaus/milestone/7) — API pública v1 (2 sprints)
- Documentação OpenAPI, versão e limite de uso; licença de cada fonte respeitada (OSM é ODbL: exige atribuição e compartilhamento); revisão de segurança; R2 para servir o bruto público; decidir onde hospedar.

## [M7](https://github.com/leonardomenezes8500/manaus/milestone/8) — Simulador 3D v0 (2–3 sprints)
- Fusão de edificações (OSM × Overture × Open Buildings), terreno (DEM), rios e cota; fumaça animada (focos + trajetórias + PM2.5) no navegador.

## Backlog
Temas futuros e ideias soltas ficam em `IDEIAS.md` e só entram aqui na triagem entre sprints.
