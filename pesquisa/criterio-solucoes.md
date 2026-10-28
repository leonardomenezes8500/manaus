---
escrito_em: 2026-10-28
versao: 1
situacao: provisório (o usuário ainda não leu; segue assim até ele dizer)
---
# Critério para classificar soluções

Vale para toda solução em `pesquisa/solucoes/` (#104). Foi escrito antes de qualquer solução ser classificada, como a hipótese do `metodo.md`. O teste do `pesquisa.test.ts` barra solução com `classificada_em` anterior ao `escrito_em` deste arquivo. Mudar o critério pede `versao` e `escrito_em` novos, e as soluções já classificadas são revistas por ele.

## Antes de classificar
Cada solução diz duas coisas:
- **o problema principal**, que é o primeiro de `problemas`. A classe é sempre em relação a ele: um sensor age na causa de "Manaus sem medição do ar", mas não na causa da fumaça;
- **onde age** (`atua_em`): `causa`, se tira ou reduz o que gera o problema, ou `efeito`, se reduz o dano em quem já está exposto.

## As três classes
A primeira regra que vale decide.

1. **Especulativa**, se vale qualquer uma destas:
   - ninguém mostrou que funciona, nem aqui nem fora;
   - depende de algo que não existe hoje: tecnologia não testada, lei ou órgão novo, verba sem fonte;
   - o nosso dado local contradiz o mecanismo com confiança média ou alta.
2. **Paliativa**, se `atua_em: efeito`. Reduz a exposição ou o dano, mas o problema volta igual na temporada seguinte se a solução parar.
3. **Prática**, se `atua_em: causa`, há evidência de que funciona (de fora, rotulada, ou local) e o órgão, a base legal e a estrutura ou a verba já existem, conferidos por nós em registro oficial.

Uma solução que age na causa e não é especulativa, mas ainda não tem órgão, lei ou verba conferidos, fica sem classe até a conferência.

Paliativa não quer dizer ruim. Pode ser a mais urgente. A classe diz o que a solução faz, não quanto ela vale.

## Exemplos
São genéricos de propósito, para não classificar antes as soluções do levantamento.
- Especulativa: semear nuvens para chover e lavar a fumaça (ninguém mostrou que funcione nessa escala); um cinturão verde na cidade contra fumaça que vem de 1.000 km (o mecanismo não fecha).
- Paliativa: distribuir máscara PFF2 em dia de fumaça; purificador portátil em casa; mudar o horário da educação física.
- Prática: aceiro e brigada contratados todo ano por um órgão que já tem a obrigação legal e a verba, com queda medida da área queimada onde já foi feito; proibição sazonal do fogo onde a lei e a fiscalização por satélite já existem e a queda dos focos foi medida em outro lugar.

## Evidência
Cada linha da seção `## Evidências` começa com um rótulo:
- `[medido]`: dado local medido, com o caminho no bruto ou no produto;
- `[modelado]`: CAMS, v1, ERA5 e outros modelos;
- `[registro]`: registro oficial conferido por nós (lei, cadastro, orçamento, contrato), com o link e a data da consulta;
- `[terceiros]`: o que outros dizem e nós não conferimos (estudo, ONG, imprensa, órgão), com o link e a data de acesso.

`recursos_existentes` só cita o que tem `[registro]`: o órgão, a lei, a verba ou a estrutura existe porque nós vimos no registro oficial. Lei citada leva o link oficial e a data em que a situação foi conferida; o histórico de versões fica para o M5.5.

O grau de confiança só vem de hipótese testada pelo método (`metodo.md`). Resultado que depende só de modelo não passa de baixa.

Proposta que nenhum órgão, MP, ONG ou pesquisador fez antes entra com `proposta_por: este projeto`, e isso aparece na tabela-resumo.

## Campos
Além dos do `_modelo.md`, a solução classificada leva:
- `atua_em`: `causa` ou `efeito`;
- `teste_local`: o id do produto ou da hipótese que testou a solução com dado nosso; `pendente: issue N`; ou `nenhum: <motivo>`. No front matter, `#` começa um comentário, então o número da issue vai sem `#`;
- `classificada_em`: AAAA-MM-DD, nunca antes do `escrito_em` deste arquivo.

O teste também barra `atua_em: efeito` com `pratica`, `atua_em: causa` com `paliativa` e linha de evidência sem rótulo.
