---
id: ibge-bairros
nome: IBGE Bairros do Censo 2022
publicador: IBGE (Geociências)
url: https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/bairros/
acesso: download
chave: nenhuma
atualizacao: por censo
cobertura: Brasil, por UF; no AM, 469 bairros, 63 em Manaus (501 km², só a área urbana)
licenca: dados públicos do IBGE (uso livre, citar a fonte)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSI "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/bairros/gpkg/UF/AM/AM_bairros_CD2022.gpkg"'
---
- GeoPackage em SIRGAS 2000 (EPSG:4674), 1,4 MB para o AM. Carga (#24): `node coleta/bairros.ts` → `ibge.bairro` em 4326. O código do bairro (`CD_BAIRRO`) também está em `ibge.setor.bairro`.
- O IBGE seguiu a lei de bairros da Prefeitura (Lei 1.401/2010, card `cmm-manaus`). Não tem o bairro Colônia Japonesa, criado em 2025.
- × OSM (`admin_level=10`, 2026-10-20): 57 bairros pareados (3 com outro nome: Parque 10 de Novembro, Praça 14 de Janeiro, Nossa Senhora Aparecida), quase todos com sobreposição (IoU) acima de 0,8; o menor é Lírio do Vale (0,43). Faltam no OSM: Colônia Santo Antônio, Distrito Industrial II, Jorge Teixeira, Monte das Oliveiras (está como `admin_level=9`), Novo Israel e Puraquequara. Vai para a fusão (#32).
