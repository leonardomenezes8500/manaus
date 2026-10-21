---
id: metar-aviationweather
nome: METAR (NOAA Aviation Weather Center)
publicador: NOAA / Aviation Weather Center (dados do DECEA para aeroportos do Brasil)
url: https://aviationweather.gov/data/api/
acesso: api
chave: nenhuma
atualizacao: horária (METAR de hora em hora, SPECI quando muda)
cobertura: aeroportos do mundo; só os últimos dias pela API
licenca: domínio público (governo dos EUA); o dado original é do DECEA
tipo: medicao-solo
confiabilidade: alta
status: coletando
verificado_em: 2026-10-21
teste: 'curl -sS "https://aviationweather.gov/api/data/metar?ids=SBEG,SBMN&hours=3&format=raw"'
coleta: 1h
---
- SBEG = Eduardo Gomes (aeroporto internacional); SBMN = Ponta Pelada (base aérea). Vento, visibilidade e tempo presente (`FU` = fumaça, `HZ` = névoa seca).
- Coleta (#11): `coleta/metar.ts` de hora em hora, últimas 3 h (sobreposição de propósito; a duplicata sai na carga).
- O histórico vem do card `iem-asos`.
