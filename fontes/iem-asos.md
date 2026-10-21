---
id: iem-asos
nome: Iowa Environmental Mesonet (arquivo ASOS/METAR)
publicador: Iowa State University (IEM)
url: https://mesonet.agron.iastate.edu/request/download.phtml?network=BR__ASOS
acesso: download
chave: nenhuma
atualizacao: horária (o arquivo recebe os METAR em tempo quase real)
cobertura: SBEG desde 1977-04-30, SBMN desde 1972-12-31 (archive_begin do IEM)
licenca: uso livre, citar o IEM
tipo: medicao-solo
confiabilidade: alta
status: coletando
verificado_em: 2026-10-21
teste: 'curl -sS "https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=SBEG&data=metar&year1=2025&month1=1&day1=1&year2=2026&month2=1&day2=1&tz=Etc/UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4"'
coleta: 365d
---
- Texto original do METAR (`station,valid,metar`), um arquivo por estação e ano: `node coleta/metar.ts --history [SBEG|SBMN] [ano]` (#11). Pausa de 2 s entre pedidos, como o IEM pede.
- A coleta contínua é pelo `metar-aviationweather`; o IEM serve para o histórico (rodar de novo no começo de cada ano para fechar o ano anterior).
