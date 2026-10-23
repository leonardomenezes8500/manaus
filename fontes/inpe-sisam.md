---
id: inpe-sisam
nome: SISAM (Sistema de Informações Ambientais Integrado a Saúde)
publicador: INPE
url: https://terrabrasilis.dpi.inpe.br/queimadas/sisam/downloads
acesso: pagina
chave: nenhuma
atualizacao: reanálise com ~6 meses de atraso
cobertura: Brasil, por município, 2010 a 2025 (poluentes do CAMS e clima)
licenca: dados públicos do INPE (licença não declarada)
tipo: modelo
confiabilidade: media
status: candidata
---
- Tema: saúde e fumaça. É a reanálise do CAMS por município. A exportação (`/queimadas/sisam/downloads/api/export`) só manda o arquivo por e-mail: um pedido sem e-mail respondeu `{"error":"Campo 'email' obrigatório"}` (testado em 2026-10-23, #87). Os dados "calibrados" não incluem Manaus.
- Trocado pelo CAMS EAC4 direto do ADS do Copernicus (`ecmwf-ads`, #89), o mesmo modelo, com a chave que já existe.
