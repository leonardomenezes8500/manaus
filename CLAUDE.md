# REA de Manaus

Engenharia reversa de Manaus (AM) com dados públicos confiáveis e atualizados: juntar as fontes, normalizar (Manaus como API: Postgres/PostGIS + TypeScript + Jest), guardar problemas e soluções com evidência e separar o que é prático do que é paliativo ou especulativo.
Mais tarde: uma Manaus 3D simplificada no navegador, ligando todas as camadas.
Foco atual: **fumaça**. "De onde veio a fumaça de hoje?" = focos × vento × PM2.5, e depois desmatamento, donos, saúde e quem deveria agir.

## Leia primeiro
- `plano/COMO-TRABALHAR.md`: fluxo e regras. **Um PR por milestone** (uma branch por milestone, um commit por issue com `Closes #N`); antes de cada commit, rodar aqui tudo que o CI roda; milestone pronto = PR aberto com CI verde + resumo por issue e riscos, e parar: **o merge é do usuário**.
- `plano/ROADMAP.md`: visão geral, decisões e pendências do usuário, com links para as milestones e issues.
- Issues e sprints no GitHub (`leonardomenezes8500/manaus`): milestones M0–M7, uma label por sprint (`S0.1`...). `gh issue list --label S0.1`.
- `plano/IDEIAS.md`: caixa de entrada de ideias (não mexe no sprint atual).
- `estado/saude.md` (coletores) e `estado/chaves.md` (chaves), no R2: `rclone cat r2:$R2_BUCKET/estado/saude.md`. Olhar no começo da sessão, quando já existirem.
- `CLAUDE.local.md` (fora do git): detalhes desta máquina e da VPS que não vão para o repo público.

## Pastas do repo (cada uma nasce com o primeiro arquivo real)
- `fontes/`: um card por fonte (catálogo). `coleta/`: coletores e cargas. `db/`: migrações (esquema compartilhado).
- `analise/`: cálculos derivados (ex.: atribuição da fumaça). `api/`: API TS. `pesquisa/`: problemas e soluções.
- `simulador/`: só no M7.

## Onde roda
- **Repo público.** Nada sensível no repo, nas issues ou nos comentários: nenhuma chave, e-mail, IP, usuário, host ou caminho da VPS. Isso fica no `.env` local, nos secrets/variables do Actions ou no `CLAUDE.local.md`.
- Coleta 24h: VPS `slice` (alias ssh; 1 CPU, ~3 GB de RAM livres), em Docker, projeto compose `manaus`. Ela divide espaço com produção de outros projetos: limite de CPU e memória em todo container, nada exposto (Postgres só em 127.0.0.1, acesso por túnel ssh) e nunca mexer em container, volume, rede ou proxy de outro projeto.
- Deploy: GitHub Actions (CI → imagem no GHCR → SSH na slice), com o `.env` de lá escrito a partir dos secrets. Nada de `schedule:` no Actions: a coleta periódica é o cron da slice.
- Dados: Cloudflare R2 (`R2_BUCKET`), com `bruto/`, `normalizado/`, `produtos/`, `estado/` e `backup/`. O disco da slice é só buffer/cache.
- Processamento pesado e ocasional (raster, relevo, reprocessar histórico): neste PC, sob demanda, lendo e gravando no R2. Nada contínuo depende dele.
- Chaves: `.env` local (direnv) e secrets do GitHub (`gh secret set`, valor pelo stdin). Nunca imprimir nem copiar os valores.

## Regras que não mudam
- Fonte só entra no catálogo depois de uma requisição real que funcionou.
- Bruto imutável e datado. Uma fonte nunca sobrescreve outra: 3 camadas (bruto → tabela por fonte → entidades com proveniência e regra de prioridade por campo).
- Medido ≠ modelado, sempre rotulado. UTC no banco; dia de Manaus (UTC−4) nos relatórios.
- A menor coisa que funciona por inteiro; Jest na lógica de verdade; commit ao fechar cada issue.
- Com o usuário: português simples e curto, porque ele não é de ler muito.
