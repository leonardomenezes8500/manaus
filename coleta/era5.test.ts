import { diasCobertos, diasQueFaltam, periodosDiarios, esperarJob, meses, nomeBruto, pedido, submeter } from './era5.ts';

test('the request: 3 variables, 8 levels from 1000 to 700 hPa, every 3 h, 0.5° grid, the region box in N/W/S/E order', () => {
  const p = pedido('2026-07-29', '2026-07-31');
  expect(p.inputs).toMatchObject({
    product_type: ['reanalysis'],
    variable: ['u_component_of_wind', 'v_component_of_wind', 'vertical_velocity'],
    pressure_level: ['700', '800', '850', '900', '925', '950', '975', '1000'],
    year: ['2026'],
    month: ['07'],
    day: ['29', '30', '31'],
    time: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
    area: [3, -74, -15, -52],
    grid: ['0.5', '0.5'],
    data_format: 'grib',
  });
  expect(() => pedido('2026-07-30', '2026-08-02')).toThrow('mesmo mês');
});

test('raw names carry the period; the days covered come back from the R2 keys', () => {
  expect(nomeBruto('2026-10-15', '2026-10-15')).toBe('era5-pl_2026-10-15.grib');
  expect(nomeBruto('2026-07-29', '2026-07-31')).toBe('era5-pl_2026-07-29_2026-07-31.grib');
  const chaves = [
    'bruto/ecmwf-cds/2026/10/22/125000Z_era5-pl_2026-07-29_2026-07-31.grib',
    'bruto/ecmwf-cds/2026/10/22/125000Z_era5-pl_2026-07-29_2026-07-31.grib.meta.json',
    'bruto/ecmwf-cds/2026/10/22/130000Z_era5-pl_2026-10-15.grib',
  ];
  expect([...diasCobertos(chaves)].sort()).toEqual(['2026-07-29', '2026-07-30', '2026-07-31', '2026-10-15']);
});

test('history goes month by month; the daily run asks the full days 6 to 10 days ago that are missing', () => {
  expect(meses('2026-07-29', '2026-09-03')).toEqual([
    ['2026-07-29', '2026-07-31'],
    ['2026-08-01', '2026-08-31'],
    ['2026-09-01', '2026-09-03'],
  ]);
  const chaves = ['bruto/ecmwf-cds/2026/10/20/070000Z_era5-pl_2026-10-14.grib'];
  expect(diasQueFaltam(chaves, new Date('2026-10-22T10:00:00Z'))).toEqual(['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-16']);
});

test('the daily run is one request per month (the CDS queue is long), from the first to the last missing day', () => {
  expect(periodosDiarios(['2026-10-12', '2026-10-13', '2026-10-16'])).toEqual([['2026-10-12', '2026-10-16']]);
  expect(periodosDiarios(['2026-09-29', '2026-10-02'])).toEqual([
    ['2026-09-29', '2026-09-30'],
    ['2026-10-01', '2026-10-02'],
  ]);
  expect(periodosDiarios([])).toEqual([]);
});

const resposta = (status: number, corpo: object) => new Response(JSON.stringify(corpo), { status });
const falso = (...rs: Response[]) => jest.fn(async () => rs.shift()!) as unknown as typeof fetch;

test('submeter: the job id; a day not published yet is null, not an error', async () => {
  expect(await submeter(pedido('2026-10-15', '2026-10-15'), falso(resposta(201, { jobID: 'j1', status: 'accepted' })))).toBe('j1');
  const naoSaiu = resposta(400, { detail: 'None of the data you have requested is available yet, please revise the period requested.' });
  expect(await submeter(pedido('2026-10-20', '2026-10-20'), falso(naoSaiu))).toBeNull();
  await expect(submeter(pedido('2026-10-15', '2026-10-15'), falso(resposta(401, { detail: 'bad token' })))).rejects.toThrow('HTTP 401');
});

test('esperarJob: accepted → running → successful gives the file link; failed and timeout are errors', async () => {
  const ok = falso(
    resposta(200, { status: 'accepted' }),
    resposta(200, { status: 'running' }),
    resposta(200, { status: 'successful' }),
    resposta(200, { asset: { value: { href: 'https://store/x.grib', 'file:size': 660096 } } }),
  );
  expect(await esperarJob('j1', { f: ok, intervaloMs: 1, maxMs: 1000 })).toEqual({ href: 'https://store/x.grib', bytes: 660096 });
  const falhou = falso(resposta(200, { status: 'failed' }));
  await expect(esperarJob('j1', { f: falhou, intervaloMs: 1, maxMs: 1000 })).rejects.toThrow('failed');
  // Timeout: the job is cancelled, or it stays in the CDS queue and the next request is rejected.
  const preso = jest.fn(async () => resposta(200, { status: 'running' }));
  await expect(esperarJob('j1', { f: preso as unknown as typeof fetch, intervaloMs: 5, maxMs: 20 })).rejects.toThrow('não terminou');
  expect(preso).toHaveBeenLastCalledWith(expect.stringMatching(/\/jobs\/j1$/), expect.objectContaining({ method: 'DELETE' }));
  // A network blip while polling is tolerated; a network that stays down cancels the job too.
  let n = 0;
  const pisca = jest.fn(async (_u: string, o?: RequestInit) => {
    if (o?.method === 'DELETE') return resposta(200, {});
    n++;
    if (n === 1) throw new TypeError('fetch failed');
    return n === 2 ? resposta(200, { status: 'successful' }) : resposta(200, { asset: { value: { href: 'h', 'file:size': 1 } } });
  });
  expect(await esperarJob('j2', { f: pisca as unknown as typeof fetch, intervaloMs: 1, maxMs: 1000 })).toEqual({ href: 'h', bytes: 1 });
  const caiu = jest.fn(async (_u: string, o?: RequestInit) => {
    if (o?.method === 'DELETE') return resposta(200, {});
    throw new TypeError('fetch failed');
  });
  await expect(esperarJob('j3', { f: caiu as unknown as typeof fetch, intervaloMs: 1, maxMs: 1000 })).rejects.toThrow('fetch failed');
  expect(caiu).toHaveBeenLastCalledWith(expect.stringMatching(/\/jobs\/j3$/), expect.objectContaining({ method: 'DELETE' }));
});
