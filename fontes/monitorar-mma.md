---
id: monitorar-mma
nome: MonitorAr (estação FioAres em Manaus)
publicador: MMA (dados da Fiocruz, projeto FioAres)
url: https://monitorar.mma.gov.br/
acesso: api
chave: nenhuma
atualizacao: horária (últimas 24 h no app); arquivo anual no dados.mma.gov.br
cobertura: Brasil; em Manaus 1 estação (FIOTEC - Amazonas, ILMD/Fiocruz) desde ~2026-07-02
licenca: dados abertos do governo federal (dados.mma.gov.br)
tipo: medicao-solo
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://monitorar-backend.mma.gov.br/v1/estacao/proximas?lat=-3.1&lng=-60.02"'
---
- Única estação de referência (categoria "Regulatória") em Manaus. O teste devolveu 24 h de MP2,5 até 2026-10-21 16:00, marcadas como validadas.
- O backend do app só dá o **IQAr** (índice), não µg/m³. A concentração vem nos CSV anuais (dados.mma.gov.br, dataset `ar-puro-monitorar`); o de 2025 não tem nenhuma estação no AM, então Manaus só aparece no de 2026 (sai no começo de 2027).
- Backend não documentado (rotas tiradas do app); outras rotas pedem login. Guardar o bruto toda hora para não perder o histórico.
