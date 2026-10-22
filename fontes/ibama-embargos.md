---
id: ibama-embargos
nome: IBAMA áreas embargadas
publicador: IBAMA (SIFISC)
url: https://dadosabertos.ibama.gov.br/dataset/fiscalizacao-termo-de-embargo
acesso: download
chave: nenhuma
atualizacao: irregular (o arquivo testado era de 2026-05-03)
cobertura: Brasil, todos os termos de embargo, com CPF/CNPJ e polígono quando há
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSI "https://dadosabertos.ibama.gov.br/dados/SIFISC/termo_embargo/termo_embargo/termo_embargo_csv.zip"'
---
- Tema: ambiente, donos e quem deveria agir. Áreas embargadas por desmatamento ou queimada ilegal, com autuado, município e geometria.
- O teste (HEAD) respondeu 200 com zip de 47 MB, modificado em 2026-05-03. Nome de pessoa física é dado pessoal: guardar com cuidado.
