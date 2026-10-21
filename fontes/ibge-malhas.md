---
id: ibge-malhas
nome: IBGE Malhas territoriais (API v4)
publicador: IBGE
url: https://servicodados.ibge.gov.br/api/docs/malhas?versao=4
acesso: api
chave: nenhuma
atualizacao: anual (malha municipal nova a cada ano)
cobertura: Brasil; municípios, estados, regiões
licenca: dados públicos do IBGE (uso livre, citar a fonte)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sS "https://servicodados.ibge.gov.br/api/v4/malhas/municipios/1302603?formato=application/vnd.geo+json"'
---
- Manaus = código 1302603. O teste devolveu um GeoJSON de 34 KB com o polígono do município.
- Geometria simplificada para web. Para análise fina (setores, áreas), usar os shapefiles do FTP de geociências do IBGE.
