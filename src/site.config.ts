// Configuración global del sitio. Cambiar aquí el nombre y el dominio definitivos.
export const SITE = {
  name: 'RepostaBarato',
  url: 'https://repostabarato.es', // provisional, sin dominio comprado
  lang: 'es-ES',
  description:
    'Precios de la gasolina y el diésel en todas las gasolineras de España, actualizados cada hora con datos oficiales del Ministerio.',
  // Rellenar cuando AdSense apruebe el sitio (ca-pub-XXXXXXXXXXXXXXXX). Vacío = no se muestran anuncios.
  adsenseClient: '',
  dataSource: {
    name: 'Ministerio para la Transición Ecológica y el Reto Demográfico (Geoportal de Hidrocarburos)',
    url: 'https://geoportalgasolineras.es/',
    api: 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/',
  },
} as const;
