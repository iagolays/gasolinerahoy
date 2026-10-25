// Isla del selector de carburante. El carburante activo vive en <html data-fuel>;
// el CSS oculta los [data-fuel-pane] que no coinciden. Se recuerda entre páginas.

export const FUEL_EVENT = 'rb:fuel';
const STORAGE_KEY = 'rb-fuel';

export function currentFuel(): string {
  return document.documentElement.dataset.fuel ?? 'gasolina95';
}

function syncButtons(fuel: string): void {
  for (const btn of document.querySelectorAll<HTMLElement>('[data-set-fuel]')) {
    const on = btn.dataset.setFuel === fuel;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

export function setFuel(fuel: string): void {
  const root = document.documentElement;
  if (root.dataset.fuel === fuel) return;
  root.dataset.fuel = fuel;
  try {
    localStorage.setItem(STORAGE_KEY, fuel);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
  syncButtons(fuel);
  document.dispatchEvent(new CustomEvent(FUEL_EVENT, { detail: fuel }));
}

export function initFuelTabs(): void {
  syncButtons(currentFuel());
  document.addEventListener('click', (ev) => {
    const target = ev.target as Element | null;
    const btn = target?.closest<HTMLElement>('[data-set-fuel]');
    if (btn?.dataset.setFuel) setFuel(btn.dataset.setFuel);
  });
}
