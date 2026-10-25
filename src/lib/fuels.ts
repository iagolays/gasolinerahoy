// Carburantes que mostramos: etiquetas, unidades y el campo de la API del que salen.
import type { FuelKey } from './types';

export interface FuelInfo {
  /** Nombre largo para títulos y textos: "Gasolina 95". */
  label: string;
  /** Nombre corto para pestañas y tablas: "G95". */
  short: string;
  /** Unidad del precio. */
  unit: '€/l' | '€/kg';
  /** Campo de la respuesta de la API del Ministerio. */
  apiField: string;
}

export const FUELS: Record<FuelKey, FuelInfo> = {
  gasolina95: { label: 'Gasolina 95', short: 'G95', unit: '€/l', apiField: 'Precio Gasolina 95 E5' },
  gasolina98: { label: 'Gasolina 98', short: 'G98', unit: '€/l', apiField: 'Precio Gasolina 98 E5' },
  diesel: { label: 'Diésel', short: 'Diésel', unit: '€/l', apiField: 'Precio Gasoleo A' },
  dieselPremium: { label: 'Diésel Premium', short: 'Diésel+', unit: '€/l', apiField: 'Precio Gasoleo Premium' },
  glp: { label: 'GLP (autogás)', short: 'GLP', unit: '€/l', apiField: 'Precio Gases licuados del petróleo' },
  gnc: { label: 'Gas natural (GNC)', short: 'GNC', unit: '€/kg', apiField: 'Precio Gas Natural Comprimido' },
  adblue: { label: 'AdBlue', short: 'AdBlue', unit: '€/l', apiField: 'Precio Adblue' },
};

/** Orden de presentación (y orden de las columnas de precio en stations.min.json). */
export const FUEL_ORDER: readonly FuelKey[] = [
  'gasolina95',
  'diesel',
  'gasolina98',
  'dieselPremium',
  'glp',
  'gnc',
  'adblue',
];

/** Carburantes principales (los que se destacan en portada y resúmenes). */
export const MAIN_FUELS: readonly FuelKey[] = ['gasolina95', 'diesel'];

export function isFuelKey(value: string): value is FuelKey {
  return Object.prototype.hasOwnProperty.call(FUELS, value);
}

/** Formatea un precio al estilo español: 1.829 → "1,829 €/l". */
export function formatPrice(value: number, fuel?: FuelKey): string {
  const n = value.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return fuel ? `${n} ${FUELS[fuel].unit}` : `${n} €`;
}
