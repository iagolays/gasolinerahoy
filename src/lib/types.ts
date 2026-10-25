// Contrato de datos compartido entre el pipeline (scripts/) y las páginas (src/pages).
// Si cambias algo aquí, avisa: lo usan todos los módulos.

/** Carburantes que mostramos. La clave es estable y se usa en URLs y JSON. */
export type FuelKey =
  | 'gasolina95'   // "Precio Gasolina 95 E5"
  | 'gasolina98'   // "Precio Gasolina 98 E5"
  | 'diesel'       // "Precio Gasoleo A"
  | 'dieselPremium'// "Precio Gasoleo Premium"
  | 'glp'          // "Precio Gases licuados del petróleo"
  | 'gnc'          // "Precio Gas Natural Comprimido"
  | 'adblue';      // "Precio Adblue"

/** Precios en €/litro (o €/kg en gas). Solo se incluyen los carburantes que vende. */
export type Prices = Partial<Record<FuelKey, number>>;

export interface Station {
  id: string;            // IDEESS
  slug: string;          // único: `${slugMarca}-${slugMunicipio}-${id}`
  brand: string;         // Rótulo normalizado (p. ej. "Repsol", "Ballenoil")
  address: string;       // Dirección en formato título
  postalCode: string;
  locality: string;
  municipalityId: string; // IDMunicipio
  provinceId: string;     // IDProvincia (2 dígitos)
  lat: number;
  lon: number;
  schedule: string;       // Horario tal cual ("L-D: 24H")
  is24h: boolean;
  prices: Prices;
}

export interface Municipality {
  id: string;
  slug: string;           // único dentro de la provincia
  name: string;
  provinceId: string;
  stationIds: string[];
}

export interface Province {
  id: string;
  slug: string;           // "madrid", "a-coruna", "santa-cruz-de-tenerife"
  name: string;           // nombre bonito: "A Coruña"
  ccaaId: string;
  municipalityIds: string[];
}

/** Estadísticas por ámbito (España, provincia o municipio) y carburante. */
export interface FuelStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  count: number;
}
export type StatsByFuel = Partial<Record<FuelKey, FuelStats>>;

/** Un punto del histórico diario. Se guarda en data/history/*.json (versionado en git). */
export interface HistoryPoint {
  date: string; // AAAA-MM-DD
  national: Partial<Record<FuelKey, number>>;            // mediana nacional
  provinces: Record<string, Partial<Record<FuelKey, number>>>; // mediana por provincia
}

export interface Dataset {
  updatedAt: string; // ISO 8601, a partir del campo "Fecha" de la API (hora peninsular)
  stations: Station[];
  municipalities: Municipality[];
  provinces: Province[];
}
