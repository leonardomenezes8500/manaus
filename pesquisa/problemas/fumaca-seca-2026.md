---
id: fumaca-seca-2026
titulo: Fumaça em Manaus na seca de 2026
tema: fumaca
status: com-evidencia
atualizado_em: 2026-10-28
---
## O que é
Entre agosto e outubro de 2026, o ar de Manaus passou a maior parte dos dias acima do limite diário de PM2,5 da OMS, e o aeroporto registrou fumaça.
Outubro foi o pior mês. O PM2,5 medido vem de um único sensor barato, então mostra a tendência, não o valor exato para a cidade.

## Evidências
- [medido] PM2,5 medido, média diária, de 01/08 a 27/10 (88 dias com 18 h ou mais de dado): 61 dias acima de 15 µg/m³ (diretriz da OMS, que é também o padrão final da Conama 506/2024) e 15 dias acima de 50 µg/m³ (o padrão PI-2, em vigor desde 01/01/2025) (OpenAQ, sensor AirGradient do Centro; banco `manaus`, `analise.fumaca_dia`, consultado em 2026-10-28).
- [registro] Padrão diário de PM2,5 da Resolução Conama 506/2024 (Anexo I): PI-1 60, PI-2 50 (em vigor desde 01/01/2025, art. 4º § 2º), PI-3 37 (2033), PI-4 25 (2044) e PF 15 µg/m³, que são os valores guia da OMS de 2021 e ainda não têm data (DOU de 09/07/2024; `bruto/dou-in/2026/10/28/215649Z_f743b031_index.php.gz`, lido em 2026-10-28).
- [medido] PM2,5 medido de 01/08 a 20/10 (81 dias, todos com 18 h ou mais de dado): 54 dias acima de 15 µg/m³ e 30 acima do dobro (OpenAQ, sensor AirGradient do Centro, 2026-10-21; `bruto/openaq/2026/10/21/215149Z_sensor-13574643-pm25_2026-08.json`, `…215211Z_…_2026-09.json`, `…215231Z_…_2026-10.json`).
- [medido] Média mensal do mesmo sensor: agosto 9,8, setembro 31,9 e outubro (até dia 20) 74,5 µg/m³ (mesma fonte e arquivos).
- [medido] Pior dia: 17/10, com média de 197 µg/m³, 13 vezes a diretriz da OMS (mesma fonte; `…_2026-10.json`).
- [modelado] Modelo CAMS no ponto de Manaus, mesmo período: média de 27,2 µg/m³ (Open-Meteo, 2026-10-21; `bruto/open-meteo-qualidade-ar/2026/10/21/215904Z_manaus-ar_2026-08-01_2026-08-31.json` e os dois meses seguintes).
- [medido] Aeroporto Eduardo Gomes (SBEG): 129 horas com fumaça (FU) ou névoa seca (HZ) entre 01/08 e 20/10, em 19 dias. Os dias com mais horas foram 12/10 (17 h), 18/10 (15 h) e 23/09 (12 h) (METAR via IEM, 2026-10-21; `bruto/iem-asos/2026/10/21/220158Z_SBEG_2026.csv`).
- [medido] No mesmo intervalo (1/ago a 20/out), 2024 teve 165 horas e 2023 teve 126; 2015 teve 114. Antes de 2012 o arquivo não tem esse campo (METAR via IEM; `bruto/iem-asos/2026/10/21/220145Z_SBEG_2024.csv`, `…220139Z_SBEG_2023.csv`, `…220050Z_SBEG_2015.csv`).
- [medido] Série 2012–2026 (`produtos/fumaca/serie-2012-2026.md` e `.csv`, gerada em 2026-10-22; METAR do SBEG, focos VIIRS S-NPP a até 800 km do arquivo FIRMS, cota do Rio Negro da ANA, AOD do AERONET): os anos com muitos dias de fumaça são 2015 (34 dias com FU), 2023 (33), 2024 (27) e 2026 (20, até 21/10). Nos outros anos foram de 0 a 5.
- [medido] Os dias com visibilidade abaixo de 5 km sem chuva nem névoa acompanham os dias com FU: 26, 26, 18 e 14 nesses quatro anos, e 0 em 2019, 2020, 2021 e 2025. Então o zero de FU desses anos é ar limpo de fato, e não um costume do observador (mesma série).
- [medido] Seca e fumaça, pelo método (rodada 1, #64, hipótese `cheia-seca-fumaca`, escrita antes): Spearman −0,76 entre a cota mínima de agosto a novembro e os dias com FU, 14 anos, p ajustado 0,025; confiança média (falta um segundo recorte independente).
- [medido] Nenhuma das duas coisas explica sozinha. 2020 teve tantos focos quanto 2015 (203 mil contra 201 mil) e nenhum dia com FU; 2012 teve a cota mínima igual à de 2015 (16,0 m) e só 2 dias com FU. Os anos de mais fumaça juntam seca forte e muitos focos: 2023 e 2024 tiveram as duas menores cotas da série (12,6 e 12,1 m) e os maiores números de focos (mesma série).
- [medido] Onde o fogo cai (rodada 3, #78, confiança alta, focos VIIRS de 2012 a 2025): 18 vezes mais focos por km² no desmatamento de 1 a 3 anos antes do que no desmatamento até 2007 (hipótese `desmatamento-recente-focos`); 5 vezes menos dentro de terra indígena e unidade de conservação do que na faixa de 10 km em volta (`areas-protegidas-focos`); 3,5 vezes mais na floresta pública não destinada do que em TI e UC (`floresta-nao-destinada-focos`, ver o problema `fogo-floresta-publica-nao-destinada`).
- [medido] Contra o esperado: depois da proibição do fogo do IPAAM de 2010, a fatia dos focos de agosto a outubro no AM subiu 7,1 pontos em relação a RO e AC (rodada 3, `proibicao-ipaam-2010`, p ajustado 0,008, confiança média). A regra escrita, sozinha, não aparece nos focos.
- [medido] Sem ligação achada: a área queimada do MapBiomas a até 800 km e o desmatamento do DETER de janeiro a julho não acompanham os dias com FU depois de tirar os focos e a seca (rodada 3, `area-queimada-fumaca` e `deter-antes-da-fumaca`, confiança baixa).
- [modelado] De onde veio, pela v1 com a diluição do peso (#101, trajetórias de 72 h com vento do ERA5): na temporada de 01/08 a 28/10, 58% do peso somado vem de focos fora do AM: PA 51%, AM 42%, MA 4,1%, AP 1,3%, PI 1,0%, TO 0,5% (banco `manaus`, `analise.fumaca_foco` × `analise.onde_queimou_foco`, consultado em 2026-10-28). Ver o problema `fumaca-vem-de-fora-do-am`.

## Quem é afetado
A população de Manaus: 2.063.689 pessoas no Censo 2022 (IBGE, SIDRA tabela 4709, consultada em 2026-10-21).

O efeito na saúde não apareceu no nosso dado. Nas internações respiratórias de moradores de Manaus nos 0 a 7 dias depois de um dia com FU, a diferença foi de −2,3% (agosto a novembro, 2012–2025); nos óbitos de 60 anos ou mais, 0,8%; e a alta das crianças pequenas e dos idosos foi igual à dos outros (1,01×). Nenhum passou na correção (rodada 5, #92, confiança baixa). Isso não prova que a fumaça não faz mal: o SIH conta internação, não sintoma nem consulta, e o FU do aeroporto é um marcador grosso.

## Quem é responsável
Pela regra da #91 (`analise/fogo/responsavel.ts`), lida no texto oficial de cada norma em 2026-10-23 (Planalto, ALEAM e CMM):
- [registro] Unidade de conservação federal: ICMBio previne, fiscaliza e dirige o combate (Lei 11.516/2007 art. 1º; Lei 14.944/2024 art. 11 § 6º).
- [registro] Unidade de conservação estadual: SEMA-AM previne e IPAAM fiscaliza (LC-AM 53/2007; Lei-AM 4.163/2015; Lei-AM 6.437/2023).
- [registro] Terra indígena: FUNAI previne e fiscaliza; IBAMA (Prevfogo) previne e combate (Decreto 11.226/2022; Lei 5.371/1967; Lei 7.735/1989).
- [registro] Floresta pública não destinada: SFB gere e IBAMA fiscaliza (Lei 11.284/2006 arts. 50 e 55).
- [registro] Assentamento: INCRA gere; IPAAM fiscaliza; IBAMA previne e combate (Decreto 11.232/2022; LC 140/2011 art. 8º).
- [registro] Imóvel rural: o responsável pelo imóvel previne (Lei 14.944/2024 art. 45 § 1º); IPAAM e IBAMA fiscalizam (LC 140/2011).
- [registro] Em qualquer área do AM, o CBMAM coordena o combate e as Forças Armadas apoiam (CF art. 144 § 5º; Lei-AM 6.987/2024; LC 97/1999 art. 16).

A regra cobre só o AM. O fogo do PA, que pesa mais que o do AM na v1, fica com os órgãos do PA e da União, ainda sem regra escrita aqui.

## Soluções ligadas
- `abrigos-ar-limpo` (paliativa, problema principal)
- `ajustar-aula-atividade-ar-livre` (paliativa, problema principal)
- `alerta-diario-fumaca` (paliativa, problema principal)
- `alerta-satelite-resposta-rapida` (especulativa, problema principal)
- `atualizar-niveis-episodio-critico` (especulativa, problema principal)
- `brigadas-manejo-integrado-fogo` (prática, problema principal)
- `comunicacao-risco-saude` (paliativa, problema principal)
- `credito-compra-condicionados` (especulativa, problema principal)
- `desapropriar-terra-queimada` (especulativa, problema principal)
- `embargo-remoto-responsabilizacao` (especulativa, problema principal)
- `mascara-pff2-dia-fumaca` (paliativa, problema principal)
- `plano-episodios-criticos-am` (especulativa, problema principal)
- `proibicao-sazonal-fogo` (especulativa, problema principal)
- `protocolo-respiratorio-vigiar` (especulativa, problema principal)
- `purificador-caseiro-caixa-filtro` (paliativa, problema principal)
- `roca-sem-fogo-ater` (especulativa, problema principal)
- `salas-ar-limpo-escolas-ubs` (paliativa, problema principal)
- `cooperacao-interestadual-fogo` (especulativa)
- `destinar-florestas-publicas` (sem classe, falta conferir o estado)
- `rede-oficial-medicao-ar` (sem classe, falta conferir)
- `sensores-escolas-dado-aberto` (especulativa)
