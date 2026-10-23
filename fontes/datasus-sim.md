---
id: datasus-sim
nome: DATASUS SIM (mortalidade)
publicador: Ministério da Saúde (DATASUS)
url: ftp://ftp.datasus.gov.br/dissemin/publicos/SIM/CID10/DORES/
acesso: download
chave: nenhuma
atualizacao: anual (preliminar antes)
cobertura: Brasil, por UF e ano, desde 1996
licenca: dados públicos do SUS (licença não declarada)
tipo: registro-oficial
confiabilidade: alta
status: coletando
coleta: 365d
verificado_em: 2026-10-23
teste: 'curl -s -r 0-31 "ftp://ftp.datasus.gov.br/dissemin/publicos/SIM/CID10/DORES/DOAM2024.dbc" | od -A d -t u1'
---
- Tema: saúde. Óbitos com causa (CID-10), idade e município: mortes por doença respiratória e cardiovascular.
- O teste leu os 32 bytes do cabeçalho do `DOAM2024.dbc`: DBF (byte 0 = 3) com 20.225 registros (bytes 4 a 7). De 1996 a 2024 em `SIM/CID10/DORES/` (30 MB do AM) e os preliminares de 2025 e 2026 em `SIM/PRELIM/DORES/`. Campos: `DTOBITO`, `DTNASC`, `IDADE`, `SEXO`, `CODMUNRES`, `LOCOCOR`, `CAUSABAS`.
- Coleta (#88): `coleta/datasus.ts`, junto com o SIH. Ano final e preliminar no bruto (o preliminar com `_prelim` no nome); quando o ano sai final, só ele conta. Totais por dia em `datasus.obito_dia`.
