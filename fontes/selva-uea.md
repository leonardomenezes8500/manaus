---
id: selva-uea
nome: SELVA (Sistema Eletrônico de Vigilância Ambiental)
publicador: UEA (projeto EducAIR), com MPAM, Sema-AM e Defesa Civil
url: https://appselva.com.br/
acesso: api
chave: nenhuma
atualizacao: minutos (o mapa repassa a leitura atual dos sensores)
cobertura: Amazonas; ~34 sensores na área de Manaus (15 no ar em 2026-10-21), ~200 no estado; desde 2019-2020
licenca: não declarada (dados públicos no mapa); coleta liberada pelo usuário em 2026-10-28, pedido formal à UEA em plano/pedidos-lai.md
tipo: medicao-solo
confiabilidade: media
status: coletando
verificado_em: 2026-10-28
teste: 'c=$(mktemp); curl -sS -c "$c" -o /dev/null https://appselva.com.br/ && curl -sS -b "$c" -H "Origin: https://appselva.com.br" -X POST "https://appselva.com.br/api.php?route=purpleair"'
coleta: 10min
---
- É a rede que a imprensa, a Defesa Civil e o MPC-AM citam. Os sensores são **PurpleAir** (UEA_EducAIR_*, SEMA_*, MPAM_*, FAS-Ar, MIT_NAMA_UFAM); o site só repassa a API da PurpleAir.
- O teste devolveu 1486 sensores (campos sensor_index, last_seen, name, latitude, longitude, temperature, pm2.5). Só a leitura atual, sem histórico.
- Endpoint não documentado: precisa do cookie da página e do cabeçalho Origin. Pode mudar sem aviso. Para histórico e uso estável, ver `purpleair`.
- Sensor barato, sem calibração oficial (o próprio MPAM avisa: "indicador", não dado regulatório). PM2.5 sem correção EPA.
- 2026-10-28: o teste devolveu 1490 sensores; 317 na caixa da região (154 com leitura na última hora), 70 na Região Metropolitana de Manaus (39 no ar), inclusive 2 do IPAM na torre do ATTO. Os campos são fixos: pedir `pm2.5_a`/`pm2.5_b` ou outra caixa (na url, no corpo ou em JSON) é ignorado. **Sem canais A/B e sem umidade**: para isso, só a API (`purpleair`).
- `temperature` é a do sensor, em °F (mais quente que o ar). `pm2.5` é o valor da PurpleAir sem correção; a resposta não diz se é `cf_1` ou `atm`.
- Coleta (#41): `node coleta/selva.ts` a cada 10 min no cron da slice. Vai para o bruto só o corte da caixa da região (`BBOX_CAMADAS`), no mesmo formato da resposta, em gzip (~9 KB, ~500 MB/ano). Carga na mesma hora: sensores da RMM em `selva.sensor` e `selva.leitura` (uma linha por sensor e `last_seen`; o sensor manda a cada 2 min, a coleta pega uma a cada 10). Rótulo: **medido, sensor barato**.
- Hipótese: `v1-sensores-selva`.
