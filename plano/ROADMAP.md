# Roadmap — REA de Manaus

**Sprint atual: M2 em revisão (PR aberto).** Próximo: S3.1, cujas issues ainda vão ser criadas (atualizar ao fim de cada sprint, depois da triagem do `IDEIAS.md`)

Visão geral. O trabalho em si está no GitHub: [milestones](https://github.com/leonardomenezes8500/manaus/milestones) M0–M7, [issues](https://github.com/leonardomenezes8500/manaus/issues) com uma label por sprint (`S0.1`...). Sprint = ~1 semana de trabalho de agente. M0–M2 já têm issues; do M3 em diante são só linhas aqui, que viram issues quando chegar a vez.

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
- Criar conta no Copernicus Data Space (o site estava fora do ar). Só faz falta no M3, se o Sentinel-5P não vier pela NASA.
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
  - ERA5 (CDS): vento por nível de pressão na região. Coleta diária (atraso de ~5 dias) + histórico.
  - GFS 0,25° (NOAA NOMADS, recortado) para o dia corrente.
  - Retrotrajetórias saindo de Manaus (500/1000/1500 m, 72 h). Decidir entre HYSPLIT offline e um integrador próprio em TS com testes.
  - Atribuição v1 (focos perto da trajetória, pesados por FRP e tempo) substitui a v0 no relatório.
- **S3.2 — Evidência e histórico**
  - Aerossol por satélite: MAIAC MCD19A2 (Earthdata), GOES-19 AOD (AWS, sem chave), Sentinel-5P CO/índice de aerossol.
  - Área queimada: MCD64A1, MapBiomas Fogo, INPE AQ1km.
  - Coletores dos sensores de solo achados na 015.
  - Arquivo FIRMS (SP) desde 2012 e série histórica: dias com FU/HZ × focos × cota do Rio Negro.

## [M4](https://github.com/leonardomenezes8500/manaus/milestone/5) — Fumaça v2: do fogo ao responsável (3 sprints)
**Objetivo:** para cada foco relevante, dizer onde ele caiu (desmatamento, imóvel, área protegida), quem é o dono ou responsável, qual o efeito na saúde e quem deveria agir e quanto gastou.
**Pronto quando:** existe o relatório "cadeia completa" de um dia (dia → focos → áreas/imóveis → embargos/autos → internações → órgãos e gastos), com fonte em cada elo.

- **S4.1 — Onde queimou:** PRODES e DETER (TerraBrasilis), MapBiomas Alerta, florestas públicas (CNFP/SFB); cruzar com TIs e UCs (039).
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
