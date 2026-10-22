# MAIAC (#54): raw numbers of an MCD19A2 HDF4 file at a few points, one CSV line per point, pass and pixel of the
# 3 x 3 box around the point. Python because neither this PC's GDAL nor JS open HDF4; all the logic (scale, fill,
# QA bits, daily mean, Manaus day) is in coleta/carga/maiac.ts, with tests.
#   uv run --no-project --python 3.12 --with pyhdf --with numpy python -I analise/maiac/extrair.py <file.hdf> <name:lat:lon> ...
import math
import sys

from pyhdf.SD import SD, SDC

R = 6371007.181  # sphere of the MODIS sinusoidal grid
TILE = 1111950.5197665  # tile side, m
N = 1200  # pixels per side at 1 km


def main(arquivo, pontos):
    f = SD(arquivo, SDC.READ)
    h, v = (int(x) for x in arquivo.split('.h')[1][:5].split('v'))  # ...h12v09...
    aod = f.select('Optical_Depth_055')[:]
    qa = f.select('AOD_QA')[:]
    orbitas = f.attributes()['Orbit_time_stamp'].split()
    print('ponto,orbita,hora,satelite,linha,coluna,aod,qa')
    for p in pontos:
        nome, lat, lon = p.split(':')
        lat, lon = float(lat), float(lon)
        x = R * math.radians(lon) * math.cos(math.radians(lat))
        y = R * math.radians(lat)
        col = int((x - (-20015109.354 + h * TILE)) / (TILE / N))
        lin = int(((10007554.677 - v * TILE) - y) / (TILE / N))
        for o, ts in enumerate(orbitas):
            for dl in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    i, j = lin + dl, col + dc
                    if 0 <= i < N and 0 <= j < N:
                        print(f'{nome},{o},{ts[:-1]},{ts[-1]},{i},{j},{aod[o, i, j]},{qa[o, i, j]}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
