---
id: ana-hidroweb
nome: ANA HidroWeb (API nova e portal)
publicador: ANA
url: https://www.ana.gov.br/hidrowebservice/api-docs
acesso: api
chave: login e senha dados pela ANA (cadastro ainda não pedido)
atualizacao: mensal (série consistida)
cobertura: Brasil; estação 14990000 (Rio Negro em Manaus) desde 1902
licenca: não declarada
tipo: medicao-solo
confiabilidade: alta
status: candidata
---
- Tema: água. Série longa de cota e vazão. A API REST nova pede login (CPF/CNPJ + senha dados pela ANA) e devolve um token; sem ele, 401. O download do portal também dá 401.
- Por enquanto não faz falta: o webservice antigo (`ana-telemetria`) dá a mesma série consistida até 2014 e a telemetria depois. Pedir o cadastro só se a série consistida depois de 2014 for necessária.
