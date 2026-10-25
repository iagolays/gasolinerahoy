import { describe, expect, it } from 'vitest';
import {
  buildDataset,
  buildHistoryPoint,
  buildStationsMin,
  is24h,
  isJunkBrand,
  madridDate,
  mergeHistory,
  normalizeAddress,
  normalizeBrand,
  parseApiDate,
  parseNum,
  parsePrice,
  type RawStation,
} from '../../scripts/normalize';
import { decodeStationsMin } from './stations-min';
import { GENERIC_BRAND, brandSlug } from './slug';

function raw(over: RawStation = {}): RawStation {
  return {
    IDEESS: '4375',
    'Rótulo': 'REPSOL ',
    'Dirección': 'AVENIDA CASTILLA LA MANCHA, 26',
    'C.P.': '02250',
    Localidad: 'ABENGIBRE',
    Municipio: 'Abengibre',
    IDMunicipio: '52',
    Provincia: 'ALBACETE',
    IDProvincia: '02',
    IDCCAA: '07',
    Latitud: '39,211417',
    'Longitud (WGS84)': '-1,539167',
    Horario: 'L-D: 24H',
    'Precio Gasolina 95 E5': '1,699',
    'Precio Gasoleo A': '1,829',
    'Precio Gasolina 98 E5': '',
    'Tipo Venta': 'P',
    ...over,
  };
}

describe('números y fechas', () => {
  it('parsea comas decimales y vacíos', () => {
    expect(parseNum('1,829')).toBe(1.829);
    expect(parseNum('-1,539167')).toBe(-1.539167);
    expect(parseNum('')).toBeUndefined();
    expect(parseNum('abc')).toBeUndefined();
    expect(parsePrice('0,000')).toBeUndefined();
    expect(parsePrice('1,2345')).toBe(1.235);
  });
  it('convierte la fecha peninsular a ISO con su desfase (invierno y verano)', () => {
    expect(parseApiDate('26/10/2026 0:18:58')).toBe('2026-10-26T00:18:58+01:00');
    expect(parseApiDate('15/07/2026 13:05:00')).toBe('2026-07-15T13:05:00+02:00');
    expect(new Date(parseApiDate('26/10/2026 0:18:58')).toISOString()).toBe('2026-10-25T23:18:58.000Z');
    expect(madridDate('2026-10-25T23:18:58.000Z')).toBe('2026-10-26');
    expect(() => parseApiDate('ayer')).toThrow();
  });
});

describe('marcas, direcciones y horarios', () => {
  it('normaliza marcas', () => {
    expect(normalizeBrand('REPSOL ')).toBe('Repsol');
    expect(normalizeBrand('BP')).toBe('BP');
    expect(normalizeBrand('Q8')).toBe('Q8');
    expect(normalizeBrand('BONAREA')).toBe('bonÀrea');
    expect(normalizeBrand('"BP"')).toBe('BP');
    expect(normalizeBrand('FAMILY  ENERGY')).toBe('Family Energy');
    expect(normalizeBrand('E.S. EL GORRION')).toBe('E.S. El Gorrion');
    expect(normalizeBrand('ESCLATOIL')).toBe('EsclatOil');
  });
  it('normaliza direcciones', () => {
    expect(normalizeAddress('AVDA. DE ESPAÑA, S/N')).toBe('Avenida de España, S/N');
    expect(normalizeAddress('CR N-322, 337,8')).toBe('Carretera N-322, 337,8');
    expect(normalizeAddress('CR CTRA. LC-444 KM. 2,7')).toBe('Carretera LC-444 km. 2,7');
    expect(normalizeAddress('CARRETERA CTRA. LC-444 KM. 2,7')).toBe('Carretera LC-444 km. 2,7');
    expect(normalizeAddress('CL PASEO DE LA CUBA, 15')).toBe('Calle Paseo de la Cuba, 15');
  });
  it('detecta 24 horas', () => {
    expect(is24h('L-D: 24H')).toBe(true);
    expect(is24h('L-D: 00:00-23:59')).toBe(true);
    expect(is24h('L-D: 06:00-22:00')).toBe(false);
    expect(is24h('L-V: 24H; S: 08:00-14:00')).toBe(false);
  });
});

describe('rótulos basura', () => {
  it.each(['12241', 'Nº 10.935', 'Nº 7374', '161100-09363', '', '  ', '-', '--', '.', 'S/R', 'SR', 'SIN RÓTULO', 'SIN ROTULO', '(SIN RÓTULO)',
    'NO ROTULO', 'NO TIENE', 'NO HAY', 'NO', 'SIN DETERMINAR', 'SIN ASIGNAR', 'M', '24H', 'E.S. 2001', 'ES', 'E.S.'])(
    '"%s" → marca genérica',
    (r) => {
      expect(normalizeBrand(r)).toBe(GENERIC_BRAND);
    },
  );
  it('no confunde marcas reales', () => {
    expect(isJunkBrand('BP')).toBe(false);
    expect(isJunkBrand('Q8')).toBe(false);
    expect(isJunkBrand('T9')).toBe(false);
    expect(isJunkBrand('NORPETROL')).toBe(false);
    expect(isJunkBrand('NOVAOIL')).toBe(false);
    expect(isJunkBrand('PK 11')).toBe(false);
  });
  it('el slug de la marca genérica es "gasolinera"', () => {
    expect(brandSlug(GENERIC_BRAND)).toBe('gasolinera');
    expect(brandSlug('Repsol')).toBe('repsol');
    const { dataset } = buildDataset({
      Fecha: '26/10/2026 0:18:58',
      ListaEESSPrecio: [raw({ IDEESS: '11849', 'Rótulo': '12241', Municipio: 'Camargo', IDMunicipio: '9', IDProvincia: '39' })],
    });
    expect(dataset.stations[0]).toMatchObject({ brand: GENERIC_BRAND, slug: 'gasolinera-camargo-11849' });
    expect(decodeStationsMin(buildStationsMin(dataset))[0]!.url).toBe('/gasolinera/gasolinera-camargo-11849/');
  });
});

describe('buildDataset', () => {
  const lista = [
    raw(),
    raw({ IDEESS: '1', 'Rótulo': 'BP', 'Precio Gasoleo A': '1,700', 'Precio Gasolina 95 E5': '' }),
    raw({ IDEESS: '2', 'Tipo Venta': 'R' }), // venta restringida: fuera
    raw({ IDEESS: '3', 'Precio Gasolina 95 E5': '', 'Precio Gasoleo A': '' }), // sin precios: fuera
    raw({ IDEESS: '4', Municipio: 'Palmas de Gran Canaria (Las)', IDMunicipio: '900', Provincia: 'PALMAS (LAS)', IDProvincia: '35', IDCCAA: '05' }),
    raw({ IDEESS: '5', Municipio: 'Roda (La)', IDMunicipio: '70' }),
    raw({ IDEESS: '6', Municipio: 'Roda', IDMunicipio: '71' }), // mismo slug que "La Roda"? no: "roda" ≠ "la-roda"
    raw({ IDEESS: '7', Municipio: 'La Roda', IDMunicipio: '72' }), // choca con "Roda (La)"
  ];
  const { dataset, skipped } = buildDataset({ Fecha: '26/10/2026 0:18:58', ListaEESSPrecio: lista });

  it('excluye venta restringida y estaciones sin precios', () => {
    expect(skipped.restricted).toBe(1);
    expect(skipped.noPrices).toBe(1);
    expect(dataset.stations.map((s) => s.id).sort()).toEqual(['1', '4', '4375', '5', '6', '7']);
  });
  it('rellena la estación con los tipos correctos', () => {
    const s = dataset.stations.find((x) => x.id === '4375')!;
    expect(s).toMatchObject({
      slug: 'repsol-abengibre-4375',
      brand: 'Repsol',
      address: 'Avenida Castilla la Mancha, 26',
      locality: 'Abengibre',
      provinceId: '02',
      municipalityId: '52',
      lat: 39.211417,
      lon: -1.539167,
      is24h: true,
      prices: { gasolina95: 1.699, diesel: 1.829 },
    });
    expect(s.prices.gasolina98).toBeUndefined();
  });
  it('da nombres y slugs bonitos a provincias y municipios', () => {
    const lp = dataset.provinces.find((p) => p.id === '35')!;
    expect(lp).toMatchObject({ name: 'Las Palmas', slug: 'las-palmas', ccaaId: '05' });
    const m = dataset.municipalities.find((x) => x.id === '900')!;
    expect(m).toMatchObject({ name: 'Las Palmas de Gran Canaria', slug: 'las-palmas-de-gran-canaria', provinceId: '35' });
  });
  it('hace únicos los slugs de municipio dentro de la provincia', () => {
    const slugs = dataset.municipalities.filter((m) => m.provinceId === '02').map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain('la-roda-70');
    expect(slugs).toContain('la-roda-72');
    expect(slugs).toContain('roda');
  });
  it('enlaza provincias, municipios y estaciones', () => {
    const alb = dataset.provinces.find((p) => p.id === '02')!;
    expect(alb.municipalityIds).toHaveLength(4);
    expect(dataset.municipalities.find((m) => m.id === '52')!.stationIds.sort()).toEqual(['1', '4375']);
    expect(dataset.updatedAt).toBe('2026-10-26T00:18:58+01:00');
  });
  it('codifica y decodifica stations.min.json sin perder datos', () => {
    const min = buildStationsMin(dataset);
    const decoded = decodeStationsMin(JSON.parse(JSON.stringify(min)));
    expect(decoded).toHaveLength(dataset.stations.length);
    for (const s of dataset.stations) {
      const d = decoded.find((x) => x.id === s.id)!;
      expect(d.url).toBe(`/gasolinera/${s.slug}/`);
      expect(d.prices).toEqual(s.prices);
      expect(d.lat).toBeCloseTo(s.lat, 4);
      expect(d.lon).toBeCloseTo(s.lon, 4);
      expect(d.is24h).toBe(s.is24h);
    }
  });
  it('genera el punto del histórico y no lo duplica', () => {
    const p = buildHistoryPoint(dataset);
    expect(p.date).toBe('2026-10-26');
    expect(p.national.diesel).toBe(1.829); // mediana de [1.7, 1.829 ×5]
    expect(p.provinces['35']).toEqual({ gasolina95: 1.699, diesel: 1.829 });
    const a = mergeHistory([], p);
    expect(a.added).toBe(true);
    const b = mergeHistory(a.history, { ...p, national: {} });
    expect(b.added).toBe(false);
    expect(b.history).toHaveLength(1);
    const c = mergeHistory(a.history, { ...p, date: '2026-10-25' });
    expect(c.history.map((h) => h.date)).toEqual(['2026-10-25', '2026-10-26']);
  });
});
