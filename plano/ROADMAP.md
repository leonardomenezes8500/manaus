# Roadmap — REA de Manaus

**Sprint atual: S3.1** (M3; o M2 foi mergeado no PR #46). Atualizar ao fim de cada sprint, depois da triagem do `IDEIAS.md`.

Visão geral. O trabalho em si está no GitHub: [milestones](https://github.com/leonardomenezes8500/manaus/milestones) M0–M7, [issues](https://github.com/leonardomenezes8500/manaus/issues) com uma label por sprint (`S0.1`...). Sprint = ~1 semana de trabalho de agente. M0–M3 já têm issues; do M4 em diante são só linhas aqui, que viram issues quando chegar a vez.

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

## Em aberto (decisão do usuário)
- **(2026-10-21) Língua do código.** Código novo (identificadores e comentários) é em inglês; docs, issues e PRs em pt-BR. Renomear o código que já existe (`coleta/`, `db/migracoes/`, scripts `migrar`/`tipos`, funções e tabelas em português) espera o usuário. Até lá, nada existente é renomeado, e tabela nova segue o nome em português que a issue já fixou, para não misturar dentro do mesmo esquema.

## Pendências do usuário
- **R2:** criar o bucket e um token **só de leitura e escrita de objetos, só nesse bucket**; no bucket, a regra de ciclo de vida "apagar `backup/pg/` com mais de 14 dias" (o código nunca apaga nada no R2). Depois pôr `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET` no `.env` local e no GitHub com `gh secret set <NOME>` (o valor é digitado no prompt, nunca colado no chat). Bloqueia a [#3](https://github.com/leonardomenezes8500/manaus/issues/3) e o resto do M0.
- Renovar o token NASA Earthdata **até 2026-12-10**, porque ele expira em 2026-12-20 ([#7](https://github.com/leonardomenezes8500/manaus/issues/7)).
- **Earthdata, usuário e senha (M3, [#54](https://github.com/leonardomenezes8500/manaus/issues/54)):** pôr `EARTHDATA_USER` e `EARTHDATA_PASSWORD` no `.env` deste PC (só aqui, não vai para a slice nem para o GitHub). O AppEEARS, que dá a série do MAIAC num CSV pequeno, não aceita o token. Sem isso, o MAIAC fica só nos dias da comparação, e a série 2012–2026 sai sem ele.
- **PurpleAir ([#41](https://github.com/leonardomenezes8500/manaus/issues/41), foi para o M4 em 2026-10-22):** decidir entre pedir à UEA/EducAIR autorização para ler o mapa do SELVA e/ou criar uma chave da API PurpleAir (grátis no começo, depois paga por uso). Saiu do M3 sem decisão.
- Conta no Copernicus Data Space: não faz mais falta no M3, porque o Sentinel-5P saiu dele. Fica para quando ele voltar.
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

## [M4](https://github.com/leonardomenezes8500/manaus/milestone/5) — Fumaça v2: do fogo ao responsável (3 sprints)
**Objetivo:** para cada foco relevante, dizer onde ele caiu (desmatamento, imóvel, área protegida), quem é o dono ou responsável, qual o efeito na saúde e quem deveria agir e quanto gastou.
**Pronto quando:** existe o relatório "cadeia completa" de um dia (dia → focos → áreas/imóveis → embargos/autos → internações → órgãos e gastos), com fonte em cada elo.

- **S4.1 — Onde queimou:** PRODES e DETER (TerraBrasilis), MapBiomas Alerta, florestas públicas (CNFP/SFB); cruzar com TIs e UCs (039). Área queimada vinda do M3: MapBiomas Fogo primeiro (menos trabalho), depois MCD64A1 e INPE AQ1km.
- Vindas do M3: [#42](https://github.com/leonardomenezes8500/manaus/issues/42) Calibrar sensores baratos com a FioAres (só depois de 2 semanas de coleta da #40 na slice); [#41](https://github.com/leonardomenezes8500/manaus/issues/41) Coletor PurpleAir (espera a decisão do usuário); [#56](https://github.com/leonardomenezes8500/manaus/issues/56) Crescer a caixa da região para leste (as trajetórias param a 8° de Manaus).
- **S4.2 — De quem é:** CAR/SICAR (AM, RO, AC, PA), SIGEF/SNCI (INCRA), embargos e autos de infração do IBAMA e do ICMBio. Sai a lista de imóveis com fogo recorrente que já foram embargados.
- **S4.3 — Saúde e poder público:** DATASUS SIH/SIM (respiratório, Manaus), SISAM; Portal da Transparência (Prevfogo, ICMBio, GLO), PNCP, transparência do AM (SEMA, IPAAM, CBMAM), Prefeitura. Fecha com o relatório "cadeia completa".

## [M5](https://github.com/leonardomenezes8500/manaus/milestone/6) — Pesquisa: problemas e soluções da fumaça (2 sprints)
**Objetivo:** ter a lista de problemas com evidência e a lista de soluções propostas, avaliadas com critério escrito.
**Pronto quando:** cada solução tem classificação (prática / paliativa / especulativa), quem se beneficia e quais recursos e dados existentes a sustentam.

- **S5.1:** levantar problemas e soluções já propostas (governo, MP, academia, ONGs, imprensa), cada uma com fonte.
- **S5.2:** avaliar com os dados do M1–M4. Na cidade: alerta diário (CAMS + sensores) e salas de ar limpo em escolas (INEP/CNEFE) e UBS (CNES), por ordem de exposição.

## [M6](https://github.com/leonardomenezes8500/manaus/milestone/7) — API pública v1 (2 sprints)
- Documentação OpenAPI, versão e limite de uso; licença de cada fonte respeitada (OSM é ODbL: exige atribuição e compartilhamento); revisão de segurança; R2 para servir o bruto público; decidir onde hospedar.

## [M7](https://github.com/leonardomenezes8500/manaus/milestone/8) — Simulador 3D v0 (2–3 sprints)
- Fusão de edificações (OSM × Overture × Open Buildings), terreno (DEM), rios e cota; fumaça animada (focos + trajetórias + PM2.5) no navegador.

## Backlog
Temas futuros e ideias soltas ficam em `IDEIAS.md` e só entram aqui na triagem entre sprints.
