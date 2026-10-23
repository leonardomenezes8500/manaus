---
id: icmbio-fiscalizacao
nome: ICMBio embargos e autos de infração
publicador: ICMBio
url: https://www.gov.br/icmbio/pt-br/dados-icmbio/dados_geoespaciais/mapa-tematico-e-dados-geoestatisticos-das-unidades-de-conservacao-federais
acesso: download
chave: nenhuma
atualizacao: irregular (os arquivos testados eram de 2026-10-15)
cobertura: unidades de conservação federais e entorno; embargos (polígonos) e autos de infração (pontos)
licenca: não declarada
tipo: registro-oficial
confiabilidade: alta
status: coletando
coleta: 30d
verificado_em: 2026-10-23
teste: 'curl -s -r 0-3 -o /dev/null -w "%{http_code}" "https://www.gov.br/icmbio/pt-br/dados-icmbio/dados_geoespaciais/mapa-tematico-e-dados-geoestatisticos-das-unidades-de-conservacao-federais/embargos_icmbio_shp.zip"'
---
- Tema: quem deveria agir. Embargos (`embargos_icmbio_shp.zip`, 14,8 MB, 14.806 polígonos) e autos de infração (`autos_infracao_icmbio_shp.zip`, 9,3 MB, 42.214 pontos), com UC (`cnuc`), município, data, área e, nos autos, o valor da multa.
- O teste devolveu 206 (o servidor responde 403 a HEAD; GET, inclusive por faixa de bytes, funciona).
- Nome e CPF de pessoa física são dado pessoal: nunca em issue, commit ou relatório (#79, #81).
- Coleta (#81): `coleta/fiscalizacao.ts`, neste PC, à mão, uma vez por sprint enquanto o M4 durar. Os dois zips vão para o bruto como vêm; tabelas `icmbio.embargo` e `icmbio.auto_infracao`.
- Limite: na carga de 2026-10-23, 89 embargos dos estados da caixa ficaram de fora porque o polígono some depois da correção da geometria (linha ou ponto no lugar da área). Eles não entram em `icmbio.embargo`; o script imprime quantos a cada carga.
