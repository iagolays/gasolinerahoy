// Configuración global del sitio. Cambiar aquí el nombre y el dominio definitivos.
export const SITE = {
  name: 'GasolinerasYa',
  url: 'https://gasolinerasya.es', // comprado en OVHcloud el 2026-10-26
  lang: 'es-ES',
  description:
    'Precios de la gasolina y el diésel en todas las gasolineras de España, actualizados cada hora con datos oficiales del Ministerio.',
  // ID de editor de AdSense. Con él se carga adsbygoogle.js en todas las páginas (lo pide la revisión).
  // Vacío = sin AdSense.
  adsenseClient: 'ca-pub-1129354015553171',
  // Pintar los huecos de anuncio (<AdSlot>). Apagado hasta que AdSense apruebe el sitio,
  // para que durante la revisión no haya cajas vacías con la etiqueta «Publicidad».
  adSlots: false,
  dataSource: {
    name: 'Ministerio para la Transición Ecológica y el Reto Demográfico (Geoportal de Hidrocarburos)',
    url: 'https://geoportalgasolineras.es/',
    api: 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/',
  },
} as const;
