// Isla de mapas: carga Leaflet (y su CSS) solo cuando un mapa entra en pantalla.
// Los marcadores son etiquetas con el precio del carburante activo, coloreadas de
// verde (barato) a naranja (caro) dentro de las estaciones del propio mapa.
import type * as Leaflet from 'leaflet';
import { FUEL_EVENT, currentFuel } from './fuel';

export interface MarkerData {
  lat: number;
  lon: number;
  name: string;
  address: string;
  href: string;
  main: boolean;
  prices: Record<string, number>;
  /** Texto extra para la ventana emergente (p. ej. la distancia). */
  extra?: string;
}

type Row = [number, number, string, string, string, 0 | 1, ...number[]];
interface Payload {
  f: string[];
  z: number;
  m: Row[];
}

let leafletPromise: Promise<typeof Leaflet> | null = null;

/** Carga Leaflet una sola vez (con su hoja de estilos). */
export function loadLeaflet(): Promise<typeof Leaflet> {
  // El CSS se pide como URL y se inyecta a mano: así no bloquea el primer pintado de la página.
  leafletPromise ??= Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css?url').then((c) => loadCss(c.default))]).then(
    ([mod]) => {
      const m = mod as typeof Leaflet & { default?: typeof Leaflet };
      return m.default ?? m;
    },
  );
  return leafletPromise;
}

function loadCss(href: string): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.append(link);
  });
}

const priceFmt = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const FUEL_NAMES: Record<string, string> = {
  gasolina95: 'Gasolina 95',
  gasolina98: 'Gasolina 98',
  diesel: 'Diésel',
  dieselPremium: 'Diésel Premium',
  glp: 'GLP',
  gnc: 'GNC',
  adblue: 'AdBlue',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function popupHtml(m: MarkerData, fuels: string[]): string {
  const lines = fuels
    .filter((f) => m.prices[f])
    .map((f) => `<tr><th>${FUEL_NAMES[f] ?? f}</th><td>${priceFmt.format(m.prices[f]!)}</td></tr>`)
    .join('');
  return `<div class="rb-pop"><a href="${esc(m.href)}"><strong>${esc(m.name)}</strong></a>
    <div class="rb-pop-addr">${esc(m.address)}${m.extra ? ` · ${esc(m.extra)}` : ''}</div>
    ${lines ? `<table>${lines}</table>` : ''}
    <a class="rb-pop-link" href="${esc(m.href)}">Ver ficha →</a></div>`;
}

export interface MapHandle {
  map: Leaflet.Map;
  setMarkers(markers: MarkerData[], opts?: { fit?: boolean }): void;
}

/** Crea un mapa en `el` y devuelve un manejador para cambiar los marcadores. */
export async function createMap(el: HTMLElement, fuels: string[], maxZoom = 15): Promise<MapHandle> {
  const L = await loadLeaflet();
  el.replaceChildren();
  const map = L.map(el, { scrollWheelZoom: false, zoomControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  // La rueda solo hace zoom después de hacer clic en el mapa (para no secuestrar el scroll).
  map.once('focus', () => map.scrollWheelZoom.enable());

  const layer = L.layerGroup().addTo(map);
  let current: MarkerData[] = [];

  const draw = () => {
    layer.clearLayers();
    const fuel = currentFuel();
    const values = current.map((m) => m.prices[fuel]).filter((v): v is number => !!v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    for (const m of current) {
      const v = m.prices[fuel];
      let tone = 'none';
      if (v) {
        const t = max > min ? (v - min) / (max - min) : 0;
        tone = t < 0.34 ? 'low' : t < 0.67 ? 'mid' : 'high';
      }
      const label = v ? priceFmt.format(v) : '·';
      const icon = L.divIcon({
        className: '',
        html: `<span class="rb-pin rb-${tone}${m.main ? ' rb-main' : ''}">${label}</span>`,
        iconSize: undefined,
        iconAnchor: [0, 0],
      });
      L.marker([m.lat, m.lon], {
        icon,
        title: `${m.name}${v ? `: ${label} €` : ''}`,
        alt: m.name,
        zIndexOffset: m.main ? 1000 : v ? Math.round((1 - (max > min ? (v - min) / (max - min) : 0)) * 500) : 0,
      })
        .bindPopup(popupHtml(m, fuels))
        .addTo(layer);
    }
  };

  const handle: MapHandle = {
    map,
    setMarkers(markers, opts = { fit: true }) {
      current = markers;
      draw();
      if (opts.fit && markers.length) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lon] as [number, number]));
        map.fitBounds(bounds, { padding: [36, 36], maxZoom });
      }
    },
  };
  document.addEventListener(FUEL_EVENT, draw);
  map.setView([40.4, -3.7], 6);
  return handle;
}

function decode(p: Payload): MarkerData[] {
  return p.m.map((r) => {
    const prices: Record<string, number> = {};
    p.f.forEach((f, i) => {
      const v = r[6 + i] as number;
      if (v) prices[f] = v;
    });
    return { lat: r[0], lon: r[1], name: r[2], address: r[3], href: r[4], main: r[5] === 1, prices };
  });
}

/** Inicializa los mapas estáticos ([data-map] con su JSON dentro) cuando se ven. */
export function initMaps(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-map]');
  const start = (el: HTMLElement) => {
    const script = el.querySelector('script[type="application/json"]');
    if (!script?.textContent) return;
    const payload = JSON.parse(script.textContent) as Payload;
    createMap(el, payload.f, payload.z)
      .then((h) => h.setMarkers(decode(payload)))
      .catch(() => {
        el.textContent = 'No se ha podido cargar el mapa.';
      });
  };
  if (!('IntersectionObserver' in window)) {
    els.forEach(start);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        start(e.target as HTMLElement);
      }
    },
    { rootMargin: '300px' },
  );
  els.forEach((el) => io.observe(el));
}
