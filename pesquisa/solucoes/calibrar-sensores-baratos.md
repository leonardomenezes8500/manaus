---
id: calibrar-sensores-baratos
titulo: Juntar e calibrar os sensores baratos que já existem em Manaus
problemas: manaus-sem-medicao-do-ar
proposta_por: Coalizão Respira Amazônia; MMA (Relatório 2025)
fonte: https://ipam.org.br/wp-content/uploads/2024/11/RESPIRA-AMAZONIA-v2-1-1.pdf
status: com-evidencia
classificacao: especulativa
atua_em: causa
teste_local: pendente: issue 42
classificada_em: 2026-10-30
quem_se_beneficia: quem usa o dado dos 69 sensores da rede SELVA em Manaus (issue 41): Defesa Civil, escolas, imprensa e a população pelo app
recursos_existentes: [registro] Conama 506/2024 art. 5º (método de referência ou equivalente); o AM declarou ao MMA 64 estações indicativas e nenhuma de referência (Relatório 2025); a estação de referência da FioAres está no MonitorAr do MMA
evidencia_de_que_funciona: a correção da EPA baixou o erro do PurpleAir de 8 para 3 µg/m³ nos EUA (Barkjohn et al. 2021); nunca validada no aerossol da Amazônia
---
Pôr um sensor barato ao lado da FioAres, tirar a equação de correção local e aplicar a toda a rede. Mesmo corrigido, o sensor barato segue indicativo pela Conama 506/2024 até o Guia Técnico aceitá-lo como equivalente. A #42 deste projeto faz essa calibração com a FioAres.

## Propostas
- Coalizão Respira Amazônia (nov/2024): "é fundamental calibrá-los e validá-los regularmente com base em sensores padrão"; cita a rede do Acre (22 municípios, paga com transação penal via MPAC e UFAC), com problema de manutenção (https://ipam.org.br/wp-content/uploads/2024/11/RESPIRA-AMAZONIA-v2-1-1.pdf, acesso em 2026-10-28).
- MMA, Relatório 2025: estação indicativa sem calibração e operação adequadas pode ter incerteza relevante, e serve para complementar a rede de referência (p. 41; https://www.gov.br/mma/pt-br/centrais-de-conteudo/publicacoes/qualidade-ambiental-e-meio-ambiente-urbano/relatorio-anual-qualidade-do-ar-2025.pdf, acesso em 2026-10-28).
- Não achamos proposta escrita da UEA/EducAIR, do MPAM ou da Fiocruz para calibrar a rede SELVA com a FioAres, nem estudo de calibração de PurpleAir em Manaus (busca de 2026-10-28).

## Evidências
- [terceiros] Sem correção, o PurpleAir superestima o PM2,5 em cerca de 40%; a correção da EPA (PM2,5 = 0,524 × PA_cf1 − 0,0862 × UR + 5,75) baixou o erro (RMSE) de 8 para 3 µg/m³ e o viés para perto de zero (Barkjohn et al., AMT 2021; https://amt.copernicus.org/articles/14/4617/2021/, acesso em 2026-10-28).
- [terceiros] Na fumaça de incêndio, a correção de Barkjohn chega a inclinação de ~0,99; acima de ~600 µg/m³ subestima uns 20% (Jaffe et al., AMT 2023; https://repository.library.noaa.gov/view/noaa/58181, acesso em 2026-10-28).
- [registro] Conama 506/2024 art. 5º: para verificar o padrão e para a informação de saúde, só método de referência ou equivalente, conforme o Guia Técnico (`bruto/dou-in/2026/10/28/215649Z_f743b031_index.php.gz`).
- [registro] O AM declarou ao MMA 64 estações indicativas e nenhuma de referência em 2024 (Relatório 2025 do MMA, Tabela 7; `bruto/monitorar-mma/2026/10/28/221834Z_c0ec80f5_relatorio-anual-qualidade-do-ar-2025.pdf.gz`).

## Classificação
Especulativa: o problema principal é a falta de medição por método de referência ou equivalente (Conama 506 art. 5º), e o sensor corrigido só deixa de ser indicativo se o Guia Técnico o aceitar como equivalente, o que não existe hoje. A correção da EPA funciona fora, mas nunca foi validada no aerossol da Amazônia (#42). (critério v1, 2026-10-30, #117)
