// Tipos para la hoja de estilos de Leaflet, que map.ts pide como URL en diferido.
declare module 'leaflet/dist/leaflet.css?url' {
  const href: string;
  export default href;
}
