// Formato de números, precios, fechas y diferencias para las páginas.
// Todo en español de España. Sin dependencias.

const fmtPrice = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtInt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const fmtKm = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const fmtPct = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

/** 1.829 → "1,829" */
export function price(n: number): string {
  return fmtPrice.format(n);
}

/** 12345 → "12.345" (con separador de miles también en 4 cifras) */
export function int(n: number): string {
  const s = fmtInt.format(n);
  // es-ES no agrupa números de 4 cifras; los agrupamos para que se lean igual.
  if (Math.abs(n) >= 1000 && Math.abs(n) < 10000 && !s.includes('.')) {
    return s.replace(/^(-?\d)(\d{3})$/, '$1.$2');
  }
  return s;
}

export function km(n: number): string {
  return `${fmtKm.format(n)} km`;
}

/** Diferencia relativa en % de `value` respecto a `ref` (positivo = más caro). */
export function pctDiff(value: number, ref: number): number {
  if (!ref) return 0;
  return ((value - ref) / ref) * 100;
}

/** "3 %" con signo opcional. Redondea a 1 decimal si es menor de 10. */
export function pct(n: number, signed = false): string {
  const abs = Math.abs(n);
  const s = abs < 10 ? fmtPct.format(Math.round(abs * 10) / 10) : fmtInt.format(Math.round(abs));
  const sign = signed ? (n > 0.05 ? '+' : n < -0.05 ? '−' : '') : '';
  return `${sign}${s}\u00a0%`;
}

/** Clase CSS de una diferencia de precio: más barato = good. */
export function deltaClass(diffPct: number): 'good' | 'bad' | 'eq' {
  if (diffPct <= -0.5) return 'good';
  if (diffPct >= 0.5) return 'bad';
  return 'eq';
}

/** Cuánto cuesta llenar un depósito de `liters` litros. */
export function tank(pricePerUnit: number, liters = 50): string {
  const total = pricePerUnit * liters;
  if (total < 10) return `${total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  return `${fmtInt.format(Math.round(total))} €`;
}

const fmtDateTime = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const fmtDate = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const fmtShortDate = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short' });

/** "26 de octubre de 2026, 0:18" */
export function dateTime(d: Date): string {
  return fmtDateTime.format(d);
}
export function date(d: Date): string {
  return fmtDate.format(d);
}
/** "AAAA-MM-DD" → "26 oct" */
export function shortDay(iso: string): string {
  return fmtShortDate.format(new Date(`${iso}T12:00:00Z`)).replace('.', '');
}

/** "1 gasolinera" / "3 gasolineras" */
export function plural(n: number, one: string, many: string): string {
  return `${int(n)} ${n === 1 ? one : many}`;
}

/** Une una lista en español: "a, b y c". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}
