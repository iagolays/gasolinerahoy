// Isla de "cerca de mí": geolocaliza, busca en stations.min.json las gasolineras del radio
// elegido y las pinta en una lista ordenable (precio o distancia) y en un mapa.
import type { ClientStation } from '../../lib/stations-min';
import { FUEL_EVENT, currentFuel } from './fuel';
import { createMap, type MapHandle } from './map';
import { loadStations } from './stations';

type Near = ClientStation & { d: number };

const priceFmt = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const kmFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const UNITS: Record<string, string> = { gnc: '€/kg' };
const NAMES: Record<string, string> = {
  gasolina95: 'gasolina 95',
  gasolina98: 'gasolina 98',
  diesel: 'diésel',
  dieselPremium: 'diésel premium',
  glp: 'GLP',
  gnc: 'GNC',
  adblue: 'AdBlue',
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function initNear(root: HTMLElement): void {
  const btn = root.querySelector<HTMLButtonElement>('[data-locate]')!;
  const radiusSel = root.querySelector<HTMLSelectElement>('[data-radius]')!;
  const sortSel = root.querySelector<HTMLSelectElement>('[data-sort]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const list = root.querySelector<HTMLOListElement>('[data-results]')!;
  const mapEl = root.querySelector<HTMLElement>('[data-near-map]')!;
  const mapBox = mapEl.parentElement!;

  let pos: { lat: number; lon: number } | null = null;
  let all: ClientStation[] | null = null;
  let map: MapHandle | null = null;
  let lastIds = '';

  const render = async () => {
    if (!pos || !all) return;
    const fuel = currentFuel();
    const radius = Number(radiusSel.value);
    const near: Near[] = [];
    for (const s of all) {
      // Filtro rápido por caja antes de calcular la distancia exacta.
      if (Math.abs(s.lat - pos.lat) > radius / 110) continue;
      const d = haversine(pos.lat, pos.lon, s.lat, s.lon);
      if (d <= radius) near.push({ ...s, d });
    }
    const withFuel = near.filter((s) => s.prices[fuel as keyof typeof s.prices]);
    const price = (s: Near) => s.prices[fuel as keyof typeof s.prices]!;
    if (sortSel.value === 'distance') withFuel.sort((a, b) => a.d - b.d);
    else withFuel.sort((a, b) => price(a) - price(b) || a.d - b.d);
    const shown = withFuel.slice(0, 50);

    list.replaceChildren();
    if (!shown.length) {
      status.textContent = `No hay gasolineras con ${NAMES[fuel]} a menos de ${radius} km. Prueba con un radio mayor o con otro carburante.`;
    } else {
      const min = Math.min(...shown.map(price));
      const avg = withFuel.reduce((a, s) => a + price(s), 0) / withFuel.length;
      status.textContent = `${withFuel.length} gasolinera${withFuel.length === 1 ? '' : 's'} con ${NAMES[fuel]} a menos de ${radius} km${
        withFuel.length > 50 ? ' (mostramos 50)' : ''
      }. Precio medio: ${priceFmt.format(avg)} ${UNITS[fuel] ?? '€/l'}.`;
      shown.forEach((s, i) => {
        const li = el('li', 'rank-item');
        const v = price(s);
        li.append(el('span', 'rank-pos', String(i + 1)));
        const body = el('div', 'rank-body');
        const a = el('a', 'rank-name', s.brand);
        a.href = s.url;
        body.append(a, el("span", "rank-addr", `${s.municipality} · ${kmFmt.format(s.d)} km`));
        const pr = el('div', 'rank-price');
        const p = el('span', 'price', priceFmt.format(v));
        p.append(el('span', 'unit', UNITS[fuel] ?? '€/l'));
        pr.append(p);
        if (v === min) pr.append(el('span', 'delta good', 'La más barata'));
        else pr.append(el('span', 'delta bad', `+${kmFmt.format((v - min) * 100)} cts`));
        li.append(body, pr);
        list.append(li);
      });
    }

    // Mapa: se crea al tener resultados; solo se reencuadra si cambia el conjunto.
    mapBox.hidden = false;
    map ??= await createMap(mapEl, Object.keys(NAMES), 16);
    const ids = shown.map((s) => s.id).join(',');
    map.setMarkers(
      [
        ...shown.map((s) => ({
          lat: s.lat,
          lon: s.lon,
          name: s.brand,
          address: s.municipality,
          href: s.url,
          main: false,
          prices: s.prices as Record<string, number>,
          extra: `${kmFmt.format(s.d)} km`,
        })),
      ],
      { fit: ids !== lastIds },
    );
    if (!shown.length) map.map.setView([pos.lat, pos.lon], 12);
    lastIds = ids;
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      status.textContent = 'Tu navegador no permite obtener la ubicación. Busca tu municipio más abajo.';
      return;
    }
    btn.disabled = true;
    status.textContent = 'Obteniendo tu ubicación…';
    const stationsP = loadStations();
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        pos = { lat: p.coords.latitude, lon: p.coords.longitude };
        status.textContent = 'Buscando gasolineras…';
        try {
          all = await stationsP;
          await render();
          btn.textContent = 'Actualizar ubicación';
        } catch {
          status.textContent = 'No se han podido cargar los precios. Inténtalo de nuevo en un momento.';
        }
        btn.disabled = false;
      },
      (err) => {
        btn.disabled = false;
        status.textContent =
          err.code === err.PERMISSION_DENIED
            ? 'No has dado permiso para usar tu ubicación. Puedes activarlo en el navegador o buscar tu municipio más abajo.'
            : 'No se ha podido obtener tu ubicación. Inténtalo de nuevo o busca tu municipio más abajo.';
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  btn.addEventListener('click', locate);
  radiusSel.addEventListener('change', () => void render());
  sortSel.addEventListener('change', () => void render());
  document.addEventListener(FUEL_EVENT, () => void render());
}
