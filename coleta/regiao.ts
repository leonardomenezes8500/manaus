// Região de influência da fumaça (#8), primeiro chute: AM inteiro, RO, AC, norte da Bolívia, oeste do PA e sul de RR.
// A mesma caixa está em analise.regiao ('influencia_fumaca', migração 002); o teste do banco confere que batem.
export const BBOX = { oeste: -74, sul: -15, leste: -52, norte: 3 } as const;

/** "oeste,sul,leste,norte", o formato da API de área do FIRMS. */
export const bboxTexto = () => `${BBOX.oeste},${BBOX.sul},${BBOX.leste},${BBOX.norte}`;

/** Ponto de referência de Manaus (Centro) para vento, ar e distâncias. */
export const MANAUS = { lat: -3.1, lon: -60.02, codigo: 1302603 } as const;

/** Município de Manaus (malha do IBGE: -60.80 -3.18 -59.15 -1.91) com folga de ~5 km: recorte do OSM e das edificações. */
export const MANAUS_BBOX = { oeste: -60.85, sul: -3.24, leste: -59.1, norte: -1.86 } as const;

/** Região Metropolitana de Manaus (13 municípios, malha do IBGE: -63.96 -4.42 -57.85 0.04) arredondada para fora: recorte dos rasters. */
export const RMM_BBOX = { oeste: -64, sul: -4.5, leste: -57.8, norte: 0.1 } as const;

/** Estados com malha municipal na base (os focos caem neles). */
export const UFS = ['AM', 'RO', 'AC', 'PA', 'RR', 'MT'] as const;
