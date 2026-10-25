// API de datos para las páginas (solo en build/servidor: usa node:fs).
// Lee src/data/generated/dataset.json (lo genera `npm run data`) y data/history/history.json.
// Todo se calcula una vez y se guarda en memoria: el build llama a estas funciones miles de veces.
//
// ─── Formato de public/data/stations.min.json (para el JS de cliente) ───────────────────────────
// Lo escribe scripts/fetch-data.ts. Es JSON compacto pensado para comprimir bien con gzip.
// El decodificador (puro, sin Node) está en src/lib/stations-min.ts: `decodeStationsMin(json)`.
//
// {
//   "v": 1,                                  // versión del formato
//   "t": "2026-10-26T00:18:58+01:00",        // updatedAt (ISO)
//   "f": ["gasolina95","diesel",...],        // FuelKey de cada columna de precio (= FUEL_ORDER)
//   "p": [["02","Albacete","albacete"], ...],// provincias: [id, nombre, slug]
//   "m": [["Abengibre","abengibre",0], ...], // municipios: [nombre, slug, índice en "p"]
//   "b": [["Repsol","repsol"], ...],         // marcas: [nombre, slug]
//   "s": [                                   // estaciones
//     [4375, 12, 0, 3921142, -153917, 0, 1699, 1829],
//     // [id, índice marca en "b", índice municipio en "m", lat×1e5, lon×1e5, 24h (1/0),
//     //  ...precios en milésimas de euro en el orden de "f" (0 = no lo vende)]
//     // Los ceros finales se omiten: una fila puede tener menos columnas de precio que "f".
//   ]
// }
// No lleva dirección (ahorra ~30 % en gzip): para eso está la ficha de la estación.
// La URL de la ficha es `/gasolinera/${b[i][1]}-${m[j][1]}-${id}/` (coincide con Station.slug).
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Dataset, FuelKey, FuelStats, HistoryPoint, Municipality, Province, Station, StatsByFuel } from './types';
import { FUEL_ORDER } from './fuels';

export type { StatsByFuel } from './types';

const ROOT = process.cwd();
export const DATASET_PATH = join(ROOT, 'src/data/generated/dataset.json');
export const HISTORY_PATH = join(ROOT, 'data/history/history.json');

// ─── Carga e índices ──────────────────────────────────────────────────────────────────────────

interface Indices {
  dataset: Dataset;
  stationById: Map<string, Station>;
  stationBySlug: Map<string, Station>;
  provinceById: Map<string, Province>;
  provinceBySlug: Map<string, Province>;
  muniById: Map<string, Municipality>;
  muniBySlug: Map<string, Municipality>; // clave `${provSlug}/${muniSlug}`
  stationsByMuni: Map<string, Station[]>;
  stationsByProv: Map<string, Station[]>;
}

let indices: Indices | null = null;

function load(): Indices {
  if (indices) return indices;
  if (!existsSync(DATASET_PATH)) {
    throw new Error(`No existe ${DATASET_PATH}. Ejecuta antes "npm run data" (o "npm run data -- --offline").`);
  }
  const dataset = JSON.parse(readFileSync(DATASET_PATH, 'utf8')) as Dataset;
  return setDataset(dataset);
}

/** Sustituye el dataset en memoria (lo usan los tests). Devuelve los índices construidos. */
export function setDataset(dataset: Dataset): Indices {
  const provinceById = new Map(dataset.provinces.map((p) => [p.id, p]));
  const provinceBySlug = new Map(dataset.provinces.map((p) => [p.slug, p]));
  const muniById = new Map(dataset.municipalities.map((m) => [m.id, m]));
  const muniBySlug = new Map<string, Municipality>();
  for (const m of dataset.municipalities) {
    const prov = provinceById.get(m.provinceId);
    if (prov) muniBySlug.set(`${prov.slug}/${m.slug}`, m);
  }
  const stationById = new Map<string, Station>();
  const stationBySlug = new Map<string, Station>();
  const stationsByMuni = new Map<string, Station[]>();
  const stationsByProv = new Map<string, Station[]>();
  for (const s of dataset.stations) {
    stationById.set(s.id, s);
    stationBySlug.set(s.slug, s);
    push(stationsByMuni, s.municipalityId, s);
    push(stationsByProv, s.provinceId, s);
  }
  indices = { dataset, stationById, stationBySlug, provinceById, provinceBySlug, muniById, muniBySlug, stationsByMuni, stationsByProv };
  statsCache.clear();
  grid = null;
  history = null;
  centroids = null;
  return indices;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');

// ─── Consultas básicas ────────────────────────────────────────────────────────────────────────

export function getDataset(): Dataset {
  return load().dataset;
}

/** Todas las estaciones (orden: provincia, municipio, marca). */
export function getStations(): Station[] {
  return load().dataset.stations;
}

/** Provincias ordenadas por nombre. */
export function getProvinces(): Province[] {
  return load().dataset.provinces;
}

export function getProvince(slug: string): Province | undefined {
  return load().provinceBySlug.get(slug);
}

export function getProvinceById(id: string): Province | undefined {
  return load().provinceById.get(id);
}

/** Municipios de una provincia, ordenados por nombre. */
export function getMunicipalitiesOf(provinceId: string): Municipality[] {
  const ix = load();
  const prov = ix.provinceById.get(provinceId);
  if (!prov) return [];
  return prov.municipalityIds.map((id) => ix.muniById.get(id)).filter((m): m is Municipality => !!m);
}

/** Todos los municipios (para getStaticPaths). */
export function getMunicipalities(): Municipality[] {
  return load().dataset.municipalities;
}

export function getMunicipality(provSlug: string, muniSlug: string): Municipality | undefined {
  return load().muniBySlug.get(`${provSlug}/${muniSlug}`);
}

export function getMunicipalityById(id: string): Municipality | undefined {
  return load().muniById.get(id);
}

export function getStation(slug: string): Station | undefined {
  return load().stationBySlug.get(slug);
}

export function getStationById(id: string): Station | undefined {
  return load().stationById.get(id);
}

export function getStationsOf(municipalityId: string): Station[] {
  return load().stationsByMuni.get(municipalityId) ?? [];
}

export function getStationsOfProvince(provinceId: string): Station[] {
  return load().stationsByProv.get(provinceId) ?? [];
}

/** Ruta de la ficha de una estación: "/gasolinera/repsol-abengibre-4375/". */
export function stationPath(station: Station): string {
  return `/gasolinera/${station.slug}/`;
}

/** Ruta de una provincia: "/provincia/albacete/". */
export function provincePath(province: Province): string {
  return `/provincia/${province.slug}/`;
}

/** Ruta de un municipio: "/provincia/albacete/abengibre/". */
export function municipalityPath(muni: Municipality): string {
  const prov = getProvinceById(muni.provinceId);
  return `/provincia/${prov?.slug ?? muni.provinceId}/${muni.slug}/`;
}

// ─── Estadísticas ─────────────────────────────────────────────────────────────────────────────

/** Redondea a milésimas (toPrecision evita errores como 1,4875 → 1,487). */
const round3 = (n: number) => Math.round(Number((n * 1000).toPrecision(12))) / 1000;

/** Mediana de una lista ya ordenada de forma ascendente. */
function medianSorted(sorted: number[]): number {
  const n = sorted.length;
  const mid = n >> 1;
  return n % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Estadísticas por carburante de un conjunto de estaciones. Solo incluye los carburantes con datos. */
export function statsFor(stations: readonly Station[]): StatsByFuel {
  const out: StatsByFuel = {};
  for (const fuel of FUEL_ORDER) {
    const values: number[] = [];
    for (const s of stations) {
      const p = s.prices[fuel];
      if (typeof p === 'number' && Number.isFinite(p)) values.push(p);
    }
    if (!values.length) continue;
    values.sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const stats: FuelStats = {
      min: values[0]!,
      max: values[values.length - 1]!,
      avg: round3(sum / values.length),
      median: round3(medianSorted(values)),
      count: values.length,
    };
    out[fuel] = stats;
  }
  return out;
}

const statsCache = new Map<string, StatsByFuel>();

function cachedStats(key: string, get: () => readonly Station[]): StatsByFuel {
  let s = statsCache.get(key);
  if (!s) {
    s = statsFor(get());
    statsCache.set(key, s);
  }
  return s;
}

export function nationalStats(): StatsByFuel {
  return cachedStats('es', getStations);
}

export function provinceStats(id: string): StatsByFuel {
  return cachedStats(`p:${id}`, () => getStationsOfProvince(id));
}

export function municipalityStats(id: string): StatsByFuel {
  return cachedStats(`m:${id}`, () => getStationsOf(id));
}

/**
 * Diferencia porcentual de un precio respecto a una referencia (p. ej. la media):
 * pctDiff(1.829, 1.776) → 3 (un 3 % más caro). Redondeado a 1 decimal.
 */
export function pctDiff(price: number, reference: number): number {
  if (!reference) return 0;
  return Math.round(((price - reference) / reference) * 1000) / 10;
}

/** Las `n` estaciones más baratas para un carburante (solo las que lo venden). */
export function cheapest(stations: readonly Station[], fuel: FuelKey, n: number): Station[] {
  return stations
    .filter((s) => typeof s.prices[fuel] === 'number')
    .sort((a, b) => a.prices[fuel]! - b.prices[fuel]! || a.brand.localeCompare(b.brand, 'es') || a.id.localeCompare(b.id))
    .slice(0, n);
}

// ─── Distancias ───────────────────────────────────────────────────────────────────────────────

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Estación con la distancia (km) al punto de referencia. */
export type StationWithDistance = Station & { distanceKm: number };

// Rejilla de celdas de 0,1° para no recorrer las 11.000 estaciones en cada consulta.
const CELL = 0.1;
let grid: Map<string, Station[]> | null = null;

function cellKey(lat: number, lon: number): string {
  return `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;
}

function getGrid(): Map<string, Station[]> {
  if (grid) return grid;
  grid = new Map();
  for (const s of getStations()) push(grid, cellKey(s.lat, s.lon), s);
  return grid;
}

/** Estaciones a menos de `km` de un punto, ordenadas por distancia (como mucho `n`). */
export function stationsNear(lat: number, lon: number, km: number, n = Infinity): StationWithDistance[] {
  const g = getGrid();
  const dLat = km / 111.2;
  const dLon = km / (111.2 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const r0 = Math.floor((lat - dLat) / CELL);
  const r1 = Math.floor((lat + dLat) / CELL);
  const c0 = Math.floor((lon - dLon) / CELL);
  const c1 = Math.floor((lon + dLon) / CELL);
  const out: StationWithDistance[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      for (const s of g.get(`${r}:${c}`) ?? []) {
        const d = haversineKm(lat, lon, s.lat, s.lon);
        if (d <= km) out.push({ ...s, distanceKm: Math.round(d * 100) / 100 });
      }
    }
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id));
  return out.slice(0, n);
}

/** Las `n` estaciones más cercanas a `station` en un radio de `km` (sin incluirla a ella). */
export function nearbyStations(station: Station, km: number, n: number): StationWithDistance[] {
  return stationsNear(station.lat, station.lon, km, n + 1)
    .filter((s) => s.id !== station.id)
    .slice(0, n);
}

/**
 * Estaciones cercanas más baratas que `station` para un carburante, ordenadas por precio.
 * Útil para el bloque "gasolineras cercanas más baratas" de la ficha.
 */
export function cheaperNearby(station: Station, fuel: FuelKey, km: number, n: number): StationWithDistance[] {
  const own = station.prices[fuel];
  return stationsNear(station.lat, station.lon, km)
    .filter((s) => s.id !== station.id && typeof s.prices[fuel] === 'number' && (own === undefined || s.prices[fuel]! < own))
    .sort((a, b) => a.prices[fuel]! - b.prices[fuel]! || a.distanceKm - b.distanceKm)
    .slice(0, n);
}

let centroids: Map<string, { lat: number; lon: number }> | null = null;

/** Centro (media de coordenadas de sus estaciones) de un municipio. */
export function municipalityCenter(id: string): { lat: number; lon: number } | undefined {
  if (!centroids) {
    centroids = new Map();
    for (const [muniId, list] of load().stationsByMuni) {
      const lat = list.reduce((a, s) => a + s.lat, 0) / list.length;
      const lon = list.reduce((a, s) => a + s.lon, 0) / list.length;
      centroids.set(muniId, { lat, lon });
    }
  }
  return centroids.get(id);
}

/** Los `n` municipios más cercanos a otro (por el centro de sus estaciones), de cualquier provincia. */
export function nearbyMunicipalities(id: string, n: number): Array<Municipality & { distanceKm: number }> {
  const c = municipalityCenter(id);
  if (!c) return [];
  const out: Array<Municipality & { distanceKm: number }> = [];
  for (const m of getMunicipalities()) {
    if (m.id === id) continue;
    const o = municipalityCenter(m.id);
    if (!o) continue;
    out.push({ ...m, distanceKm: Math.round(haversineKm(c.lat, c.lon, o.lat, o.lon) * 10) / 10 });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm || byName(a, b)).slice(0, n);
}

// ─── Histórico y fecha ────────────────────────────────────────────────────────────────────────

let history: HistoryPoint[] | null = null;

/** Histórico diario (medianas nacionales y por provincia), ordenado por fecha ascendente. */
export function getHistory(): HistoryPoint[] {
  if (history) return history;
  history = existsSync(HISTORY_PATH) ? (JSON.parse(readFileSync(HISTORY_PATH, 'utf8')) as HistoryPoint[]) : [];
  history.sort((a, b) => a.date.localeCompare(b.date));
  return history;
}

/** Serie de una provincia para un carburante: [{ date, value }]. */
export function provinceHistory(provinceId: string, fuel: FuelKey): Array<{ date: string; value: number }> {
  return getHistory()
    .map((h) => ({ date: h.date, value: h.provinces[provinceId]?.[fuel] }))
    .filter((p): p is { date: string; value: number } => typeof p.value === 'number');
}

/** Serie nacional para un carburante: [{ date, value }]. */
export function nationalHistory(fuel: FuelKey): Array<{ date: string; value: number }> {
  return getHistory()
    .map((h) => ({ date: h.date, value: h.national[fuel] }))
    .filter((p): p is { date: string; value: number } => typeof p.value === 'number');
}

/** Fecha de los datos (campo "Fecha" de la API). */
export function getUpdatedAt(): Date {
  return new Date(getDataset().updatedAt);
}

/** Fecha de los datos formateada en hora peninsular: "26/10/2026, 0:18". */
export function formatUpdatedAt(date: Date = getUpdatedAt()): string {
  return date.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export { byName };
