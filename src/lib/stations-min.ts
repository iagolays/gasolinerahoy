// Formato compacto de public/data/stations.min.json (documentado en src/lib/data.ts).
// Puro, sin Node: lo usan scripts/fetch-data.ts (para codificar) y el JS de cliente (para decodificar).
import type { FuelKey, Prices } from './types';

/** Fila de estación: [id, marca, municipio, lat×1e5, lon×1e5, 24h, ...precios en milésimas]. */
export type MinStationRow = [number, number, number, number, number, 0 | 1, ...number[]];

/** Columna donde empiezan los precios en cada fila. */
export const PRICE_COL = 6;

export interface StationsMin {
  v: 1;
  t: string;
  f: FuelKey[];
  p: Array<[id: string, name: string, slug: string]>;
  m: Array<[name: string, slug: string, provinceIndex: number]>;
  b: Array<[name: string, slug: string]>;
  s: MinStationRow[];
}

/** Estación ya decodificada en el cliente. */
export interface ClientStation {
  id: string;
  brand: string;
  municipality: string;
  province: string;
  provinceId: string;
  lat: number;
  lon: number;
  is24h: boolean;
  prices: Prices;
  /** Ruta de la ficha: "/gasolinera/repsol-abengibre-4375/". */
  url: string;
  /** Ruta del municipio: "/provincia/albacete/abengibre/". */
  municipalityUrl: string;
}

/** Decodifica el JSON compacto a una lista de estaciones. */
export function decodeStationsMin(data: StationsMin): ClientStation[] {
  return data.s.map((row) => {
    const [id, bi, mi, lat, lon, h24] = row;
    const [brand, brandSlug] = data.b[bi]!;
    const [muniName, muniSlug, pi] = data.m[mi]!;
    const [provId, provName, provSlug] = data.p[pi]!;
    const prices: Prices = {};
    data.f.forEach((fuel, i) => {
      const v = row[PRICE_COL + i] as number | undefined;
      if (v) prices[fuel] = v / 1000;
    });
    return {
      id: String(id),
      brand,
      municipality: muniName,
      province: provName,
      provinceId: provId,
      lat: lat / 1e5,
      lon: lon / 1e5,
      is24h: h24 === 1,
      prices,
      url: `/gasolinera/${brandSlug}-${muniSlug}-${id}/`,
      municipalityUrl: `/provincia/${provSlug}/${muniSlug}/`,
    };
  });
}
