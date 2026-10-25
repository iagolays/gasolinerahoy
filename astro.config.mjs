// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE } from './src/site.config.ts';

// Páginas que no se incluyen en el sitemap (y que llevan noindex en su <Seo>).
// El 404 lo excluye ya la integración.
const NO_SITEMAP = ['/privacidad/', '/cookies/', '/aviso-legal/'];

// Fecha del build: los precios cambian cada hora, así que todas las páginas se
// consideran modificadas en cada despliegue.
const buildDate = new Date();

/**
 * Devuelve el item solo si su ruta empieza por `prefix` (para agrupar en chunks).
 * @param {string} prefix
 */
const byPrefix = (prefix) => (/** @type {{ url: string }} */ item) =>
  new URL(item.url).pathname.startsWith(prefix) ? item : undefined;

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      filter: (page) => !NO_SITEMAP.includes(new URL(page).pathname),
      lastmod: buildDate,
      // ~14.700 URLs: se reparten en varios sitemaps por tipo de página, enlazados desde
      // sitemap-index.xml. Cada archivo admite como mucho 50.000 URLs; con 10.000 hay margen.
      // Archivos: sitemap-gasolineras-0.xml, sitemap-gasolineras-1.xml, sitemap-provincias-0.xml
      // (provincias y municipios) y sitemap-pages-0.xml (portada, /cerca/, /acerca/...).
      entryLimit: 10000,
      chunks: {
        gasolineras: byPrefix('/gasolinera/'),
        provincias: byPrefix('/provincia/'),
      },
    }),
  ],
});
