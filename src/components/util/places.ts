// Nombres y rutas del municipio y la provincia de una estación (Station solo trae los IDs).
import { getMunicipalityById, getProvinceById, municipalityPath, provincePath } from '../../lib/data';
import type { Station } from '../../lib/types';

export interface Place {
  municipality: string;
  municipalityPath: string;
  province: string;
  provincePath: string;
}

const cache = new Map<string, Place>();

export function placeOf(station: Pick<Station, 'municipalityId' | 'provinceId'>): Place {
  const key = station.municipalityId;
  let p = cache.get(key);
  if (!p) {
    const m = getMunicipalityById(station.municipalityId);
    const prov = getProvinceById(station.provinceId);
    p = {
      municipality: m?.name ?? '',
      municipalityPath: m ? municipalityPath(m) : '/',
      province: prov?.name ?? '',
      provincePath: prov ? provincePath(prov) : '/',
    };
    cache.set(key, p);
  }
  return p;
}
