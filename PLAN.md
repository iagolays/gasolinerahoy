# Plan de trabajo — RepostaBarato

Web estática (Astro 7) con los precios de todas las gasolineras de España. Los datos salen de la API oficial del Ministerio, se regeneran cada hora (GitHub Actions) y se publican en Cloudflare Pages. Se monetiza con AdSense.

Nombre y dominio provisionales: se cambian solo en `src/site.config.ts`.

## Datos de partida (API, 2026-10-26)
- `GET https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/` con `Accept: application/json` (~12 MB).
- Respuesta: `{ Fecha: "26/10/2026 0:18:58", ListaEESSPrecio: [...], ResultadoConsulta: "OK" }`.
- 11.380 estaciones, 3.224 municipios, 52 provincias.
- Los números vienen como strings con coma decimal (`"1,829"`, `"39,211417"`), y `""` significa que no vende ese carburante.
- Campos útiles: `IDEESS`, `Rótulo`, `Dirección`, `C.P.`, `Localidad`, `Municipio`, `IDMunicipio`, `Provincia`, `IDProvincia`, `IDCCAA`, `Latitud`, `Longitud (WGS84)`, `Horario`, `Precio Gasolina 95 E5`, `Precio Gasolina 98 E5`, `Precio Gasoleo A`, `Precio Gasoleo Premium`, `Precio Gases licuados del petróleo`, `Precio Gas Natural Comprimido`, `Precio Adblue`, `Tipo Venta` (P = público, R = restringido: **excluir las R**).
- La API a veces da 503. Hay que reintentar y, si sigue fallando, no romper el build: se reutiliza la última descarga buena.

## Contrato compartido (ya existe, no cambiar sin avisar)
- `src/site.config.ts`: nombre, URL, cliente de AdSense, fuente de datos.
- `src/lib/types.ts`: `Station`, `Municipality`, `Province`, `FuelKey`, `Prices`, `FuelStats`, `HistoryPoint`, `Dataset`.

## Rutas (todas estáticas, `trailingSlash: 'always'`)
| Ruta | Contenido |
|---|---|
| `/` | Medias nacionales por carburante, las más baratas de España, buscador de municipio, botón "cerca de mí", lista de provincias |
| `/provincia/[prov]/` | Estadísticas, ranking de las más baratas por carburante, lista de municipios, gráfico del histórico |
| `/provincia/[prov]/[muni]/` | Tabla de gasolineras ordenable por carburante, mapa, estadísticas, municipios cercanos |
| `/gasolinera/[slug]/` | Precios, comparación con la media del municipio y la provincia, dirección, horario, mapa, gasolineras cercanas más baratas |
| `/cerca/` | Búsqueda por geolocalización (JS en cliente sobre `stations.min.json`) con mapa |
| `/privacidad/`, `/cookies/`, `/aviso-legal/`, `/acerca/` | Páginas legales e informativas |

En total salen unos 14.700 HTML. Cloudflare Pages tiene un límite de 20.000 archivos por despliegue: **no crear más páginas por combinación** (p. ej. una por carburante y municipio). Los carburantes se cambian en cliente con pestañas o selector.

## Reparto (cada agente toca SOLO sus archivos)

### A — Datos (`scripts/`, `src/lib/data.ts`, `src/lib/fuels.ts`, `src/lib/slug.ts`, `src/lib/*.test.ts`, `data/`)
- `scripts/fetch-data.ts` (`npm run data`): descarga (reintentos y caché en `data/raw/latest.json`), normaliza y escribe:
  - `src/data/generated/dataset.json` (`Dataset`)
  - `public/data/stations.min.json`: formato compacto para el cliente, documentado en `data.ts`, lo más pequeño posible (gzip).
  - Añade el punto del día a `data/history/history.json` (`HistoryPoint[]`) si no existe ya; ese archivo se versiona en git.
  - Opción `--offline` para usar `data/raw/latest.json` sin red.
- `src/lib/fuels.ts`: `FUELS: Record<FuelKey, { label, short, unit, apiField }>` y `FUEL_ORDER`.
- `src/lib/slug.ts`: slugify (tildes, ñ, "A Coruña"/"Coruña (A)" → "a-coruna"; la API da nombres como "Palmas (Las)" → mostrar "Las Palmas").
- `src/lib/data.ts`: **API para las páginas. Implementarla PRIMERO, que B depende de ella.**
  - `getDataset()`, `getProvinces()`, `getProvince(slug)`, `getMunicipalitiesOf(provinceId)`, `getMunicipality(provSlug, muniSlug)`, `getStation(slug)`, `getStationsOf(municipalityId)`, `getStationsOfProvince(provinceId)`
  - `statsFor(stations): StatsByFuel`, `nationalStats()`, `provinceStats(id)`, `municipalityStats(id)`
  - `cheapest(stations, fuel, n)`, `nearbyStations(station, km, n)` (haversine)
  - `getHistory(): HistoryPoint[]`, `getUpdatedAt(): Date`
  - Todo con caché en memoria (el build llama miles de veces).
- Tests con vitest de la normalización, los slugs y las estadísticas.

### B — Páginas e interfaz (`src/pages/index.astro`, `src/pages/provincia/**`, `src/pages/gasolinera/**`, `src/pages/cerca.astro`, `src/layouts/`, `src/components/` salvo `seo/` y `ads/`, `src/styles/`, `public/` salvo `public/data/`, `ads.txt` y `robots.txt`)
- `src/layouts/Base.astro`: cabecera, migas de pan, pie (con la atribución a la fuente de datos y enlaces legales) e incluye `<Seo>` de C en el `<head>`.
- Diseño propio, limpio y rápido, en móvil primero, con modo oscuro. CSS propio sin frameworks y casi sin JS (solo islas pequeñas: pestañas, ordenar tablas, mapa, cerca de mí).
- **No debe parecer una web oficial del Gobierno**: nada de escudos ni colores institucionales.
- Mapas con Leaflet y teselas de OSM (atribución obligatoria), cargados solo en cliente.
- Gráfico del histórico en SVG hecho a mano (sin librerías).
- Huecos de anuncios con `<AdSlot>` de C: uno arriba, uno entre bloques de contenido y uno al final, sin abusar.
- Texto útil y único en cada página, generado a partir de los datos (p. ej. "En Abengibre hay 1 gasolinera; el diésel más barato está a 1,829 €/l, un 3 % más que la media de Albacete"). Es lo que evita el "contenido de poco valor".

### C — SEO, legal, anuncios y despliegue (`src/components/seo/`, `src/components/ads/`, `src/pages/privacidad.astro`, `cookies.astro`, `aviso-legal.astro`, `acerca.astro`, `404.astro`, `astro.config.mjs`, `public/robots.txt`, `public/ads.txt`, `public/_headers`, `.github/`, `README.md`, `wrangler.toml`)
- `src/components/seo/Seo.astro`, props: `{ title: string; description: string; path: string; jsonLd?: object | object[]; noindex?: boolean; ogType?: string }`. Pinta title, meta, canonical, Open Graph, JSON-LD y el script de AdSense si `SITE.adsenseClient` no está vacío.
- `src/components/seo/schema.ts`: helpers JSON-LD (`gasStationLd(station)`, `breadcrumbLd(items)`, `websiteLd()`, `itemListLd(...)`).
- `src/components/ads/AdSlot.astro`, props: `{ position: 'top' | 'inline' | 'bottom' }` (no `slot`: es un atributo reservado de Astro). Si no hay cliente de AdSense no pinta nada (ni espacio). Si lo hay, reserva altura para evitar CLS.
- `astro.config.mjs`: `site`, `trailingSlash: 'always'`, `build.format: 'directory'`, integración de sitemap.
- Consentimiento: se usa la CMP de Google ("Privacidad y mensajes" de AdSense, certificada TCF). Documentar en el README cómo activarla. Las páginas legales tienen que ser coherentes con eso.
- Legales en español para un particular en España: aviso legal (LSSI), privacidad (RGPD), cookies. Datos del titular como marcadores `[NOMBRE]`, `[EMAIL]` y `[NIF]` para que el dueño los rellene. Aviso de que los precios son orientativos y de que la web **no es oficial**. Atribución y condiciones de reutilización de los datos (Ley 37/2007, datos.gob.es).
- `.github/workflows/deploy.yml`: cron cada hora (y `workflow_dispatch`): `npm ci` → `npm run data` → `npm run build` → despliegue en Cloudflare Pages con `cloudflare/wrangler-action` (secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`) → commit de `data/history/history.json` si cambió. Más un workflow de CI en PR/push (test + check + build).
- `public/_headers`: caché (HTML corta, assets largos, `stations.min.json` 1 h).
- README: qué es, comandos y una guía paso a paso para desplegar (Cloudflare, dominio, AdSense, CMP, Search Console).

### D — Revisión final (al terminar A, B y C)
Build completo con datos reales, tests, `astro check`, enlaces rotos, número de archivos (< 20.000), tamaño, rendimiento básico, SEO y que no haya CLS por los anuncios. Corrige lo que encuentre.

## Reglas comunes
- TypeScript estricto. Código y comentarios en español, como el resto del proyecto.
- No instalar dependencias nuevas sin necesidad real. Las comunes ya están instaladas: `leaflet`, `@astrojs/sitemap`, `tsx`, `vitest`.
- No hacer commits: los hace el coordinador.
- Datos de prueba sin red: `data/raw/latest.json` (lo crea A con la primera descarga).
