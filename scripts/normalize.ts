// Normalización de la respuesta de la API del Ministerio al contrato de src/lib/types.ts.
// Funciones puras (sin red ni disco) para poder probarlas con vitest.
import type { Dataset, FuelKey, HistoryPoint, Municipality, Prices, Province, Station } from '../src/lib/types';
import { FUELS, FUEL_ORDER } from '../src/lib/fuels';
import { GENERIC_BRAND, brandSlug, placeName, slugify, titleCase } from '../src/lib/slug';
import { statsFor } from '../src/lib/data';
import type { MinStationRow, StationsMin } from '../src/lib/stations-min';

/** Una estación tal como llega en ListaEESSPrecio (solo tipamos lo que usamos). */
export type RawStation = Record<string, string | undefined>;

export interface RawResponse {
  Fecha: string;
  ListaEESSPrecio: RawStation[];
  ResultadoConsulta?: string;
  Nota?: string;
}

// ─── Números y fechas ─────────────────────────────────────────────────────────────────────────

/** "1,829" → 1.829; "" o basura → undefined. */
export function parseNum(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const t = value.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Precio válido (> 0 y razonable) o undefined. */
export function parsePrice(value: string | undefined): number | undefined {
  const n = parseNum(value);
  if (n === undefined || n <= 0 || n > 20) return undefined;
  return Math.round(n * 1000) / 1000;
}

/** Desfase (en minutos) de Europe/Madrid respecto a UTC en un instante dado. */
function madridOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' })
    .formatToParts(new Date(utcMs))
    .find((p) => p.type === 'timeZoneName')?.value; // "GMT+01:00"
  const m = parts?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/**
 * "26/10/2026 0:18:58" (hora peninsular) → "2026-10-26T00:18:58+01:00".
 * Lanza un error si el formato no es el esperado.
 */
export function parseApiDate(fecha: string): string {
  const m = fecha.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error(`Fecha de la API con formato inesperado: "${fecha}"`);
  const [, d, mo, y, h, mi, s = '0'] = m;
  const local = Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s);
  // Primera aproximación con el desfase de ese instante, y corrección (por el cambio de hora).
  let off = madridOffsetMinutes(local);
  off = madridOffsetMinutes(local - off * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${y}-${pad(+mo!)}-${pad(+d!)}T${pad(+h!)}:${mi}:${pad(+s)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Fecha AAAA-MM-DD en hora peninsular de un ISO. */
export function madridDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  );
}

// ─── Nombres ──────────────────────────────────────────────────────────────────────────────────

/** Provincias por IDProvincia: nombre bonito y slug estables (la API da "PALMAS (LAS)", "ARABA/ÁLAVA"…). */
export const PROVINCIAS: Record<string, { name: string; slug: string }> = {
  '01': { name: 'Álava', slug: 'alava' },
  '02': { name: 'Albacete', slug: 'albacete' },
  '03': { name: 'Alicante', slug: 'alicante' },
  '04': { name: 'Almería', slug: 'almeria' },
  '05': { name: 'Ávila', slug: 'avila' },
  '06': { name: 'Badajoz', slug: 'badajoz' },
  '07': { name: 'Illes Balears', slug: 'illes-balears' },
  '08': { name: 'Barcelona', slug: 'barcelona' },
  '09': { name: 'Burgos', slug: 'burgos' },
  '10': { name: 'Cáceres', slug: 'caceres' },
  '11': { name: 'Cádiz', slug: 'cadiz' },
  '12': { name: 'Castellón', slug: 'castellon' },
  '13': { name: 'Ciudad Real', slug: 'ciudad-real' },
  '14': { name: 'Córdoba', slug: 'cordoba' },
  '15': { name: 'A Coruña', slug: 'a-coruna' },
  '16': { name: 'Cuenca', slug: 'cuenca' },
  '17': { name: 'Girona', slug: 'girona' },
  '18': { name: 'Granada', slug: 'granada' },
  '19': { name: 'Guadalajara', slug: 'guadalajara' },
  '20': { name: 'Gipuzkoa', slug: 'gipuzkoa' },
  '21': { name: 'Huelva', slug: 'huelva' },
  '22': { name: 'Huesca', slug: 'huesca' },
  '23': { name: 'Jaén', slug: 'jaen' },
  '24': { name: 'León', slug: 'leon' },
  '25': { name: 'Lleida', slug: 'lleida' },
  '26': { name: 'La Rioja', slug: 'la-rioja' },
  '27': { name: 'Lugo', slug: 'lugo' },
  '28': { name: 'Madrid', slug: 'madrid' },
  '29': { name: 'Málaga', slug: 'malaga' },
  '30': { name: 'Murcia', slug: 'murcia' },
  '31': { name: 'Navarra', slug: 'navarra' },
  '32': { name: 'Ourense', slug: 'ourense' },
  '33': { name: 'Asturias', slug: 'asturias' },
  '34': { name: 'Palencia', slug: 'palencia' },
  '35': { name: 'Las Palmas', slug: 'las-palmas' },
  '36': { name: 'Pontevedra', slug: 'pontevedra' },
  '37': { name: 'Salamanca', slug: 'salamanca' },
  '38': { name: 'Santa Cruz de Tenerife', slug: 'santa-cruz-de-tenerife' },
  '39': { name: 'Cantabria', slug: 'cantabria' },
  '40': { name: 'Segovia', slug: 'segovia' },
  '41': { name: 'Sevilla', slug: 'sevilla' },
  '42': { name: 'Soria', slug: 'soria' },
  '43': { name: 'Tarragona', slug: 'tarragona' },
  '44': { name: 'Teruel', slug: 'teruel' },
  '45': { name: 'Toledo', slug: 'toledo' },
  '46': { name: 'Valencia', slug: 'valencia' },
  '47': { name: 'Valladolid', slug: 'valladolid' },
  '48': { name: 'Bizkaia', slug: 'bizkaia' },
  '49': { name: 'Zamora', slug: 'zamora' },
  '50': { name: 'Zaragoza', slug: 'zaragoza' },
  '51': { name: 'Ceuta', slug: 'ceuta' },
  '52': { name: 'Melilla', slug: 'melilla' },
};

/** Nombre de provincia: tabla fija o, si llega un ID desconocido, el de la API limpio ("VALENCIA / VALÈNCIA" → "Valencia"). */
export function provinceName(id: string, raw: string): { name: string; slug: string } {
  const known = PROVINCIAS[id];
  if (known) return known;
  const name = placeName(raw.split('/')[0]!.trim());
  return { name, slug: slugify(name) };
}

/** Marcas con una grafía especial (clave: rótulo en mayúsculas sin espacios sobrantes). */
const MARCAS: Record<string, string> = {
  BONAREA: 'bonÀrea',
  GASEXPRESS: 'GasExpress',
  'GM OIL': 'GM Oil',
  GMOIL: 'GM Oil',
  ESCLATOIL: 'EsclatOil',
  AUTONETOIL: 'AutoNetOil',
  EASYGAS: 'EasyGas',
  BEROIL: 'BerOil',
  MEROIL: 'Meroil',
  PETROCAT: 'Petrocat',
  'E.LECLERC': 'E.Leclerc',
  'AUTONET&OIL': 'AutoNet&Oil',
};

/** Prefijo "estación de servicio" en sus muchas grafías: "E.S.", "E.s", "EE.SS.", "EE SS"… */
const PREFIJO_ES = /^(?:E\.\s?S\.?|EE\.\s?SS\.?|EE\s?SS\b|E\.S)\s*/i;

/** Siglas conocidas que se dejan en mayúsculas. */
const SIGLAS = new Set(['BP', 'HAM', 'IDS', 'DST', 'MLC', 'BDMED', 'PCAN', 'ASC', 'TGT', 'GLP', 'GNC', 'E.S.', 'S.A.', 'S.L.', 'SL', 'SA', 'SAT', 'SCL', 'S.C.L.', 'S.COOP.', 'II', 'III']);

/** Rótulos que no son una marca: "SIN RÓTULO", "S/R", "NO TIENE", "-", "SIN ASIGNAR"… */
const SIN_ROTULO =
  /^(?:\(?sin r[oó]tulo\)?|no r[oó]tulo|s\/?r\.?|n\/?a|no|no hay|no tiene|sin marca|sin nombre|sin determinar|sin asignar|desconocido|si|es|e\.?s\.?|gasolinera|estaci[oó]n de servicio)$/i;

/** ¿El rótulo es basura? Vacío, sin letras ("12241", "-"), de un solo carácter ("M"), "24H" o "Nº 10.935". */
export function isJunkBrand(raw: string): boolean {
  const limpio = raw.replace(/["'«»“”]/g, '').replace(/\s+/g, ' ').trim();
  if (!limpio || SIN_ROTULO.test(limpio)) return true;
  if (/^n\s?[º°o.]\s*\d/i.test(limpio)) return true; // "Nº 10.935", "N. 7374"
  // Hace falta alguna letra y al menos dos caracteres alfanuméricos ("Q8" vale; "M" o "24H" no).
  const resto = limpio.replace(/\b\d+\s?H\b/gi, '').replace(/[^\p{L}\p{N}]/gu, '');
  return !/\p{L}/u.test(resto) || resto.length < 2;
}

/** Rótulo → marca normalizada: "REPSOL " → "Repsol", "BP" → "BP", "12241" o "SIN RÓTULO" → "Gasolinera independiente". */
export function normalizeBrand(raw: string | undefined): string {
  const limpio = (raw ?? '').replace(/["«»“”]/g, '').replace(/\s+/g, ' ').trim();
  if (isJunkBrand(limpio)) return GENERIC_BRAND;
  const upper = limpio.toLocaleUpperCase('es');
  const especial = MARCAS[upper];
  if (especial) return especial;
  const pref = limpio.match(PREFIJO_ES);
  if (pref && limpio.length > pref[0].length) {
    const resto = limpio.slice(pref[0].length);
    // "E.S. 2001" → genérica; "E.S. EL GORRION" → "E.S. El Gorrion"
    return isJunkBrand(resto) ? GENERIC_BRAND : `E.S. ${normalizeBrand(resto)}`;
  }
  return titleCase(limpio, { keepUpper: (w) => SIGLAS.has(w) || (w.length >= 2 && !/[AEIOUÁÉÍÓÚÜY]/.test(w.replace(/\./g, ''))) });
}

/** Abreviaturas de tipo de vía al principio de la dirección. */
const VIAS: Record<string, string> = {
  CL: 'Calle',
  'CL.': 'Calle',
  'C/': 'Calle',
  CR: 'Carretera',
  CARR: 'Carretera',
  'CARR.': 'Carretera',
  'CR.': 'Carretera',
  CTRA: 'Carretera',
  'CTRA.': 'Carretera',
  AV: 'Avenida',
  'AV.': 'Avenida',
  AVDA: 'Avenida',
  'AVDA.': 'Avenida',
  PG: 'Polígono',
  'PG.': 'Polígono',
  PZ: 'Plaza',
  PZA: 'Plaza',
  'PZA.': 'Plaza',
  PS: 'Paseo',
  'PS.': 'Paseo',
  RD: 'Ronda',
  UR: 'Urbanización',
  AU: 'Autovía',
};

/** Dirección en formato título: "AVDA. DE LOS TOREROS, S/N" → "Avenida de los Toreros, S/N". */
export function normalizeAddress(raw: string | undefined): string {
  const limpio = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return '';
  const [primera, ...resto] = limpio.split(' ');
  const primeraUp = primera!.toLocaleUpperCase('es');
  const via = VIAS[primeraUp] ?? Object.values(VIAS).find((v) => v.toLocaleUpperCase('es') === primeraUp);
  // "CR CTRA. LC-444" o "CARRETERA CTRA. LC-444" → "Carretera LC-444" (tipo de vía repetido)
  if (via && resto.length > 1 && VIAS[resto[0]!.toLocaleUpperCase('es')] === via) resto.shift();
  const texto = via && resto.length ? `${via} ${resto.join(' ')}` : limpio;
  return titleCase(texto, { keepUpper: (w) => w.length >= 2 && !/[AEIOUÁÉÍÓÚÜY]/.test(w.replace(/[./]/g, '')) && !/^(DE|DEL)$/.test(w) });
}

/** ¿Abre 24 horas todos los días? */
export function is24h(schedule: string): boolean {
  return /^L-D:\s*(24H|00:00-23:59|00:00-24:00)$/i.test(schedule.trim());
}

// ─── Construcción del dataset ─────────────────────────────────────────────────────────────────

export interface BuildResult {
  dataset: Dataset;
  /** Estaciones descartadas y por qué (para el resumen). */
  skipped: { restricted: number; badCoords: number; noPrices: number };
}

/** Normaliza la respuesta completa de la API. */
export function buildDataset(raw: RawResponse): BuildResult {
  const skipped = { restricted: 0, badCoords: 0, noPrices: 0 };
  const updatedAt = parseApiDate(raw.Fecha);

  const provinces = new Map<string, Province>();
  const munis = new Map<string, Municipality>();
  const stations: Station[] = [];

  for (const e of raw.ListaEESSPrecio) {
    if ((e['Tipo Venta'] ?? '').trim().toUpperCase() === 'R') {
      skipped.restricted++;
      continue;
    }
    const id = (e.IDEESS ?? '').trim();
    const provinceId = (e.IDProvincia ?? '').trim().padStart(2, '0');
    const municipalityId = (e.IDMunicipio ?? '').trim();
    const lat = parseNum(e.Latitud);
    const lon = parseNum(e['Longitud (WGS84)']);
    if (!id || !provinceId || !municipalityId) continue;
    if (lat === undefined || lon === undefined || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) {
      skipped.badCoords++;
      continue;
    }
    const prices: Prices = {};
    for (const fuel of FUEL_ORDER) {
      const p = parsePrice(e[FUELS[fuel].apiField]);
      if (p !== undefined) prices[fuel] = p;
    }
    if (!Object.keys(prices).length) {
      skipped.noPrices++;
      continue;
    }

    let prov = provinces.get(provinceId);
    if (!prov) {
      const { name, slug } = provinceName(provinceId, e.Provincia ?? provinceId);
      prov = { id: provinceId, slug, name, ccaaId: (e.IDCCAA ?? '').trim(), municipalityIds: [] };
      provinces.set(provinceId, prov);
    }
    let muni = munis.get(municipalityId);
    if (!muni) {
      const name = placeName(e.Municipio ?? '') || titleCase(e.Localidad ?? '') || municipalityId;
      muni = { id: municipalityId, slug: slugify(name.split('/')[0]!) || municipalityId, name, provinceId, stationIds: [] };
      munis.set(municipalityId, muni);
      prov.municipalityIds.push(municipalityId);
    }
    const brand = normalizeBrand(e['Rótulo']);
    const schedule = (e.Horario ?? '').replace(/\s+/g, ' ').trim();
    stations.push({
      id,
      slug: '', // se asigna al final, cuando el slug del municipio ya es definitivo
      brand,
      address: normalizeAddress(e['Dirección']),
      postalCode: (e['C.P.'] ?? '').trim(),
      locality: placeName(e.Localidad ?? '') || muni.name,
      municipalityId,
      provinceId,
      lat: Math.round(lat * 1e6) / 1e6,
      lon: Math.round(lon * 1e6) / 1e6,
      schedule,
      is24h: is24h(schedule),
      prices,
    });
  }

  // Slugs de municipio únicos dentro de cada provincia (si chocan, se añade el ID).
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');
  for (const prov of provinces.values()) {
    const list = prov.municipalityIds.map((id) => munis.get(id)!).sort(byName);
    const count = new Map<string, number>();
    for (const m of list) count.set(m.slug, (count.get(m.slug) ?? 0) + 1);
    for (const m of list) if (count.get(m.slug)! > 1) m.slug = `${m.slug}-${m.id}`;
    prov.municipalityIds = list.map((m) => m.id);
  }

  // Slugs de estación: `${slugMarca}-${slugMunicipio}-${id}` (únicos porque el IDEESS lo es).
  const provList = [...provinces.values()].sort(byName);
  const provOrder = new Map(provList.map((p, i) => [p.id, i]));
  const muniOrder = new Map<string, number>();
  for (const p of provList) p.municipalityIds.forEach((id, i) => muniOrder.set(id, i));
  for (const s of stations) {
    s.slug = `${brandSlug(s.brand)}-${munis.get(s.municipalityId)!.slug}-${slugify(s.id)}`;
  }
  stations.sort(
    (a, b) =>
      provOrder.get(a.provinceId)! - provOrder.get(b.provinceId)! ||
      muniOrder.get(a.municipalityId)! - muniOrder.get(b.municipalityId)! ||
      a.brand.localeCompare(b.brand, 'es') ||
      a.id.localeCompare(b.id, 'en', { numeric: true }),
  );
  for (const s of stations) munis.get(s.municipalityId)!.stationIds.push(s.id);

  const municipalities = provList.flatMap((p) => p.municipalityIds.map((id) => munis.get(id)!));
  return { dataset: { updatedAt, stations, municipalities, provinces: provList }, skipped };
}

// ─── Salidas derivadas ────────────────────────────────────────────────────────────────────────

/** Codifica el dataset en el formato compacto de stations.min.json (ver src/lib/data.ts). */
export function buildStationsMin(ds: Dataset): StationsMin {
  const p: StationsMin['p'] = ds.provinces.map((x) => [x.id, x.name, x.slug]);
  const provIndex = new Map(ds.provinces.map((x, i) => [x.id, i]));
  const m: StationsMin['m'] = ds.municipalities.map((x) => [x.name, x.slug, provIndex.get(x.provinceId)!]);
  const muniIndex = new Map(ds.municipalities.map((x, i) => [x.id, i]));
  const brandIndex = new Map<string, number>();
  const b: StationsMin['b'] = [];
  const s: MinStationRow[] = ds.stations.map((st) => {
    let bi = brandIndex.get(st.brand);
    if (bi === undefined) {
      bi = b.length;
      brandIndex.set(st.brand, bi);
      b.push([st.brand, brandSlug(st.brand)]);
    }
    const prices = FUEL_ORDER.map((f) => (st.prices[f] === undefined ? 0 : Math.round(st.prices[f]! * 1000)));
    // Quitamos los ceros finales: el decodificador trata las columnas que faltan como "no lo vende".
    while (prices.length && prices[prices.length - 1] === 0) prices.pop();
    return [
      Number(st.id),
      bi,
      muniIndex.get(st.municipalityId)!,
      Math.round(st.lat * 1e5),
      Math.round(st.lon * 1e5),
      st.is24h ? 1 : 0,
      ...prices,
    ];
  });
  return { v: 1, t: ds.updatedAt, f: [...FUEL_ORDER], p, m, b, s };
}

/** Punto del histórico (medianas) a partir del dataset. */
export function buildHistoryPoint(ds: Dataset): HistoryPoint {
  const medians = (list: Station[]) => {
    const out: Partial<Record<FuelKey, number>> = {};
    const st = statsFor(list);
    for (const f of FUEL_ORDER) if (st[f]) out[f] = st[f]!.median;
    return out;
  };
  const byProv = new Map<string, Station[]>();
  for (const s of ds.stations) {
    const l = byProv.get(s.provinceId);
    if (l) l.push(s);
    else byProv.set(s.provinceId, [s]);
  }
  const provinces: HistoryPoint['provinces'] = {};
  for (const p of ds.provinces) provinces[p.id] = medians(byProv.get(p.id) ?? []);
  return { date: madridDate(ds.updatedAt), national: medians(ds.stations), provinces };
}

/** Añade el punto al histórico si no hay ya uno de ese día. Devuelve el histórico ordenado y si cambió. */
export function mergeHistory(history: HistoryPoint[], point: HistoryPoint): { history: HistoryPoint[]; added: boolean } {
  if (history.some((h) => h.date === point.date)) return { history, added: false };
  const out = [...history, point].sort((a, b) => a.date.localeCompare(b.date));
  return { history: out, added: true };
}
