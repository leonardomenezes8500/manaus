---
id: selva-uea
nome: SELVA (Sistema Eletrônico de Vigilância Ambiental)
publicador: UEA (projeto EducAIR), com MPAM, Sema-AM e Defesa Civil
url: https://appselva.com.br/
acesso: api
chave: nenhuma
atualizacao: minutos (o mapa repassa a leitura atual dos sensores)
cobertura: Amazonas; ~34 sensores na área de Manaus (15 no ar em 2026-10-21), ~200 no estado; desde 2019-2020
licenca: não declarada (dados públicos no mapa); pedir autorização à UEA antes de coletar
tipo: medicao-solo
confiabilidade: media
status: verificada
verificado_em: 2026-10-21
teste: 'c=$(mktemp); curl -sS -c "$c" -o /dev/null https://appselva.com.br/ && curl -sS -b "$c" -H "Origin: https://appselva.com.br" -X POST "https://appselva.com.br/api.php?route=purpleair"'
---
- É a rede que a imprensa, a Defesa Civil e o MPC-AM citam. Os sensores são **PurpleAir** (UEA_EducAIR_*, SEMA_*, MPAM_*, FAS-Ar, MIT_NAMA_UFAM); o site só repassa a API da PurpleAir.
- O teste devolveu 1486 sensores (campos sensor_index, last_seen, name, latitude, longitude, temperature, pm2.5). Só a leitura atual, sem histórico.
- Endpoint não documentado: precisa do cookie da página e do cabeçalho Origin. Pode mudar sem aviso. Para histórico e uso estável, ver `purpleair`.
- Sensor barato, sem calibração oficial (o próprio MPAM avisa: "indicador", não dado regulatório). PM2.5 sem correção EPA.
