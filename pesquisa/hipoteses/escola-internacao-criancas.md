---
id: 'escola-internacao-criancas'
titulo: 'Internação respiratória de criança sobe depois da volta às aulas, com ou sem fumaça'
fontes: 'seduc-am, semed-manaus, datasus-sih'
espera: 'mais internações respiratórias de 0 a 9 anos de 1 a 3 semanas depois da volta às aulas; importa se passar de 15%'
defasagem: '7 a 21 dias'
epoca: 'volta de fevereiro e de agosto separadas; agosto coincide com o começo da fumaça e por isso é testado à parte'
comparacao: 'as 3 semanas antes da volta, em anomalia sazonal'
teste: 'razão das internações (3 semanas depois ÷ 3 semanas antes) na volta de fevereiro, permutação em blocos de 7 dias'
rodada: '5'
status: 'testada'
escrita_em: '2026-10-22'
testada_em: '2026-10-23'
confianca: 'media'
resultado: 'internações respiratórias de 0 a 9 anos de 1 a 3 semanas depois da volta às aulas de fevereiro ÷ as 3 semanas antes, 11 anos (2014, 2015, 2016, 2017, 2018, 2019, 2020, 2022, 2023, 2024, 2025), média geométrica: 1.46×; p = 0.0044, p ajustado (BH da rodada 5) = 0.0176, passa na correção'
---
## Por quê
Na escola o vírus respiratório passa de criança para criança. Se isso não for separado, o M4 pode pôr na conta da fumaça o que é a volta às aulas.

## Como testar
Definições fixadas em 2026-10-23 (#87), antes de olhar o SIH: "dia de fumaça" é o dia de Manaus com pelo menos um FU no METAR de SBEG, como na série (#55); internação respiratória é a de diagnóstico principal de J00 a J99, de morador de Manaus (`MUNIC_RES` 130260), pela data da internação. O teste e o efeito esperado não mudam.

Calendário escolar (#61) e internações do SIH (M4). A volta de fevereiro, fora da fumaça, é o teste principal; a de agosto é exploratória.

## Resultado
internações respiratórias de 0 a 9 anos de 1 a 3 semanas depois da volta às aulas de fevereiro ÷ as 3 semanas antes, 11 anos (2014, 2015, 2016, 2017, 2018, 2019, 2020, 2022, 2023, 2024, 2025), média geométrica: 1.46×; p = 0.0044, p ajustado (BH da rodada 5) = 0.0176, passa na correção. Confiança media: falta um segundo recorte independente. Dado medido; 9999 permutações, semente 64, banco manaus_dev_novo em 2026-10-23. Números em produtos/contexto/rodada-5.csv.
