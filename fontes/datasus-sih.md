---
id: datasus-sih
nome: DATASUS SIH/SUS (internações hospitalares)
publicador: Ministério da Saúde (DATASUS)
url: ftp://ftp.datasus.gov.br/dissemin/publicos/SIHSUS/200801_/Dados/
acesso: download
chave: nenhuma
atualizacao: mensal (com atraso de ~2 meses)
cobertura: Brasil, por UF e mês, desde 2008 (arquivos RDAMaamm.dbc para o AM)
licenca: dados públicos do SUS (licença não declarada)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS --list-only "ftp://ftp.datasus.gov.br/dissemin/publicos/SIHSUS/200801_/Dados/"'
---
- Tema: saúde e fumaça. Cada internação do SUS com CID, município de residência e data: serve para ligar internações respiratórias aos dias de fumaça.
- O teste listou a pasta; o mais novo do AM era RDAM2608.dbc (agosto de 2026). Formato .dbc (DBF comprimido), precisa de conversor.
