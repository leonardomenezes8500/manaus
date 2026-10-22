---
id: noaa-gfs-nomads
nome: NOAA GFS (NOMADS)
publicador: NOAA NCEP
url: https://nomads.ncep.noaa.gov/
acesso: download
chave: nenhuma
atualizacao: 4 vezes ao dia (rodadas de 00, 06, 12 e 18 UTC)
cobertura: global, 0,25 e 0,5 grau; o NOMADS guarda só uns 10 dias
licenca: domínio público (EUA)
tipo: modelo
confiabilidade: alta
status: coletando
verificado_em: 2026-10-22
teste: 'curl -sS -o /dev/null -w "%{http_code}\n" "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p50.pl?dir=%2Fgfs.20261022%2F00%2Fatmos&file=gfs.t00z.pgrb2full.0p50.f000&var_UGRD=on&lev_700_mb=on"'
coleta: 6h
---
- Tema: tempo e fumaça. Vento em vários níveis para a retrotrajetória dos últimos dias, antes de o ERA5 sair (#48). Modelado e provisório: o dia é refeito com o ERA5.
- Coleta (#48): `node coleta/gfs.ts` (cron da slice 4x/dia, 4h30 depois de cada rodada) e `--desde AAAA-MM-DD` para puxar a janela do NOMADS. Pelo filtro `filter_gfs_0p50.pl`: UGRD, VGRD e VVEL em 8 níveis (1000 a 700 hPa) na caixa da região de influência, a análise (f000) e a previsão de 3 h (f003) de cada rodada. Mesma grade do ERA5: 45 × 37 pontos, 0,5°.
- Tamanho medido: ~55 KB por arquivo, 8 por dia: ~0,45 MB/dia, ~0,16 GB/ano.
- Rodada fora da janela: HTTP 404. O coletor confere que o corpo começa com `GRIB` antes de guardar, porque um HTML salvo contaria como baixado.
- Janela puxada em 2026-10-22: de 2026-10-13 00Z a 2026-10-22 06Z (76 arquivos, 4 MB).
