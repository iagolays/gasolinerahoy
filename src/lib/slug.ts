// Utilidades de texto: slugs, formato título y nombres de lugar.
// Son funciones puras (sin Node), así que también se pueden usar en el cliente.

/**
 * Convierte un texto en slug para URL: minúsculas, sin tildes ni diéresis,
 * "ñ" → "n", "ç" → "c", y cualquier otro carácter → guion.
 * "A Coruña" → "a-coruna"; "L'Hospitalet de Llobregat" → "l-hospitalet-de-llobregat".
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes, diéresis y la virgulilla de la ñ
    .toLowerCase()
    .replace(/[ºª]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Palabras que van en minúscula dentro de un nombre (salvo al principio). */
const MINUSCULAS = new Set([
  'a', 'al', 'de', 'del', 'el', 'la', 'las', 'los', 'en', 'y', 'e', 'o', 'u', 'con', 'por', 'para', 'sin', 'sobre',
  'i', 'da', 'das', 'do', 'dos', 'd', 'les', 'els', 'lo',
]);

/** Pone en mayúscula la primera letra de una palabra (respetando apóstrofos: "l'alfàs" → "L'Alfàs"). */
function capitalizar(palabra: string): string {
  const lower = palabra.toLocaleLowerCase('es');
  // "l'eliana" → "L'Eliana"; "d'alba" → "d'Alba" se trata fuera
  const apos = lower.match(/^([ld])['’](.+)$/);
  if (apos) return apos[1]!.toLocaleUpperCase('es') + "'" + capitalizar(apos[2]!);
  return lower.replace(/^(\p{L})/u, (c) => c.toLocaleUpperCase('es'));
}

export interface TitleCaseOptions {
  /** Palabras que se dejan tal cual si aparecen (p. ej. siglas como "BP"). */
  keepUpper?: (word: string) => boolean;
}

/**
 * Formato título en español: "AVENIDA DE LOS TOREROS, S/N" → "Avenida de los Toreros, S/N".
 * Las palabras con dígitos (N-322, 1º, KM.2) y "S/N" se dejan en mayúsculas.
 */
export function titleCase(text: string, opts: TitleCaseOptions = {}): string {
  const limpio = text.replace(/\s+/g, ' ').trim();
  if (!limpio) return '';
  let primera = true;
  return limpio
    .split(' ')
    .map((token) => {
      const res = titleToken(token, primera, opts);
      primera = false;
      return res;
    })
    .join(' ');
}

function titleToken(token: string, primera: boolean, opts: TitleCaseOptions): string {
  // Separamos signos de puntuación iniciales y finales: "(LA)," → "(" + "LA" + "),"
  const m = token.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}.]*)$/u);
  const [, pre = '', palabra = '', post = ''] = m ?? [];
  if (!palabra) return token;
  const upper = palabra.toLocaleUpperCase('es');
  if (upper === 'S/N' || upper === 'S.N.' || upper === 'S/N.' || upper === 'SN') return pre + 'S/N' + post;
  if (/\d/.test(palabra)) return pre + upper.replace(/KM/g, 'km') + post;
  const lower = palabra.toLocaleLowerCase('es');
  if (lower === 'km' || lower === 'km.') return pre + lower + post;
  if (opts.keepUpper?.(upper)) return pre + upper + post;
  if (!primera && !pre && MINUSCULAS.has(lower)) return pre + lower + post;
  // Palabras compuestas con guion o barra: "castilla-la" → "Castilla-La"
  return pre + palabra.split(/([-/])/).map((p) => (p === '-' || p === '/' ? p : capitalizar(p))).join('') + post;
}

/** Artículos que la API pone al final entre paréntesis: "Palmas (Las)", "Alfàs del Pi (l')". */
const ARTICULO_FINAL = /^(.*?)\s*\((el|la|los|las|l'|l’|es|sa|ses|les|els|a|o|as|os|lo)\)\s*$/i;

/**
 * Normaliza un nombre de lugar tal como lo da la API:
 * - "Palmas (Las)" → "Las Palmas", "CORUÑA (A)" → "A Coruña", "Alfàs del Pi (l')" → "L'Alfàs del Pi".
 * - Con barra (nombre bilingüe) el artículo va con la última parte:
 *   "Villajoyosa/Vila Joiosa (la)" → "Villajoyosa/La Vila Joiosa".
 * - Si el nombre viene entero en mayúsculas, se pasa a formato título.
 */
export function placeName(raw: string): string {
  let nombre = raw.replace(/\s+/g, ' ').trim();
  if (!nombre) return '';
  // Solo pasamos a formato título si viene todo en mayúsculas (los municipios ya vienen bien escritos).
  if (nombre === nombre.toLocaleUpperCase('es') && /\p{L}/u.test(nombre)) nombre = titleCase(nombre);
  const m = nombre.match(ARTICULO_FINAL);
  if (!m) return nombre;
  const base = m[1]!.trim();
  const art = m[2]!.replace('’', "'");
  const artCap = art.charAt(0).toLocaleUpperCase('es') + art.slice(1).toLocaleLowerCase('es');
  const conArticulo = (s: string) => (artCap.endsWith("'") ? `${artCap}${s}` : `${artCap} ${s}`);
  const barra = base.lastIndexOf('/');
  if (barra >= 0) return base.slice(0, barra + 1) + conArticulo(base.slice(barra + 1).trim());
  return conArticulo(base);
}

/** Marca que se usa cuando el rótulo es un número, está vacío o no significa nada. */
export const GENERIC_BRAND = 'Gasolinera independiente';

/** Slug de marca para las URL de las fichas: la marca genérica (o una sin letras) → "gasolinera". */
export function brandSlug(brand: string): string {
  if (brand === GENERIC_BRAND) return 'gasolinera';
  return slugify(brand) || 'gasolinera';
}
