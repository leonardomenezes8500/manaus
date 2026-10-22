---
id: 'proibicao-fogo-focos'
titulo: 'O período proibitivo de queimadas no AM reduz os focos'
fontes: 'sema-am, ipaam, nasa-firms'
espera: 'menos focos no AM dentro da janela proibida do que na mesma janela de anos sem proibição, descontada a seca; importa se passar de 20%'
defasagem: '0 dias'
epoca: 'a mesma janela do ano; a seca entra pela cota mínima'
comparacao: 'anos sem proibição; e o AM contra os vizinhos no mesmo ano (diferença das diferenças)'
teste: 'diferença das diferenças (AM − vizinhos, com − sem proibição) nos focos da janela, permutando os anos'
rodada: '1'
status: 'sem-teste'
escrita_em: '2026-10-22'
---
## Por quê
Se a proibição pega, o fogo cai dentro da janela ou vai para antes e depois dela.

## Como testar
Atos de proibição (#62) e focos do arquivo FIRMS por estado. Exploratório: se o fogo só mudou de data (antes e depois da janela).

## Resultado
Sem teste na rodada 1 (2026-10-22). O teste escrito compara anos com e sem proibição, mas no período dos focos (2012 em diante) todo ano tem a proibição de agosto a outubro da Portaria IPAAM 127/2010 (#62): não há ano sem proibição no AM. A suspensão federal (2019–2022) e os decretos do AM de 2024 e 2026 mudam só a janela em volta. E o banco não tem focos por estado (só os anéis de 800 km e da região), que a diferença das diferenças pede. Volta a ter teste com focos por estado e uma comparação que a regra do IPAAM permita, escrita como hipótese nova.
