---
id: cmm-manaus
nome: Câmara Municipal de Manaus (SAPL, leis municipais)
publicador: CMM
url: https://sapl.cmm.am.gov.br/
acesso: api
chave: nenhuma
atualizacao: contínua
cobertura: Manaus; leis, decretos e projetos de lei desde 1948, com o PDF do texto (9.846 normas em 2026-10-21)
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://sapl.cmm.am.gov.br/api/norma/normajuridica/?ementa__icontains=bairros&page_size=50"'
---
- Tema: quem deveria agir e território. Leis municipais (ex.: monitoramento do ar) e quem votou. A API do SAPL aceita filtros Django (`ementa__icontains`, `numero`, `ano`).
- Bairros (#24): a Lei 1.401/2010 cria e delimita os bairros, e a Lei 3.592/2025 cria o bairro Colônia Japonesa e muda os limites do Parque 10 de Novembro e do Novo Aleixo. Os limites estão só em texto, sem mapa. Os dois PDFs estão no bruto (`coleta/bairros.ts`) para conferir as fontes com mapa na fusão (#32).
