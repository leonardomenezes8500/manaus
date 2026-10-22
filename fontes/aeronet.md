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
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://aeronet.gsfc.nasa.gov/cgi-bin/print_web_data_v3?site=ATTO-Campina&year=2026&month=9&day=1&year2=2026&month2=10&day2=21&AOD15=1&AVG=20&if_no_html=1"'
---
- Tema: fumaça. AOD medida do chão (fotômetro), padrão de referência para conferir satélite e modelo; ATTO fica ~150 km a nordeste de Manaus.
- O teste devolveu AOD diária do ATTO-Campina de 31/08 a 21/10/2026 (nível 1.5). Os sites Manaus e Manaus_EMBRAPA vieram vazios em 2024 a 2026.
