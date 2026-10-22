# Método para cruzar variáveis

Vale para todo cruzamento novo (#59), seja com a fumaça ou entre as variáveis da cidade (calendário, população, gasto, água, energia). Com muitas variáveis é fácil achar ligação por acaso, ou confundir a época do ano com a causa. Estas regras existem para evitar isso. As contas ficam em `analise/cruzar.ts`.

## Os 8 passos

1. **Hipótese antes.** Antes de coletar e de cruzar, escrever em `pesquisa/hipoteses/<id>.md` o que a variável explicaria, por quê (o mecanismo), a direção esperada e o tamanho de efeito que importaria, com a data. Fonte nova só entra no catálogo como `coletando` se uma hipótese citar ela; o teste do `pesquisa.test.ts` barra.
2. **Época do ano.** Nunca misturar o ano inteiro. Comparar dentro da mesma época (seca, cheia, preparo da roça) ou contra a mesma janela de outros anos: a anomalia sazonal (`anomalia`), que tira de cada dia a média da mesma janela do ano nos outros anos.
3. **Defasagem escolhida antes.** Ex.: internação de 0 a 7 dias depois da fumaça; gasto público de 0 a 2 anos depois de um ano ruim. A curva de todas as defasagens (`defasagens`) vai no relatório, mas o teste é o da defasagem escrita.
4. **Grupo de comparação.** Dias sem o evento na mesma época; anos com pouca fumaça (2019–2021 e 2025 na série da #55); outras capitais, quando houver dado.
5. **Muitas comparações.** Um teste principal por hipótese, escrito antes. O resto é exploratório e diz isso. Sobre todos os testes principais de uma rodada (uma rodada por sprint), a correção de Benjamini–Hochberg (`benjaminiHochberg`) com FDR de 10%.
6. **Dias seguidos não são independentes.** O p-valor sai por permutação em blocos de 7 dias (`permutacaoBlocos`), com a semente escrita no resultado, para dar o mesmo número de novo.
7. **Grau de confiança**, pela regra abaixo. Medido ≠ modelado em toda conclusão.
8. **Hipótese que não dá para testar** fica escrita, com `status: sem-teste` e o motivo. Ex.: Copa × eleição presidencial. Desde 1994 toda eleição presidencial caiu em ano de Copa, então não há ano para comparar.

## Grau de confiança

- **Alta:** passa na correção da rodada, aparece também num segundo recorte independente (outro período, outro sensor ou outra cidade), usa dado medido e tem mecanismo claro.
- **Média:** passa na correção, mas falta uma das outras três coisas.
- **Baixa:** não passa na correção, ou tem poucos anos (menos de 8), ou depende só de dado modelado.

Resultado nulo também é resultado: a hipótese fica `testada`, com confiança e a linha do resultado.
