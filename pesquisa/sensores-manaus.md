# Sensores de solo de qualidade do ar em Manaus (#13)

Pesquisa de 2026-10-21. "Testado" = fiz uma requisição real hoje.

Resumo: Manaus não tem rede oficial de estações. Há uma estação de referência (Fiocruz/MMA, no MonitorAr desde jul/2026) e uma rede de ~34 sensores baratos PurpleAir (UEA, Sema-AM, MPAM e outros), que aparece no SELVA. O resto (IQAir, imprensa, Defesa Civil) repassa esses mesmos sensores.

| Candidato | Achou? | Mede | Acesso | Card |
|---|---|---|---|---|
| IPAAM | Não. Nenhuma estação ou rede própria. ([busca](https://redeondadigital.com.br/amazonas/mpc-am-questiona-administracao-estadual-sobre-poluicao-do-ar-em-manaus)) | - | - | - |
| SEMMAS (Prefeitura) | Não. Em 9/9/2026 o prefeito vetou os pontos municipais de monitoramento da Lei 3.699/2026. ([Cenarium](https://revistacenarium.com.br/en/amid-smoke-in-manaus-mayor-vetoes-municipal-air-quality-monitoring-stations/)) | - | - | - |
| SEMA-AM | Sim. Comprou 62 sensores (projeto Redt, com a Coreia do Sul) para os municípios. São PurpleAir. Em Manaus: SEMA_MANAUS no ar; os outros SEMA_* estão em teste ou parados. ([Câmara](https://www2.camara.leg.br/atividade-legislativa/comissoes/comissoes-permanentes/cmads/apresentacoes-em-eventos/apresentacoes-de-convidados-em-eventos-de-2024/13-08-2024-integrar-esforcos-entre-os-diferentes-entes-federados-no-combate-ao-desmatamento-as-queimadas-a-fumaca-toxica-e-a-estiagem-dos-rios-no-amazonas/maycon-douglas-castro/view)) | PM2.5, temperatura | SELVA / PurpleAir (testado) | `selva-uea`, `purpleair` |
| MonitorAr (MMA) | Sim, 1 estação: "FIOTEC - Amazonas" (ILMD/Fiocruz), categoria Regulatória, desde ~2/7/2026. O CSV de 2025 não tem nenhuma estação no AM. ([MMA](https://portalamazonia.com/meio-ambiente/brasil-monitorar-norte/), [Em Tempo](https://emtempo.com.br/477380/amazonas/fiocruz-instala-estacao-para-monitorar-qualidade-do-ar-em-manaus/)) | MP2,5 horário (o app dá só o índice IQAr) | API do app (testado) + CSV anual em dados.mma.gov.br | `monitorar-mma` |
| SIPAM/Censipam | Não. Nada de sensor de ar; só satélite/fogo. | - | - | - |
| Defesa Civil | Sim, mas sem dado próprio. A municipal ganhou um sensor do SELVA na sede (30/6/2026) e publica boletins; a estadual instala os sensores da Sema. ([Em Tempo](https://emtempo.com.br/476827/amazonas/manaus-estacao-monitoramento-qualidade-ar-estiagem/)) | PM2.5 | via SELVA | `selva-uea` |
| INPA/LBA | Só histórico (aerossol em campanhas LBA/GoAmazon). Nenhuma medição contínua atual em Manaus. ([INPA](https://repositorio.inpa.gov.br/bitstream/1/12644/1/Everlin%20Pereira%20Fernandes.pdf)) | aerossol (pesquisa) | ver ATTO e ARM | - |
| ATTO | Sim. Torre a ~150 km de Manaus, aerossol desde 2012. ([portal](https://www.attodata.org/)) | black carbon, aerossol | download com cadastro e aprovação | `atto` |
| UEA | Sim, é a rede principal: SELVA/EducAIR, ~20 sensores PurpleAir em Manaus, mais antigos de 2019-2020. ([SELVA](https://appselva.com.br/), [MPAM](https://www.mpam.mp.br/principais-temas/poluicao-do-ar)) | PM2.5, temperatura | endpoint do mapa (testado), sem histórico | `selva-uea` |
| UFAM | Sim, 1 sensor PurpleAir (MIT_NAMA_UFAM), no ar. ([Portal Amazônia](https://portalamazonia.com/meio-ambiente/fumaca-queimadas-manaus-2026/)) | PM2.5 | SELVA / PurpleAir | `purpleair` |
| Fiocruz Amazônia | Sim: a estação de referência FioAres no ILMD (ver MonitorAr). O "Observatório Clima e Saúde" usa modelo, não sensor. ([Em Tempo](https://emtempo.com.br/477380/amazonas/fiocruz-instala-estacao-para-monitorar-qualidade-do-ar-em-manaus/)) | MP2,5 | MonitorAr (testado) | `monitorar-mma` |
| GoAmazon 2014 (T3, ARM) | Sim, só histórico 2014-2015 em Manacapuru. ([ARM](https://arm.gov/research/campaigns/amf2015goamazon-hivol)) | aerossol, filtros PM2.5 | download com conta ARM grátis | `arm-goamazon` |
| PurpleAir | Sim. 34 sensores na área de Manaus, 15 no ar às 21:30Z de hoje (lista tirada do SELVA). ([API](https://api.purpleair.com)) | PM2.5 (canais A/B), temp., umidade | API com chave e pontos (sem chave: erro, testado) | `purpleair` |
| IQAir | Sim, 4 pontos de "contribuidores anônimos" (batem com PurpleAir/AirGradient). Pode misturar estimativa sem avisar. ([IQAir](https://www.iqair.com/brazil/amazonas/manaus)) | PM2.5 (AQI EUA) | API com chave; página bloqueou curl (429) | `iqair` |
| AirGradient | Sim, 1 sensor (Greenpeace, Centro), desde 2025-07. A API pública da AirGradient não lista; vem pelo OpenAQ (testado). | PM1, PM2.5 | OpenAQ | `openaq` |
| Sensor.Community | Não. 0 sensores num raio de 50 km (testado). | - | - | - |
| WAQI (aqicn) | Não. Nenhuma estação em Manaus no mapa; a página da cidade dá 404 (testado). Usa CAMS (modelo) em alguns produtos. | - | - | - |
| Clarity | Não achei nada na Amazônia (só piloto em Jundiaí-SP). | - | - | - |
| MP-AM | Sim, parceiro do SELVA: doou 69 sensores à UEA. O sensor da sede (MPAM_MAO) está parado desde 2025-06-03. O MPC-AM cobra o Estado com dados da UEA. ([MPAM](https://www.mpam.mp.br/principais-temas/poluicao-do-ar)) | PM2.5 | via SELVA | `selva-uea` |
| Defensoria (DPE-AM) | Não. Só cobrança contra queimadas (2024), sem sensor. ([O Antagonista](https://oantagonista.com.br/brasil/queimadas-se-intensificam-na-amazonia-e-defensoria-publica-cobra-acao/)) | - | - | - |
| Imprensa local | Não tem sensor próprio. Cita SELVA, IQAir e Defesa Civil. | - | - | - |
| Extra: RedeAr (IPAM/UFPA) | Rede nova de sensores baratos na Amazônia (2026); não achei sensor em Manaus nem dados abertos. ([Portal Amazônia](https://portalamazonia.com/amazonia/rede-sensor-monitoramento-ar/)) | PM | não achei | - |

## Recomendação
1. Coletar já, de hora em hora, a estação FioAres (MonitorAr): é a única medição de referência da cidade e o app só guarda 24 h.
2. Coletar os ~34 PurpleAir de Manaus (pelo SELVA agora; pela API PurpleAir com chave para ter histórico e correção EPA), rotulados "sensor barato".
3. Usar a FioAres para calibrar os PurpleAir e o AirGradient; ATTO e ARM ficam para validação histórica. Rede oficial em Manaus: não existe (vira ideia no IDEIAS.md e problema na #20).

Issues de coletor abertas para a triagem: #40 (MonitorAr/FioAres), #41 (PurpleAir), #42 (calibração).
