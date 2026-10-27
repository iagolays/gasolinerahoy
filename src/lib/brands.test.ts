import { beforeAll, describe, expect, it } from 'vitest';
import type { Dataset, Station } from './types';
import { setDataset } from './data';
import { brandKind, brandPathOf, getBrand, getBrands, MIN_BRAND_STATIONS, resetBrands } from './brands';
import { GENERIC_BRAND } from './slug';

function st(id: string, brand: string, provinceId: string, g95: number): Station {
  return {
    id,
    slug: `x-${id}`,
    brand,
    address: '',
    postalCode: '',
    locality: '',
    municipalityId: `m${provinceId}`,
    provinceId,
    lat: 40,
    lon: -3,
    schedule: '',
    is24h: false,
    prices: { gasolina95: g95 },
  };
}

const stations: Station[] = [];
let n = 0;
const add = (brand: string, count: number, prov: string, price: number) => {
  for (let i = 0; i < count; i++) stations.push(st(String(++n), brand, prov, price));
};
add('Repsol', MIN_BRAND_STATIONS + 2, '28', 1.7);
add('bonÀrea', MIN_BRAND_STATIONS, '08', 1.5);
add('Pequeña', MIN_BRAND_STATIONS - 1, '28', 1.6);
add(GENERIC_BRAND, MIN_BRAND_STATIONS + 5, '28', 1.6);

const dataset: Dataset = { updatedAt: '2026-10-26T00:00:00+01:00', stations, municipalities: [], provinces: [] };

beforeAll(() => {
  setDataset(dataset);
  resetBrands();
});

describe('marcas', () => {
  it('solo incluye las que llegan al mínimo y nunca la genérica', () => {
    expect(getBrands().map((b) => b.name)).toEqual(['Repsol', 'bonÀrea']);
  });
  it('slug sin tildes, estadísticas y provincias', () => {
    const b = getBrand('bonarea')!;
    expect(b.stats.gasolina95!.avg).toBe(1.5);
    expect(b.provinceIds).toEqual(['08']);
    expect(brandPathOf('Repsol')).toBe('/marca/repsol/');
    expect(brandPathOf('Pequeña')).toBeUndefined();
  });
  it('clasifica low cost y tradicionales', () => {
    expect(brandKind('Ballenoil')).toBe('lowcost');
    expect(brandKind('Repsol')).toBe('major');
    expect(brandKind('Avia')).toBe('other');
  });
});
