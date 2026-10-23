---
id: sfb-cnfp
nome: Cadastro Nacional de Florestas Públicas (CNFP)
publicador: Serviço Florestal Brasileiro (SFB)
url: https://dados.florestal.gov.br/dataset/cadastro-nacional-de-florestas-publicas-cnfp
acesso: download
chave: nenhuma
atualizacao: anual (edição 2025 publicada em junho de 2026)
cobertura: Brasil, florestas públicas federais, estaduais e municipais, edições desde 2007
licenca: CC BY 4.0
tipo: registro-oficial
confiabilidade: alta
status: coletando
verificado_em: 2026-10-23
teste: 'curl -sS -r 0-99 -o /dev/null -w "%{http_code} %{content_type}\n" "https://mapas.florestal.gov.br/portal/sharing/rest/content/items/2b752dfbf9254920bf8990ce363918af/data"'
coleta: 365d
---
- Tema: ambiente e fumaça. Polígonos de floresta pública com o tipo: A é destinada (TI, UC, assentamento, uso militar) e B não tem destinação (glebas arrecadadas, onde a grilagem costuma começar). Tem o ano de criação de cada área.
- O teste devolveu 206 e `application/zip`: o `CNFP_2025.zip` tem 229 MB e aceita pedido por faixa de bytes. Dentro, um shapefile PolygonZM em SIRGAS 2000 com 12.874 polígonos no país.
- O CKAN também tem um CSV por edição (`dadosabertos_snif_cnfp_2025_...csv`), só com os atributos, sem geometria.
- Coleta (#75): `coleta/cnfp.ts`. Em 2026-10-23, 2.598 polígonos tocam a caixa da região (82 MB em gzip no bruto, 110 MB no banco). AM 524 tipo A e 326 tipo B, AC 206 e 88, RO 305 e 88: iguais à contagem do shapefile nacional por estado. O `anocriacao` vem em vários formatos (1991-10-29, 24-04-2008) e vazio em 233 dos 850 polígonos do AM. Um polígono é cortado onde as destinações se sobrepõem (`TI / RESEX`).
