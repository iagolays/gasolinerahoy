// Lista de informes, herramientas y páginas de contenido (para índices, menús y enlaces internos).

export interface LinkCard {
  path: string;
  title: string;
  summary: string;
}

export const REPORTS: readonly LinkCard[] = [
  {
    path: '/informes/precio-por-provincia/',
    title: 'Precio de la gasolina por provincias',
    summary: 'Ranking de las 52 provincias y diferencia en céntimos con la media de España.',
  },
  {
    path: '/informes/low-cost-vs-tradicionales/',
    title: 'Low cost frente a las grandes marcas',
    summary: 'Cuánto más baratas son de verdad las gasolineras low cost, en total y por provincia.',
  },
  {
    path: '/informes/cuanto-cuesta-llenar-el-deposito/',
    title: '¿Cuánto cuesta llenar el depósito hoy?',
    summary: 'Precio de 40, 50, 60 y 70 litros por carburante, y la diferencia según dónde repostes.',
  },
  {
    path: '/marcas/',
    title: 'Marcas de gasolineras más baratas',
    summary: 'Ranking de marcas por precio medio de hoy en la península.',
  },
];

export const TOOLS: readonly LinkCard[] = [
  {
    path: '/calculadora-gasolina/',
    title: 'Calculadora de gasolina',
    summary: 'Cuánto cuesta un viaje, cuánto gastas al mes y cuánto sale llenar el depósito.',
  },
  {
    path: '/compensa-desviarse/',
    title: '¿Compensa desviarse?',
    summary: 'Si merece la pena hacer kilómetros de más para repostar en una gasolinera más barata.',
  },
  {
    path: '/cerca/',
    title: 'Gasolineras cerca de mí',
    summary: 'Las más baratas a tu alrededor, con mapa.',
  },
];
