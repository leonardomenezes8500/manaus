---
id: inpe-risco-fogo
nome: INPE Risco de Fogo (modelo, observado e previsto)
publicador: INPE (Programa Queimadas)
url: https://dataserver-coids.inpe.br/queimadas/queimadas/riscofogo_meteorologia/
acesso: download
chave: nenhuma
atualizacao: diária
cobertura: América do Sul; observado desde 2009 (pastas por ano)
licenca: dados públicos do governo federal (citar INPE)
tipo: modelo
confiabilidade: media
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSI "https://dataserver-coids.inpe.br/queimadas/queimadas/riscofogo_meteorologia/observado/risco_fogo/INPE_FireRiskModel_2.2_FireRisk_20261020.nc"'
---
- NetCDF diário (`INPE_FireRiskModel_2.2_FireRisk_AAAAMMDD.nc`), ~11,7 MB por dia. Também há dias sem chuva, precipitação, temperatura, umidade e `fumaca_aod469`.
- **Em aberto (#14):** coletar todo dia custa ~4,3 GB/ano no R2 (perto da metade da cota grátis de 10 GB). Por ora não coleta; o CSV de focos já traz o `risco_fogo` de cada foco. Decisão do usuário.
