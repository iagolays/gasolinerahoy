// Helpers de datos estructurados (JSON-LD, schema.org) para pasar a <Seo jsonLd={...}>.
import { SITE } from '../../site.config';
import type { FuelKey, Station } from '../../lib/types';

type Ld = Record<string, unknown>;

/** URL absoluta a partir de una ruta del sitio ("/provincia/madrid/"). */
export function absUrl(path: string): string {
  return new URL(path, SITE.url).href;
}

// Nombres de carburante para los Offer. Se definen aquí (y no se importan de lib/fuels.ts)
// para que el SEO no dependa de cambios de etiquetas en la interfaz.
const FUEL_NAMES: Record<FuelKey, { name: string; unit: 'LTR' | 'KGM' }> = {
  gasolina95: { name: 'Gasolina 95 E5', unit: 'LTR' },
  gasolina98: { name: 'Gasolina 98 E5', unit: 'LTR' },
  diesel: { name: 'Gasóleo A (diésel)', unit: 'LTR' },
  dieselPremium: { name: 'Gasóleo Premium', unit: 'LTR' },
  glp: { name: 'GLP (autogás)', unit: 'LTR' },
  gnc: { name: 'Gas natural comprimido (GNC)', unit: 'KGM' },
  adblue: { name: 'AdBlue', unit: 'LTR' },
};

export interface GasStationLdContext {
  /** Ruta de la ficha, p. ej. "/gasolinera/repsol-madrid-1234/". */
  path?: string;
  /** Nombre bonito del municipio y de la provincia (Station solo trae los IDs). */
  municipality?: string;
  province?: string;
  /** Fecha de los precios (ISO 8601); se usa como validez de las ofertas. */
  updatedAt?: string;
}

/**
 * Ficha de una gasolinera como schema.org/GasStation.
 * schema.org no tiene un campo de "precio del carburante", así que cada precio va como
 * un Offer en `makesOffer` con un UnitPriceSpecification (€/litro o €/kg). Es lo más
 * razonable; Google no muestra resultados enriquecidos de precios de carburante, pero
 * los datos quedan bien descritos.
 */
export function gasStationLd(station: Station, ctx: GasStationLdContext = {}): Ld {
  const url = ctx.path ? absUrl(ctx.path) : absUrl(`/gasolinera/${station.slug}/`);
  const offers = (Object.entries(station.prices) as [FuelKey, number | undefined][])
    .filter(([key, price]) => typeof price === 'number' && FUEL_NAMES[key])
    .map(([key, price]) => {
      const fuel = FUEL_NAMES[key];
      const offer: Ld = {
        '@type': 'Offer',
        itemOffered: { '@type': 'Product', name: fuel.name },
        price: price!.toFixed(3),
        priceCurrency: 'EUR',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: price!.toFixed(3),
          priceCurrency: 'EUR',
          unitCode: fuel.unit,
          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: fuel.unit },
        },
      };
      if (ctx.updatedAt) offer.validFrom = ctx.updatedAt;
      return offer;
    });

  const ld: Ld = {
    '@context': 'https://schema.org',
    '@type': 'GasStation',
    '@id': `${url}#gasolinera`,
    name: ctx.municipality ? `${station.brand} (${ctx.municipality})` : station.brand,
    brand: { '@type': 'Brand', name: station.brand },
    url,
    address: {
      '@type': 'PostalAddress',
      streetAddress: station.address,
      postalCode: station.postalCode,
      addressLocality: station.locality || ctx.municipality,
      ...(ctx.province ? { addressRegion: ctx.province } : {}),
      addressCountry: 'ES',
    },
    geo: { '@type': 'GeoCoordinates', latitude: station.lat, longitude: station.lon },
    currenciesAccepted: 'EUR',
  };
  if (station.is24h) {
    ld.openingHoursSpecification = {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '00:00',
      closes: '23:59',
    };
  }
  if (offers.length) ld.makesOffer = offers;
  return ld;
}

export interface BreadcrumbItem {
  name: string;
  /** Ruta del sitio ("/provincia/madrid/"). */
  path: string;
}

/** Migas de pan. Pasar desde la portada hasta la página actual (incluida). */
export function breadcrumbLd(items: BreadcrumbItem[]): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absUrl(item.path),
    })),
  };
}

/** El sitio web (para la portada). Sin SearchAction: no hay búsqueda por URL. */
export function websiteLd(): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${absUrl('/')}#website`,
    name: SITE.name,
    url: absUrl('/'),
    description: SITE.description,
    inLanguage: SITE.lang,
  };
}

export interface ItemListEntry {
  name: string;
  path: string;
}

/** Lista ordenada de enlaces (ranking de gasolineras, municipios de una provincia...). */
export function itemListLd(name: string, items: ItemListEntry[]): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: absUrl(item.path),
    })),
  };
}

/** Dataset con atribución a la fuente oficial (útil en /acerca/ o en la portada). */
export function datasetLd(updatedAt?: string): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Precios de carburantes en las gasolineras de España',
    description: SITE.description,
    url: absUrl('/'),
    inLanguage: SITE.lang,
    isAccessibleForFree: true,
    ...(updatedAt ? { dateModified: updatedAt } : {}),
    spatialCoverage: { '@type': 'Place', name: 'España' },
    isBasedOn: SITE.dataSource.url,
    creator: { '@type': 'Organization', name: SITE.dataSource.name, url: SITE.dataSource.url },
  };
}
