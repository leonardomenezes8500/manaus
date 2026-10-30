---
id: fogo-floresta-publica-nao-destinada
titulo: Floresta pública sem destinação queima mais do que terra indígena e unidade de conservação
tema: fumaca
status: com-evidencia
atualizado_em: 2026-10-28
---
## O que é
Floresta pública não destinada é terra da União ou do estado que ainda não virou unidade de conservação, terra indígena ou outro uso. Ela tem 3,5 vezes mais focos por km² do que TI e UC, e em 2026 recebeu uma parte grande do fogo que fez fumaça em Manaus.

## Evidências
- [medido] Focos por km² na floresta pública não destinada (CNFP tipo B no ano do foco) ÷ em TI e UC, AM + AC + RO, VIIRS S-NPP, 2012–2025 (média geométrica): 3,50×; p ajustado 0,0004. Segundo recorte (MODIS): 3,45×. Confiança alta (rodada 3, #78, hipótese `floresta-nao-destinada-focos`; `produtos/contexto/rodada-3.csv`).
- [medido] Dentro de TI e UC há 5 vezes menos focos por km² do que na faixa de 10 km em volta (0,20×; MODIS 0,19×; confiança alta; rodada 3, `areas-protegidas-focos`). Destinar a terra parece andar junto com menos fogo, mas o teste não separa causa de escolha do lugar.
- [modelado] Na temporada de 01/08 a 28/10 de 2026, 20% do peso somado da v1 caiu em floresta pública não destinada, 24% em floresta pública destinada e 37% fora de floresta pública; os outros 19% são focos fora da caixa das camadas, sem esse dado (banco `manaus`, `analise.fumaca_foco` × `analise.onde_queimou_foco`, consultado em 2026-10-28).
- [registro] Camada: Cadastro Nacional de Florestas Públicas do SFB, edição 2025 (#75, `sfb.floresta_publica`; tipo A destinada, B não destinada).

## Quem é afetado
A população de Manaus, pela fumaça (ver `fumaca-seca-2026`), e quem vive dentro e em volta dessas áreas.

## Quem é responsável
- [registro] SFB gere a floresta pública e mantém o cadastro (Lei 11.284/2006 art. 55, I e VII); IBAMA fiscaliza (art. 50, I e III, § 1º); no AM, o CBMAM coordena o combate (Lei-AM 6.987/2024 art. 3º). Lido no texto oficial em 2026-10-23 (#91, `analise/fogo/responsavel.ts`).
- Quem decide a destinação (União ou estado, conforme a dona da terra) ainda não está escrito aqui com a lei.

## Soluções ligadas
- `destinar-florestas-publicas` (sem classe, problema principal)
