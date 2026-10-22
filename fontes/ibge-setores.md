---
id: ibge-setores
nome: IBGE Malha de setores censitários (Censo 2022)
publicador: IBGE (Geociências)
url: https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/
acesso: download
chave: nenhuma
atualizacao: por censo (a malha de 2022 é de 2024-11-12)
cobertura: Brasil, por UF; o AM tem 11.755 polígonos (10.729 setores)
licenca: dados públicos do IBGE (uso livre, citar a fonte)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-21
teste: 'curl -sSI "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/setores/gpkg/UF/AM/AM_setores_CD2022.gpkg"'
---
- GeoPackage em SIRGAS 2000 (EPSG:4674), 102 MB para o AM. Carga (#21): `node coleta/ibge-setores.ts` → `ibge.setor` em 4326. Não traz população: ela vem do card `ibge-agregados-setor`.
- 178 setores do AM vêm em mais de um polígono (até 5 partes); a carga junta as partes. 55 setores vêm sem `SITUACAO`.
- A mesma pasta tem bairros do IBGE 2022 (`bairros/gpkg/UF/AM/AM_bairros_CD2022.gpkg`), usados na #24.
