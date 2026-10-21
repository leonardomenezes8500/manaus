---
id: inmet
nome: INMET (estações automáticas, A101 Manaus)
publicador: Instituto Nacional de Meteorologia
url: https://portal.inmet.gov.br/dadoshistoricos
acesso: api
chave: nenhuma
atualizacao: horária
cobertura: Brasil; A101 Manaus desde 2000
licenca: dados públicos do governo federal
tipo: medicao-solo
confiabilidade: alta
status: candidata
---
- Testado em 2026-10-21 (#11): `apitempo.inmet.gov.br`, `portal.inmet.gov.br` (download anual em `/uploads/dadoshistoricos/AAAA.zip`) e `tempo.inmet.gov.br` derrubam a conexão (TCP reset) tanto deste PC quanto da VPS, enquanto `www.gov.br` responde. Parece bloqueio de IP do INMET (fora do Brasil ou de datacenter), não falta de chave.
- Próximo passo: testar de uma rede residencial brasileira ou pedir acesso ao INMET. Por ora o vento de superfície vem do METAR (SBEG/SBMN).
