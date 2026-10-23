---
id: exemplo-hipotese         # igual ao nome do arquivo, sem .md
titulo: O que a variável explicaria, numa linha
fontes: nasa-firms, tse-dados-abertos   # ids do catálogo (fontes/), separados por vírgula
espera: direção esperada e o tamanho de efeito que importaria
defasagem: 0 a 7 dias        # escolhida antes de olhar o dado
epoca: como a época do ano é controlada (mesma janela de outros anos, anomalia)
comparacao: o grupo de comparação (dias ou anos sem o evento, na mesma época)
teste: o teste principal, um só (o resto é exploratório)
rodada: 1                    # 1 = S3.5.1, 2 = S3.5.2 ...
status: escrita              # escrita | testada | sem-teste | descartada
escrita_em: 2026-10-22       # antes de coletar e de cruzar
testada_em:                  # só quando testada
confianca:                   # alta | media | baixa, pela regra do pesquisa/metodo.md (só quando testada)
resultado:                   # uma linha (só quando testada)
---
## Por quê
O mecanismo, em 2 ou 3 linhas.

## Como testar
Os dados, o recorte e o teste principal. O que for olhado a mais é exploratório e diz isso.

## Resultado
Vazio até testar. Número, p-valor ajustado e grau de confiança, com fonte e data.
