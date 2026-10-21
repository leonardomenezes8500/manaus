---
id: exemplo-fonte          # igual ao nome do arquivo, sem .md (minúsculas e hífen)
nome: Nome da fonte        # nome curto e legível
publicador: Órgão ou empresa  # quem publica o dado
url: https://exemplo.org   # página da fonte ou da documentação
acesso: api                # api | download | pagina
chave: nenhuma             # nome da variável no .env (ex.: FIRMS_MAP_KEY), ou nenhuma
atualizacao: diária        # de quanto em quanto tempo a fonte muda
cobertura: Brasil, desde 2000  # período e área
licenca: CC BY 4.0         # licença de uso do dado
tipo: registro-oficial     # medicao-solo | medicao-satelite | modelo | registro-oficial | colaborativo
confiabilidade: alta       # alta | media | baixa (o motivo vai no texto)
status: candidata          # candidata | verificada | coletando | descartada
verificado_em: 2026-10-21  # dia da última requisição real que funcionou (obrigatório em verificada/coletando)
teste: 'curl -sS "https://exemplo.org/api?x=1"'  # a requisição usada, com $VARIAVEL no lugar da chave (obrigatório em verificada/coletando)
coleta: 1d                 # de quanto em quanto tempo nós coletamos (3h, 1d, 7d); só com status coletando
---
Notas curtas: limites, pegadinhas, o que falta. Valor com `: ` ou ` #` vai entre aspas simples.
