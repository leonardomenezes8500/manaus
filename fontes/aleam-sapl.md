---
id: aleam-sapl
nome: Assembleia Legislativa do Amazonas (SAPL, legislação estadual)
publicador: ALEAM
url: https://sapl.al.am.leg.br/
acesso: pagina
chave: nenhuma
atualizacao: quando sai lei nova
cobertura: Amazonas, leis estaduais
licenca: texto de lei (domínio público)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-22
teste: 'curl -sS -L "https://sapl.al.am.leg.br/norma/2038"'
---
- O teste devolveu a ficha da Lei estadual 25/1977 (feriado de 5 de setembro). O texto integral dessa lei não está digitalizado: só a ficha com a ementa.
- O SAPL tem API (`/api/norma/normajuridica/`), como o da Câmara de Manaus (`cmm-manaus`).
