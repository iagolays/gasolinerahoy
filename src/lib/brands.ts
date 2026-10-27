// Marcas (rótulos) con página propia: agregados por marca y clasificación low cost / tradicional.
import type { Station, StatsByFuel } from './types';
import { getStations, statsFor } from './data';
import { GENERIC_BRAND, slugify } from './slug';

/** Mínimo de gasolineras para que una marca tenga página (por debajo es casi siempre un negocio local). */
export const MIN_BRAND_STATIONS = 10;

/**
 * Cadenas de bajo coste (sin tienda grande ni personal en pista o asociadas a supermercados).
 * El resto de marcas con página se consideran "tradicionales" o regionales.
 */
export const LOW_COST_BRANDS: ReadonlySet<string> = new Set([
  'Ballenoil',
  'Plenergy',
  'Petroprix',
  'Carrefour',
  'Alcampo',
  'EsclatOil',
  'bonÀrea',
  'GasExpress',
  'Eroski',
  'BerOil',
  'Meroil',
  'AutoNetOil',
  'EasyGas',
  'Costco',
]);

/** Grandes operadoras de toda la vida (las que tienen refinería o red nacional histórica). */
export const MAJOR_BRANDS: ReadonlySet<string> = new Set([
  'Repsol',
  'Moeve',
  'Cepsa',
  'Galp',
  'Shell',
  'BP',
  'Petronor',
  'Campsa',
]);

export type BrandKind = 'lowcost' | 'major' | 'other';

export interface Brand {
  name: string;
  slug: string;
  kind: BrandKind;
  stations: Station[];
  stats: StatsByFuel;
  /** Provincias con al menos una gasolinera de la marca. */
  provinceIds: string[];
}

export function brandKind(name: string): BrandKind {
  if (LOW_COST_BRANDS.has(name)) return 'lowcost';
  if (MAJOR_BRANDS.has(name)) return 'major';
  return 'other';
}

let cache: Brand[] | null = null;

/** Marcas con página, de más a menos gasolineras. */
export function getBrands(): Brand[] {
  if (cache) return cache;
  const groups = new Map<string, Station[]>();
  for (const s of getStations()) {
    if (s.brand === GENERIC_BRAND) continue;
    const list = groups.get(s.brand);
    if (list) list.push(s);
    else groups.set(s.brand, [s]);
  }
  const used = new Set<string>();
  cache = [...groups]
    .filter(([, list]) => list.length >= MIN_BRAND_STATIONS)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'es'))
    .map(([name, stations]) => {
      let slug = slugify(name) || 'marca';
      while (used.has(slug)) slug += '-2';
      used.add(slug);
      return {
        name,
        slug,
        kind: brandKind(name),
        stations,
        stats: statsFor(stations),
        provinceIds: [...new Set(stations.map((s) => s.provinceId))].sort(),
      };
    });
  return cache;
}

export function getBrand(slug: string): Brand | undefined {
  return getBrands().find((b) => b.slug === slug);
}

/** Ruta de la página de la marca, o `undefined` si la marca no tiene página. */
export function brandPathOf(name: string): string | undefined {
  const b = getBrands().find((x) => x.name === name);
  return b ? brandPath(b) : undefined;
}

export function brandPath(b: Pick<Brand, 'slug'>): string {
  return `/marca/${b.slug}/`;
}

/** Vacía la caché (para tests que cambian el dataset). */
export function resetBrands(): void {
  cache = null;
}
