---
id: sinisa
nome: SINISA (antigo SNIS, saneamento)
publicador: Ministério das Cidades
url: https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa
acesso: download
chave: nenhuma
atualizacao: anual
cobertura: Brasil, por município e prestador, desde 1995 (SNIS)
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: coletando
verificado_em: 2026-10-22
teste: 'curl -sS -A "Mozilla/5.0" -o /dev/null -w "%{http_code}" "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/SINISA_Resultados_Ref2024.zip"'
coleta: 365d
---
- Tema: água. Cobertura de água e esgoto, perdas e tarifa da Águas de Manaus por ano.
- O teste devolveu 200 (zip de 19 MB). Com o User-Agent padrão do curl o gov.br responde 403.
- Coleta (#67): os indicadores da base municipal de Manaus, água e esgoto, 2023 e 2024 (`coleta/sinisa.ts`; ano novo = linha nova na lista do script). O SNIS (até 2022) é outra série, com outra metodologia, e não entra junto.
