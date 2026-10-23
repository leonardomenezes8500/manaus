type Caixa = { oeste: number; sul: number; leste: number; norte: number };

// Região de influência da fumaça (#8), primeiro chute: AM inteiro, RO, AC, norte da Bolívia, oeste do PA e sul de RR.
// Fica para as camadas de terra (#74–#77 e o S4.2), o anel 'regiao' da série (#52, #55) e o OpenAQ. A mesma caixa está
// em analise.regiao ('influencia_fumaca', migração 002); o teste do banco confere que batem.
export const BBOX_CAMADAS = { oeste: -74, sul: -15, leste: -52, norte: 3 } as const;

// Vento (ERA5, GFS) e focos (FIRMS), #56: a borda leste vai até -44 (passa de Belém), porque com vento de leste as
// trajetórias saíam da caixa velha em ~33 h. Arquivo de vento desta caixa leva SUFIXO_CAIXA no nome.
export const BBOX = { ...BBOX_CAMADAS, leste: -44 } as const;
export const SUFIXO_CAIXA = '_l44';

/** "oeste,sul,leste,norte", o formato da API de área do FIRMS e do OpenAQ. */
export const bboxTexto = (c: Caixa = BBOX) => `${c.oeste},${c.sul},${c.leste},${c.norte}`;

export const naCaixa = (c: Caixa, lat: number, lon: number) => lon >= c.oeste && lon <= c.leste && lat >= c.sul && lat <= c.norte;

/** Ponto de referência de Manaus (Centro) para vento, ar e distâncias. */
export const MANAUS = { lat: -3.1, lon: -60.02, codigo: 1302603 } as const;

/** Município de Manaus (malha do IBGE: -60.80 -3.18 -59.15 -1.91) com folga de ~5 km: recorte do OSM e das edificações. */
export const MANAUS_BBOX = { oeste: -60.85, sul: -3.24, leste: -59.1, norte: -1.86 } as const;

/** Região Metropolitana de Manaus (13 municípios, malha do IBGE: -63.96 -4.42 -57.85 0.04) arredondada para fora: recorte dos rasters. */
export const RMM_BBOX = { oeste: -64, sul: -4.5, leste: -57.8, norte: 0.1 } as const;

/** Estados com malha municipal na base (os focos caem neles). */
export const UFS = ['AM', 'RO', 'AC', 'PA', 'RR', 'MT'] as const;

/** UFS plus the states the wind box reaches east of −52 (#56): their municipalities only name the fire spots there. */
export const UFS_FOCOS = [...UFS, 'AP', 'MA', 'TO', 'PI', 'BA', 'GO'] as const;
