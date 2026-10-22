-- Smoke attribution v1 (#50): spots near the day's back-trajectories. v0 keeps being computed for the comparison (#51).
ALTER TABLE analise.fumaca_dia ADD COLUMN meteo text CHECK (meteo IN ('era5', 'gfs')); -- wind of the v1 trajectories; null in v0
COMMENT ON COLUMN analise.fumaca_dia.versao IS 'v0 = straight-line wind heuristic; v1 = 72 h back-trajectories (modeled wind)';
COMMENT ON COLUMN analise.fumaca_dia.vento IS 'v0: mean wind 925/850 hPa; v1: trajectories used (meteo, count, agreement)';
COMMENT ON COLUMN analise.fumaca_foco.horas IS 'v0: hours of the day in which the spot counted; v1: trajectories in which it counted';
COMMENT ON COLUMN analise.fumaca_foco.distancia_km IS 'distance from Manaus';
