---
id: ana-telemetria
nome: ANA, webservice antigo (série histórica e telemetria)
publicador: ANA
url: https://telemetriaws1.ana.gov.br/ServiceANA.asmx
acesso: api
chave: nenhuma
atualizacao: 15 em 15 minutos (telemetria); a série consistida vai até 2014
cobertura: estações do Brasil; em Manaus a 14990000 (Rio Negro), cota diária desde 1902-09-15
licenca: dados públicos da ANA (licença não declarada)
tipo: medicao-solo
confiabilidade: alta
status: coletando
verificado_em: 2026-10-21
teste: 'curl -sS "https://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao=14990000&dataInicio=20/10/2026&dataFim=21/10/2026"'
coleta: 1d
---
- Tema: água. Cota do Rio Negro em Manaus, a régua da seca (seca forte vem com mais fogo e mais fumaça).
- `HidroSerieHistorica` (tipoDados=1): a série diária inteira numa requisição (8 MB): 1902-09-15 a 2014-12-30, consistida. Cada mês pode vir três vezes por nível: a média diária e as leituras das 7h e das 17h; a carga fica com a média. Algumas cotas têm meio centímetro.
- `DadosHidrometeorologicos`: leitura a cada 15 min, bruta (não consistida), esparsa desde 2005 e completa desde 2015; horário de Brasília (UTC−3), 30 a 60 min de atraso. O serviço responde HTTP 500 de vez em quando e às vezes repete leituras.
- Carga (#29): `node coleta/ana.ts --history` (uma vez) e `node coleta/ana.ts` (cron diário) → `ana.cota_diaria` e `ana.leitura`; a visão `ana.cota_dia` dá um valor por dia (consistido > bruto > média da telemetria no dia de Manaus). Série 1902-09-15 a 2026-10-21: 45.322 dias, um buraco só (2014-08-24 a 29).
- A telemetria fica 3 a 7 cm abaixo da régua do Porto de Manaus. Mínimos: 2023 = 12,645 m em 26/10 (Porto e SGB: 12,70 m); 2024 = 12,137 m em 02/11 (Porto: 12,17 m em 04/11). O "recorde de 12,11 m" do Porto em 09 a 12/10/2024 não aparece na ANA (12,27 m em 12/10): divergência entre fontes, dizer sempre de qual fonte é o recorde.
