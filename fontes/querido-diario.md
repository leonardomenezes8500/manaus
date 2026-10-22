---
id: querido-diario
nome: Querido Diário (diários oficiais municipais)
publicador: Open Knowledge Brasil
url: https://queridodiario.ok.org.br
acesso: api
chave: nenhuma
atualizacao: diária
cobertura: Manaus (1302603), desde 2016; 7.517 edições em 2026-10-21
licenca: atos públicos; código aberto (MIT)
tipo: colaborativo
confiabilidade: media
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSL "https://queridodiario.ok.org.br/api/gazettes?territory_ids=1302603&size=1"'
---
- Tema: orçamento e atos públicos. Texto do Diário Oficial de Manaus com busca por palavra (decretos de emergência, contratos, nomeações).
- O teste devolveu total_gazettes 7517 e o link do PDF e do TXT de cada edição. Precisa de -L (a URL redireciona). Confiabilidade média: raspagem, pode faltar edição.
