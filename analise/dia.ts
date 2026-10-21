// Manaus é UTC−4 fixo, sem horário de verão (o Brasil acabou com ele em 2019).
const MANAUS_MS = -4 * 3600 * 1000;

/** Dia local de Manaus (AAAA-MM-DD) de um instante UTC. */
export function diaDeManaus(instanteUtc: Date): string {
  return new Date(instanteUtc.getTime() + MANAUS_MS).toISOString().slice(0, 10);
}
