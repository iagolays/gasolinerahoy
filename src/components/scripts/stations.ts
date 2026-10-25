// Carga (una sola vez) el JSON compacto de estaciones para el JS de cliente.
import { decodeStationsMin, type ClientStation, type StationsMin } from '../../lib/stations-min';

export const STATIONS_URL = '/data/stations.min.json';

let rawPromise: Promise<StationsMin> | null = null;
let decoded: ClientStation[] | null = null;

export function loadStationsRaw(): Promise<StationsMin> {
  rawPromise ??= fetch(STATIONS_URL).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<StationsMin>;
  });
  // Si falla, permite reintentar más tarde.
  rawPromise.catch(() => {
    rawPromise = null;
  });
  return rawPromise;
}

export async function loadStations(): Promise<ClientStation[]> {
  if (decoded) return decoded;
  decoded = decodeStationsMin(await loadStationsRaw());
  return decoded;
}

/** Quita tildes y pasa a minúsculas para comparar textos. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
