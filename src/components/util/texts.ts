// Textos generados a partir de los datos: cada página tiene un resumen propio y útil.
import { FUELS, FUEL_ORDER } from '../../lib/fuels';
import type { FuelKey, StatsByFuel } from '../../lib/types';
import { int, joinList, pct, pctDiff, plural, price, tank } from './format';

/** Nombre del carburante para usar dentro de una frase: "gasolina 95", "diésel", "GLP". */
export function fuelName(f: FuelKey): string {
  const names: Record<FuelKey, string> = {
    gasolina95: 'gasolina 95',
    gasolina98: 'gasolina 98',
    diesel: 'diésel',
    dieselPremium: 'diésel premium',
    glp: 'GLP',
    gnc: 'gas natural (GNC)',
    adblue: 'AdBlue',
  };
  return names[f];
}

/** Con artículo: "la gasolina 95", "el diésel". */
export function theFuel(f: FuelKey): string {
  return `${f.startsWith('gasolina') ? 'la' : 'el'} ${fuelName(f)}`;
}

/** Primera letra en mayúscula. */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "1,829 €/l" */
export function priceU(v: number, f: FuelKey): string {
  return `${price(v)}\u00a0${FUELS[f].unit}`;
}

/** "un 3 % por encima de la media de Albacete" / "en la media de Albacete". */
export function vsAvg(value: number, ref: number, scope: string): string {
  const d = pctDiff(value, ref);
  if (Math.abs(d) < 0.5) return `prácticamente en la media de ${scope}`;
  return `un ${pct(d)} ${d > 0 ? 'por encima' : 'por debajo'} de la media de ${scope}`;
}

/** Diferencia en céntimos entre dos precios: "12,4 céntimos". */
export function cents(a: number, b: number): string {
  const c = Math.abs(a - b) * 100;
  if (c >= 100) return `${(c / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  return `${c.toLocaleString('es-ES', { maximumFractionDigits: 1 })} céntimos`;
}

/** Número ordinal abreviado: "3.ª" */
export function ord(n: number): string {
  return `${n}.ª`;
}

/** Carburantes con datos, en orden. */
export function fuelsIn(stats: StatsByFuel): FuelKey[] {
  return FUEL_ORDER.filter((f) => stats[f]);
}

/** Lista de medias por carburante: "la gasolina 95 a 1,699 €/l y el diésel a 1,589 €/l". */
export function avgList(stats: StatsByFuel, fuels: readonly FuelKey[] = ['gasolina95', 'diesel']): string {
  return joinList(fuels.filter((f) => stats[f]).map((f) => `${theFuel(f)} a ${priceU(stats[f]!.avg, f)}`));
}

/** Frase sobre el ahorro entre la más barata y la más cara de un ámbito. */
export function spreadSentence(stats: StatsByFuel, f: FuelKey, where: string): string {
  const s = stats[f];
  if (!s || s.count < 2 || s.max - s.min < 0.001) return '';
  return `Entre la gasolinera más barata y la más cara de ${where} hay ${cents(s.max, s.min)} por litro de ${fuelName(f)}: en un depósito de 50 litros son ${tank(s.max - s.min)} de diferencia.`;
}

/**
 * Precios para el <title>: "95 desde 1,529 €, diésel desde 1,639 €" (o "a" si es una sola gasolinera).
 * Vacío si no hay gasolina 95 ni diésel.
 */
export function titlePrices(values: Partial<Record<FuelKey, number>>, word: 'desde' | 'a' = 'desde'): string {
  const parts: string[] = [];
  if (values.gasolina95) parts.push(`95 ${word} ${price(values.gasolina95)} €`);
  if (values.diesel) parts.push(`diésel ${word} ${price(values.diesel)} €`);
  return parts.join(', ');
}

export { int, plural, pct, pctDiff, price, joinList };
