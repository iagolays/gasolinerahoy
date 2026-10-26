# GasolineraHoy

Web estática con los precios de los carburantes de **todas las gasolineras de España**, por provincia, municipio y estación. Los datos salen de la API pública del Ministerio para la Transición Ecológica (Geoportal de Hidrocarburos), se regeneran **cada hora** con GitHub Actions y se publican en **Cloudflare Workers (archivos estáticos)**. Se financia con **Google AdSense**.

- Astro 7, sin frameworks de interfaz ni de CSS. Mapas con Leaflet + OpenStreetMap.
- Unas 14.700 páginas HTML: portada, 52 provincias, ~3.200 municipios, ~11.400 gasolineras, `/cerca/` y las páginas legales.
- El nombre y el dominio se cambian solo en `src/site.config.ts` (y en `public/robots.txt`).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm ci` | Instala las dependencias (Node 22.23 o superior). |
| `npm run data` | Descarga los precios, los normaliza y genera `src/data/generated/dataset.json`, `public/data/stations.min.json` y el punto del día en `data/history/history.json`. |
| `npm run data -- --offline` | Igual, pero con la última descarga guardada en `data/raw/latest.json` (sin red). |
| `npm run dev` | Servidor de desarrollo en `http://localhost:4321`. |
| `npm run build` | Compila la web en `dist/` (incluye `sitemap-index.xml`). |
| `npm run preview` | Sirve `dist/` en local. |
| `npm test` | Tests (vitest). |
| `npm run check` | Comprobación de tipos (`astro check`). |

## Estructura

```
scripts/fetch-data.ts        descarga y normalización de datos
src/lib/                     tipos, acceso a datos, slugs, carburantes
src/pages/                   rutas (todas estáticas)
src/layouts/Base.astro       layout común
src/components/seo/          <Seo> (meta, Open Graph, JSON-LD, script de AdSense) y helpers JSON-LD
src/components/ads/          <AdSlot> (huecos de anuncios)
public/_headers              caché y cabeceras de Cloudflare
public/ads.txt, robots.txt
data/history/history.json    histórico diario (se versiona en git)
.github/workflows/           deploy.yml (cada hora) y ci.yml (tests en PR)
```

## Límite de archivos de Cloudflare Workers

Cloudflare Workers (archivos estáticos) admite **como máximo 20.000 archivos por despliegue** (plan gratuito). Ahora salen unos 15.000 (HTML, sitemaps, assets). Los dos workflows cuentan los archivos de `dist/` y fallan si se llega al límite. **No añadas páginas por combinación** (por ejemplo, una por carburante y municipio): los carburantes se cambian en el cliente con pestañas.

Si algún día hiciera falta superar el límite, las alternativas son Cloudflare Workers con assets estáticos o reducir páginas (p. ej. no generar fichas de gasolinera y enlazar al municipio).

---

## Guía de despliegue paso a paso

Todo lo de abajo se hace una sola vez. Calcula una tarde, más los días de espera de AdSense.

### 1. Crear el repositorio en GitHub

1. Crea un repositorio (público o privado) en GitHub, por ejemplo `gasolinerahoy`. En repositorios **públicos** los minutos de Actions son gratis e ilimitados; en privados, el plan gratuito da 2.000 min/mes y el despliegue horario gasta unos 3–4 min por ejecución (~2.500 min/mes), así que **conviene que sea público**.
2. Sube el código:
   ```sh
   git init -b main
   git add .
   git commit -m "Primera versión"
   git remote add origin git@github.com:TU_USUARIO/gasolinerahoy.git
   git push -u origin main
   ```
3. En **Settings → Actions → General → Workflow permissions** marca **Read and write permissions** (el workflow sube el histórico diario con `git push`).

> GitHub desactiva los workflows programados de repositorios públicos tras 60 días sin actividad. El commit diario del histórico lo evita, pero si ves que se para, reactívalo en la pestaña **Actions**.

### 2. Desplegar en Cloudflare Workers (archivos estáticos)

Cloudflare Pages ahora se integra en Workers: la web se publica como un Worker que solo sirve archivos estáticos (`wrangler.jsonc`, sin código de servidor). El límite del plan gratuito es de 20.000 archivos por versión y 25 MiB por archivo.

1. Crea una cuenta gratuita en [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Primer despliegue desde tu ordenador: `npx wrangler login`, después `npm run data && npm run build` y por último `npx wrangler deploy`. Así se crea el Worker `gasolinerahoy`. **No uses `wrangler pages project create`**: intenta reconfigurar el proyecto con `astro add cloudflare` (SSR), y aquí no hace falta.
3. Crea un **token de API**: *icono de perfil → Profile → API Tokens → Create Token → Custom token*, con el permiso **Account → Workers Scripts → Edit**, limitado a tu cuenta.
4. Copia tu **Account ID**: es la cadena larga que aparece en la URL del panel.
5. Guarda los dos valores como secrets de GitHub Actions (`gh secret set CLOUDFLARE_API_TOKEN` y `gh secret set CLOUDFLARE_ACCOUNT_ID`).
6. Desde entonces, el workflow despliega solo cada hora (en el minuto 17) y en cada push a `main`. También se puede lanzar a mano en **Actions → Desplegar → Run workflow**.

Las URL `*.workers.dev` se sirven con `X-Robots-Tag: noindex` (ver `public/_headers`), para que Google solo indexe el dominio propio.

### 3. Comprar el dominio y conectarlo

1. Compra el dominio (p. ej. `gasolinerahoy.es`). La forma más sencilla es **Cloudflare Registrar** (*Gestión de dominios → Registrar dominios*), a precio de coste; ten en cuenta que Cloudflare Registrar no vende todos los TLD (para `.es` puede que tengas que usar otro registrador como DonDominio, Arsys o Namecheap y luego cambiar los DNS a Cloudflare).
2. Si lo compras fuera: en Cloudflare, **Añadir un dominio**, plan Free, y cambia en tu registrador los servidores DNS por los dos que te indique Cloudflare. Espera a que el dominio aparezca como *Activo*.
3. En el Worker `gasolinerahoy`: **Settings → Domains & Routes → Add → Custom domain** → `gasolinerahoy.es`. Añade también `www.gasolinerahoy.es` y crea una **regla de redirección** (*Reglas → Redirect Rules*, plantilla «Redirect from WWW to root») para que `www` redirija con 301 al dominio sin `www`.
4. Si el dominio no es `gasolinerahoy.es`, cámbialo en:
   - `src/site.config.ts` → `url` (y `name` si cambia la marca).
   - `public/robots.txt` → línea `Sitemap:`.
   Haz push y espera al despliegue.

### 4. Google Search Console

1. Entra en [Search Console](https://search.google.com/search-console) → **Añadir propiedad → Dominio** → `gasolinerahoy.es`.
2. Verifica con el registro **TXT** que te da Google: en Cloudflare, *DNS → Registros → Añadir registro* tipo TXT en `@`. (Search Console también puede hacerlo automáticamente con Cloudflare.)
3. **Sitemaps → Añadir** `https://gasolinerahoy.es/sitemap-index.xml`. El índice enlaza a varios sitemaps (gasolineras, provincias y municipios, y páginas sueltas), con un máximo de 10.000 URL cada uno.
4. Revisa en unos días **Páginas** (indexación) y **Experiencia → Core Web Vitals**. Es normal que Google tarde semanas en indexar todas las fichas.

### 5. Solicitar AdSense

Antes de solicitarlo:
- Rellena los datos del titular en las páginas legales: busca y sustituye `[NOMBRE]`, `[NIF]`, `[DOMICILIO]` y `[EMAIL]` en `src/pages/aviso-legal.astro`, `privacidad.astro`, `cookies.astro` y `acerca.astro`. Usa un correo que leas.
- Espera a que el dominio propio lleve unos días funcionando e indexándose.

Después:
1. Entra en [AdSense](https://adsense.google.com/) con tu cuenta de Google, **Sitios → Añadir sitio** → `gasolinerahoy.es`.
2. AdSense te pedirá verificar el sitio. Elige el método **ads.txt** o el **fragmento de código**:
   - Copia tu ID de editor (`pub-XXXXXXXXXXXXXXXX`, en *Cuenta → Información de la cuenta*).
   - En `src/site.config.ts` pon `adsenseClient: 'ca-pub-XXXXXXXXXXXXXXXX'` (con el prefijo `ca-`). Con eso `<Seo>` añade en todas las páginas el script de AdSense y la meta `google-adsense-account`, y `<AdSlot>` empieza a pintar los huecos de anuncios.
   - En `public/ads.txt` quita la `#` de la última línea y pon tu ID (`google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`).
   - Haz push, espera al despliegue y comprueba que `https://gasolinerahoy.es/ads.txt` muestra la línea.
3. Pulsa **Solicitar revisión**. Suele tardar de unos días a dos semanas. Entretanto los huecos pueden salir vacíos (tienen la altura reservada para que la página no salte cuando lleguen los anuncios).
4. Cuando lo aprueben:
   - Opcional: en **Anuncios → Por bloque de anuncio** crea tres bloques *display* adaptables (arriba, entre contenido, abajo) y pon sus IDs en `AD_UNITS` de `src/components/ads/AdSlot.astro`. Si no, los huecos funcionan sin ID de bloque.
   - Si activas también los **anuncios automáticos**, desactiva los formatos intrusivos (anuncios de viñeta y anclados si molestan) para no empeorar la experiencia.

### 6. Activar la CMP de Google («Privacidad y mensajes»)

Para mostrar anuncios personalizados a usuarios del EEE, Reino Unido y Suiza, Google exige una **plataforma de gestión del consentimiento (CMP) certificada e integrada en el TCF de IAB Europe**. La propia de Google es gratuita y es la que dan por supuesta las páginas legales:

1. En AdSense: **Privacidad y mensajes → Normativas europeas → Crear mensaje**.
2. Selecciona el sitio `gasolinerahoy.es`, idioma **español**, y en *Política de privacidad* pon `https://gasolinerahoy.es/privacidad/`.
3. **Activa la opción «No consentir»** (botón de rechazo en la primera capa). La AEPD exige que rechazar sea tan fácil como aceptar. Deja desactivada la opción de «Cerrar sin consentir» si no la necesitas.
4. Deja activado el **enlace o botón para volver a abrir las opciones de privacidad** («Privacy and cookie settings»). Además, la página `/cookies/` tiene un botón que reabre el mensaje (`googlefc.showRevocationMessage()`).
5. Revisa la lista de proveedores (puedes dejar los de Google y los habituales del TCF) y **Publica**.
6. No hace falta tocar el código: el mensaje lo inyecta el mismo script de AdSense que ya carga `<Seo>`.
7. Comprueba en una ventana privada que aparece el aviso al entrar y que desde `/cookies/` se puede cambiar la elección.

Si algún día cambias de proveedor de anuncios o añades analítica, actualiza `privacidad.astro` y `cookies.astro`.

### 7. Comprobaciones finales

- `https://gasolinerahoy.es/robots.txt`, `/ads.txt` y `/sitemap-index.xml` responden bien.
- La pestaña **Actions** muestra una ejecución verde cada hora. Si la API del Ministerio falla, el build usa la última descarga guardada (caché de Actions) y no se rompe.
- En [PageSpeed Insights](https://pagespeed.web.dev/) una ficha de gasolinera y una de municipio dan buen CLS con anuncios activos.

## Datos y atribución

Origen de los datos: **Ministerio para la Transición Ecológica y el Reto Demográfico** ([Geoportal de Hidrocarburos](https://geoportalgasolineras.es/)), reutilizados conforme a la Ley 37/2007 y a las [condiciones generales de reutilización del Ministerio](https://www.datosabiertos.miteco.gob.es/es/aviso-legal.html): se cita la fuente, se indica la fecha de la última actualización, no se altera el sentido de los datos y no se sugiere que el Ministerio patrocine o respalde la web. **No es una web oficial y los precios son orientativos.** Mapas © colaboradores de OpenStreetMap.
