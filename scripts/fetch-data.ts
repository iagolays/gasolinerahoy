// Descarga los precios del Ministerio, los normaliza y genera los datos del sitio.
//
//   npm run data               → descarga (con reintentos) y, si falla, usa data/raw/latest.json
//   npm run data -- --offline  → usa data/raw/latest.json sin red
//
// Salidas:
//   src/data/generated/dataset.json   (Dataset, lo lee src/lib/data.ts en el build)
//   public/data/stations.min.json     (formato compacto para el cliente, ver src/lib/data.ts)
//   data/history/history.json         (se añade el punto del día si no existe)
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { SITE } from '../src/site.config';
import type { HistoryPoint } from '../src/lib/types';
import { buildDataset, buildHistoryPoint, buildStationsMin, mergeHistory, type RawResponse } from './normalize';

const ROOT = process.cwd();
const RAW_PATH = join(ROOT, 'data/raw/latest.json');
const DATASET_PATH = join(ROOT, 'src/data/generated/dataset.json');
const MIN_PATH = join(ROOT, 'public/data/stations.min.json');
const HISTORY_PATH = join(ROOT, 'data/history/history.json');

const MAX_INTENTOS = 5;
const TIMEOUT_MS = 90_000;
/** Por debajo de esto consideramos que la respuesta está incompleta. */
const MIN_ESTACIONES = 5_000;

const offline = process.argv.includes('--offline');

function log(msg: string): void {
  console.log(`[data] ${msg}`);
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Escribe de forma atómica (archivo temporal + rename) para no dejar JSON a medias. */
function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

function validar(raw: unknown): raw is RawResponse {
  const r = raw as Partial<RawResponse> | null;
  return (
    !!r &&
    typeof r.Fecha === 'string' &&
    Array.isArray(r.ListaEESSPrecio) &&
    r.ListaEESSPrecio.length >= MIN_ESTACIONES &&
    (r.ResultadoConsulta === undefined || r.ResultadoConsulta === 'OK')
  );
}

/** Descarga la API con reintentos y espera creciente (la API da 503 a menudo). */
async function descargar(): Promise<{ raw: RawResponse; text: string }> {
  let ultimoError: unknown;
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      log(`Descargando (intento ${intento}/${MAX_INTENTOS})…`);
      const res = await fetch(SITE.dataSource.api, {
        headers: { Accept: 'application/json', 'User-Agent': `${SITE.name} (+${SITE.url})` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      const raw: unknown = JSON.parse(text);
      if (!validar(raw)) throw new Error('Respuesta sin datos válidos o incompleta');
      return { raw, text };
    } catch (err) {
      ultimoError = err;
      log(`  Falló: ${err instanceof Error ? err.message : String(err)}`);
      if (intento < MAX_INTENTOS) await esperar(Math.min(30_000, 2_000 * 2 ** (intento - 1)));
    }
  }
  throw ultimoError instanceof Error ? ultimoError : new Error(String(ultimoError));
}

function leerCache(): RawResponse {
  if (!existsSync(RAW_PATH)) throw new Error(`No hay caché en ${RAW_PATH}`);
  const raw: unknown = JSON.parse(readFileSync(RAW_PATH, 'utf8'));
  if (!validar(raw)) throw new Error(`La caché ${RAW_PATH} no es válida`);
  return raw;
}

async function obtenerDatos(): Promise<RawResponse> {
  if (offline) {
    log(`Modo offline: usando ${RAW_PATH}`);
    return leerCache();
  }
  try {
    const { raw, text } = await descargar();
    writeAtomic(RAW_PATH, text);
    log(`Descarga correcta (${(text.length / 1e6).toFixed(1)} MB), caché actualizada.`);
    return raw;
  } catch (err) {
    log(`AVISO: no se pudo descargar (${err instanceof Error ? err.message : String(err)}). Se usa la última descarga buena.`);
    return leerCache();
  }
}

function leerHistorico(): HistoryPoint[] {
  if (!existsSync(HISTORY_PATH)) return [];
  const data: unknown = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`${HISTORY_PATH} no es un array`);
  return data as HistoryPoint[];
}

async function main(): Promise<void> {
  const raw = await obtenerDatos();
  const { dataset, skipped } = buildDataset(raw);

  // Comprobaciones de cordura: mejor fallar aquí que publicar una web rota.
  const slugs = new Set(dataset.stations.map((s) => s.slug));
  if (slugs.size !== dataset.stations.length) throw new Error('Hay slugs de estación duplicados');
  if (dataset.stations.length < MIN_ESTACIONES) throw new Error(`Muy pocas estaciones: ${dataset.stations.length}`);
  for (const s of dataset.stations) {
    const nums = [s.lat, s.lon, ...Object.values(s.prices)];
    if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) throw new Error(`Valor no numérico en ${s.id}`);
  }

  writeAtomic(DATASET_PATH, JSON.stringify(dataset));
  const min = JSON.stringify(buildStationsMin(dataset));
  writeAtomic(MIN_PATH, min);

  const point = buildHistoryPoint(dataset);
  const { history, added } = mergeHistory(leerHistorico(), point);
  if (added) writeAtomic(HISTORY_PATH, JSON.stringify(history, null, 1) + '\n');

  log(`Datos de ${dataset.updatedAt}`);
  log(
    `${dataset.stations.length} estaciones, ${dataset.municipalities.length} municipios, ${dataset.provinces.length} provincias` +
      ` (descartadas: ${skipped.restricted} de venta restringida, ${skipped.badCoords} sin coordenadas, ${skipped.noPrices} sin precios)`,
  );
  log(`stations.min.json: ${(min.length / 1024).toFixed(0)} KB (${(gzipSync(min, { level: 9 }).length / 1024).toFixed(0)} KB gzip)`);
  log(added ? `Histórico: añadido el punto ${point.date} (${history.length} días)` : `Histórico: ya había punto para ${point.date}`);
}

main().catch((err: unknown) => {
  console.error('[data] ERROR:', err instanceof Error ? err.message : err);
  process.exit(1);
});
