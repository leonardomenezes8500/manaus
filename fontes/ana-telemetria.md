---
id: ana-telemetria
nome: ANA Telemetria (HidroWeb, nível e chuva em tempo quase real)
publicador: ANA
url: https://telemetriaws1.ana.gov.br/ServiceANA.asmx
acesso: api
chave: nenhuma
atualizacao: 15 em 15 minutos
cobertura: estações telemétricas do Brasil; em Manaus a 14990000 (Rio Negro)
licenca: dados públicos da ANA (licença não declarada)
tipo: medicao-solo
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao=14990000&dataInicio=20/10/2026&dataFim=21/10/2026"'
---
- Tema: água. Nível do Rio Negro em Manaus (cheia e seca) e chuva, de 15 em 15 minutos, em XML.
- O teste devolveu nível 1696 cm às 19:45 de 2026-10-21 (fuso da hora a conferir; vazão vazia).
