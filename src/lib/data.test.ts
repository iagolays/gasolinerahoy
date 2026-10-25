import { beforeAll, describe, expect, it } from 'vitest';
import type { Dataset, Prices, Station } from './types';
import {
  cheapest,
  cheaperNearby,
  getMunicipality,
  getMunicipalitiesOf,
  getProvince,
  getStation,
  getStationsOf,
  getStationsOfProvince,
  haversineKm,
  municipalityStats,
  nationalStats,
  nearbyMunicipalities,
  nearbyStations,
  pctDiff,
  provinceStats,
  setDataset,
  statsFor,
} from './data';

function st(id: string, municipalityId: string, provinceId: string, lat: number, lon: number, prices: Prices, brand = 'Repsol'): Station {
  return {
    id,
    slug: `${brand.toLowerCase()}-x-${id}`,
    brand,
    address: '',
    postalCode: '',
    locality: '',
    municipalityId,
    provinceId,
    lat,
    lon,
    schedule: '',
    is24h: false,
    prices,
  };
}

const stations = [
  st('1', 'm1', '28', 40.4168, -3.7038, { gasolina95: 1.5, diesel: 1.4 }), // Madrid centro
  st('2', 'm1', '28', 40.42, -3.7, { gasolina95: 1.6, diesel: 1.45 }, 'BP'), // a ~0,5 km
  st('3', 'm1', '28', 40.45, -3.69, { gasolina95: 1.4 }, 'Shell'), // a ~4 km
  st('4', 'm2', '28', 40.48, -3.36, { gasolina95: 1.7, diesel: 1.5, adblue: 0.9 }), // Alcalá, ~30 km
  st('5', 'm3', '08', 41.3874, 2.1686, { diesel: 1.6 }), // Barcelona
];

const dataset: Dataset = {
  updatedAt: '2026-10-26T00:18:58+01:00',
  stations,
  municipalities: [
    { id: 'm1', slug: 'madrid', name: 'Madrid', provinceId: '28', stationIds: ['1', '2', '3'] },
    { id: 'm2', slug: 'alcala-de-henares', name: 'Alcalá de Henares', provinceId: '28', stationIds: ['4'] },
    { id: 'm3', slug: 'barcelona', name: 'Barcelona', provinceId: '08', stationIds: ['5'] },
  ],
  provinces: [
    { id: '08', slug: 'barcelona', name: 'Barcelona', ccaaId: '09', municipalityIds: ['m3'] },
    { id: '28', slug: 'madrid', name: 'Madrid', ccaaId: '13', municipalityIds: ['m2', 'm1'] },
  ],
};

beforeAll(() => {
  setDataset(dataset);
});

describe('statsFor', () => {
  it('calcula min, max, media, mediana y recuento por carburante', () => {
    const s = statsFor(stations);
    expect(s.gasolina95).toEqual({ min: 1.4, max: 1.7, avg: 1.55, median: 1.55, count: 4 });
    expect(s.diesel).toEqual({ min: 1.4, max: 1.6, avg: 1.488, median: 1.475, count: 4 });
    expect(s.adblue).toEqual({ min: 0.9, max: 0.9, avg: 0.9, median: 0.9, count: 1 });
    expect(s.glp).toBeUndefined();
  });
  it('mediana con número impar y lista vacía', () => {
    expect(statsFor(stations.slice(0, 3)).gasolina95!.median).toBe(1.5);
    expect(statsFor([])).toEqual({});
  });
  it('estadísticas por ámbito (con caché)', () => {
    expect(nationalStats().diesel!.count).toBe(4);
    expect(provinceStats('28').diesel!.max).toBe(1.5);
    expect(municipalityStats('m1').gasolina95!.min).toBe(1.4);
    expect(provinceStats('99')).toEqual({});
    expect(nationalStats()).toBe(nationalStats());
  });
  it('pctDiff', () => {
    expect(pctDiff(1.829, 1.776)).toBe(3);
    expect(pctDiff(1.5, 1.6)).toBe(-6.3);
    expect(pctDiff(1, 0)).toBe(0);
  });
});

describe('consultas', () => {
  it('busca por slug e id', () => {
    expect(getProvince('madrid')?.id).toBe('28');
    expect(getProvince('nada')).toBeUndefined();
    expect(getMunicipality('madrid', 'alcala-de-henares')?.id).toBe('m2');
    expect(getMunicipality('barcelona', 'madrid')).toBeUndefined();
    expect(getMunicipalitiesOf('28').map((m) => m.id)).toEqual(['m2', 'm1']);
    expect(getStation('bp-x-2')?.id).toBe('2');
    expect(getStationsOf('m1')).toHaveLength(3);
    expect(getStationsOfProvince('28')).toHaveLength(4);
    expect(getStationsOf('nada')).toEqual([]);
  });
  it('cheapest ordena por precio y omite las que no venden', () => {
    expect(cheapest(stations, 'diesel', 10).map((s) => s.id)).toEqual(['1', '2', '4', '5']);
    expect(cheapest(stations, 'gasolina95', 2).map((s) => s.id)).toEqual(['3', '1']);
    expect(cheapest(stations, 'glp', 5)).toEqual([]);
  });
});

describe('distancias', () => {
  it('haversine', () => {
    expect(haversineKm(40.4168, -3.7038, 41.3874, 2.1686)).toBeCloseTo(505, -1);
    expect(haversineKm(1, 1, 1, 1)).toBe(0);
  });
  it('nearbyStations excluye la propia, respeta radio y orden', () => {
    const near = nearbyStations(stations[0]!, 10, 5);
    expect(near.map((s) => s.id)).toEqual(['2', '3']);
    expect(near[0]!.distanceKm).toBeLessThan(1);
    expect(nearbyStations(stations[0]!, 50, 1).map((s) => s.id)).toEqual(['2']);
    expect(nearbyStations(stations[0]!, 50, 10).map((s) => s.id)).toEqual(['2', '3', '4']);
  });
  it('cheaperNearby solo devuelve las más baratas', () => {
    expect(cheaperNearby(stations[1]!, 'gasolina95', 50, 5).map((s) => s.id)).toEqual(['3', '1']);
    expect(cheaperNearby(stations[0]!, 'diesel', 50, 5)).toEqual([]);
  });
  it('nearbyMunicipalities', () => {
    expect(nearbyMunicipalities('m1', 2).map((m) => m.id)).toEqual(['m2', 'm3']);
  });
});
