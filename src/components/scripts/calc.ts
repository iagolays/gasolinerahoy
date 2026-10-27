// Calculadoras (en el navegador): coste de viaje/depósito y "¿compensa desviarse?".

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const num1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const num3 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
/** Valor numérico de un input (admite coma decimal). Vacío o inválido → NaN. */
function val(id: string): number {
  const el = $<HTMLInputElement>(id);
  if (!el || el.value.trim() === '') return NaN;
  return Number(el.value.replace(',', '.'));
}
function set(id: string, text: string): void {
  const el = $(id);
  if (el) el.textContent = text;
}
const ok = (...ns: number[]) => ns.every((n) => Number.isFinite(n) && n >= 0);

export function initCalculator(): void {
  const form = $<HTMLFormElement>('calc');
  if (!form) return;
  const avgs = JSON.parse(form.dataset.avgs ?? '{}') as Record<string, Record<string, number>>;
  const fuel = $<HTMLSelectElement>('c-fuel')!;
  const prov = $<HTMLSelectElement>('c-prov')!;
  const priceInput = $<HTMLInputElement>('c-price')!;

  function fillPrice(): void {
    const p = avgs[prov.value]?.[fuel.value] ?? avgs['']?.[fuel.value];
    if (p) priceInput.value = p.toFixed(3);
  }

  function update(): void {
    const price = val('c-price');
    const cons = val('c-cons');
    const kmOne = val('c-km');
    const km = kmOne * (($<HTMLInputElement>('c-rt')?.checked ?? false) ? 2 : 1);
    const pax = Math.max(1, Math.round(val('c-pax')) || 1);
    const tolls = val('c-tolls') || 0;

    if (ok(price, cons, km)) {
      const liters = (km * cons) / 100;
      const total = liters * price + tolls;
      set('r-trip', eur.format(total));
      set('r-pax', eur.format(total / pax));
      set('r-liters', `${num1.format(liters)} l`);
      set('r-km', km > 0 ? `${num3.format(total / km)} €` : '—');
      set('r-100', eur.format(cons * price));
    } else {
      for (const id of ['r-trip', 'r-pax', 'r-liters', 'r-km', 'r-100']) set(id, '—');
    }

    const tank = val('c-tank');
    const month = val('c-month');
    set('r-tank', ok(tank, price) ? eur.format(tank * price) : '—');
    set('r-range', ok(tank, cons) && cons > 0 ? `${num1.format((tank / cons) * 100)} km` : '—');
    if (ok(month, cons, price)) {
      const m = ((month * cons) / 100) * price;
      set('r-month', eur.format(m));
      set('r-year', eur.format(m * 12));
    } else {
      set('r-month', '—');
      set('r-year', '—');
    }
  }

  // Si el usuario usa ya otro carburante en la web, lo preseleccionamos.
  try {
    const saved = localStorage.getItem('rb-fuel');
    if (saved && [...fuel.options].some((o) => o.value === saved)) fuel.value = saved;
  } catch {}
  fillPrice();
  fuel.addEventListener('change', () => { fillPrice(); update(); });
  prov.addEventListener('change', () => { fillPrice(); update(); });
  form.addEventListener('input', update);
  update();
}

export function initDetour(): void {
  const form = $<HTMLFormElement>('detour');
  if (!form) return;
  function update(): void {
    const near = val('d-near');
    const far = val('d-far');
    const liters = val('d-liters');
    const km = val('d-km');
    const cons = val('d-cons');
    if (!ok(near, far, liters, km, cons)) {
      for (const id of ['d-verdict', 'd-save', 'd-cost', 'd-max']) set(id, '—');
      return;
    }
    const save = liters * (near - far);
    const costPerKm = (cons / 100) * far;
    const cost = km * costPerKm;
    const net = save - cost;
    set('d-save', eur.format(save));
    set('d-cost', eur.format(cost));
    set('d-max', save > 0 && costPerKm > 0 ? `${num1.format(save / costPerKm)} km de más` : 'no compensa');
    const verdict = $('d-verdict')!;
    if (save <= 0) verdict.textContent = 'No compensa: la «barata» no es más barata';
    else if (net > 0) verdict.textContent = `Compensa: ganas ${eur.format(net)}`;
    else verdict.textContent = `No compensa: pierdes ${eur.format(-net)}`;
  }
  form.addEventListener('input', update);
  update();
}
