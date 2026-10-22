---
id: aeronet
nome: AERONET (profundidade óptica do aerossol, fotômetro solar)
publicador: NASA GSFC (rede AERONET)
url: https://aeronet.gsfc.nasa.gov
acesso: api
chave: nenhuma
atualizacao: diária (nível 1.5 em quase tempo real; nível 2.0 depois da calibração)
cobertura: Amazônia Central; ATTO-Campina e Amazon_ATTO_Tower ativos em 2026; Manaus_EMBRAPA tem dados até cerca de 2020
licenca: livre com citação da rede e do responsável pelo site
tipo: medicao-solo
confiabilidade: alta
status: coletando
verificado_em: 2026-10-22
teste: 'curl -sS "https://aeronet.gsfc.nasa.gov/cgi-bin/print_web_data_v3?site=ATTO-Campina&year=2026&month=9&day=1&year2=2026&month2=10&day2=21&AOD15=1&AVG=20&if_no_html=1"'
coleta: 1d
---
- Tema: fumaça. AOD medida do chão (fotômetro), padrão de referência para conferir satélite e modelo; ATTO fica ~150 km a nordeste de Manaus.
- O teste devolveu AOD diária do ATTO-Campina de 31/08 a 21/10/2026 (nível 1.5). Os sites Manaus e Manaus_EMBRAPA vieram vazios em 2024 a 2026.
- Coleta (#53): `node coleta/aeronet.ts` (cron da slice, 1x/dia: últimos 7 dias do ATTO-Campina e do Amazon_ATTO_Tower, níveis 1.5 e 2.0) e `--history 2012` (uma vez, neste PC: um pedido por site, ano e nível) → `aeronet.aod_dia`; a visão `aeronet.aod_dia_melhor` prefere o 2.0 e diz qual nível usou.
- No banco (2026-10-22): Manaus_EMBRAPA 2012-01 a 2019-05 (903 dias); Amazon_ATTO_Tower 2016-02 a 2026-09 (1.942 dias no 1.5, 1.474 no 2.0); ATTO-Campina 2021-12 a hoje (831 dias). De 2019-06 a 2021-11 só o ATTO Tower.
- O cabeçalho do arquivo traz nome e e-mail do responsável pelo site: fica só no bruto (R2 privado), nunca no repo.
- Dias com FU no SBEG × AOD do ATTO (500 nm): 2024 (ago–nov) mediana 0,42 com FU e 0,33 sem; 2026 (desde agosto) 0,40 com FU e 0,22 sem. O Ångström também sobe nos dias com FU (1,50 × 1,42 em 2024; 1,16 × 0,97 em 2026). O ATTO fica a ~150 km de Manaus: bate na tendência, não dia a dia.
