// Isla de tablas ordenables ([data-sort-table]). Ordena por nombre o por un carburante;
// las filas sin precio van siempre al final. Escucha también el cambio de carburante.
import { FUEL_EVENT, currentFuel } from './fuel';

type Dir = 'ascending' | 'descending';

function sortTable(wrap: HTMLElement, key: string, dir?: Dir): void {
  const table = wrap.querySelector('table');
  const tbody = table?.tBodies[0];
  if (!table || !tbody) return;
  const ths = Array.from(table.tHead?.rows[0]?.cells ?? []);
  const col = ths.findIndex((th) => th.querySelector<HTMLElement>('[data-sort-key]')?.dataset.sortKey === key);
  if (col < 0) return;
  const th = ths[col]!;
  // Si no se indica dirección, alterna respecto a la actual.
  const next: Dir = dir ?? (th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending');
  const mul = next === 'ascending' ? 1 : -1;

  const rows = Array.from(tbody.rows);
  const value = (tr: HTMLTableRowElement): number | string | null => {
    if (key === 'name') return tr.dataset.name ?? '';
    const v = tr.cells[col]?.dataset.v;
    return v ? Number(v) : null;
  };
  rows.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb), 'es') * mul;
    return (va - vb) * mul;
  });
  tbody.append(...rows);
  for (const t of ths) t.setAttribute('aria-sort', t === th ? next : 'none');
}

export function initSortTables(): void {
  const tables = document.querySelectorAll<HTMLElement>('[data-sort-table]');
  for (const wrap of tables) {
    wrap.addEventListener('click', (ev) => {
      const btn = (ev.target as Element | null)?.closest<HTMLElement>('[data-sort-key]');
      if (btn?.dataset.sortKey) sortTable(wrap, btn.dataset.sortKey);
    });
    // Si el carburante guardado no es el de por defecto, reordena al cargar.
    sortTable(wrap, currentFuel(), 'ascending');
  }
  document.addEventListener(FUEL_EVENT, () => {
    for (const wrap of tables) sortTable(wrap, currentFuel(), 'ascending');
  });
}
