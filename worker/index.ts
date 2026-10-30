// Worker de gasolinerasya.es.
// - fetch: sirve la web estática (dist/) tal cual; toda la lógica de rutas y 404 la hace `assets`.
// - scheduled: cada hora lanza el workflow "Desplegar" de GitHub (workflow_dispatch). El cron de
//   GitHub Actions se retrasa horas cuando GitHub va cargado; el Cron Trigger de Cloudflare es puntual.
//
// Necesita el secret GITHUB_TOKEN: token fine-grained limitado al repo, con permiso Actions → Read and write.
//   npx wrangler secret put GITHUB_TOKEN

// Tipos mínimos para no depender de @cloudflare/workers-types.
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  GITHUB_TOKEN?: string;
}

const REPO = 'iagolays/gasolinerasya';
const WORKFLOW = 'deploy.yml';
const BRANCH = 'main';

async function dispatchDeploy(env: Env): Promise<void> {
  if (!env.GITHUB_TOKEN) throw new Error('Falta el secret GITHUB_TOKEN: no se puede lanzar el despliegue.');
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gasolinerasya-cron',
    },
    body: JSON.stringify({ ref: BRANCH }),
  });
  // 204 = workflow encolado. Cualquier otra cosa se lanza como error para que salga en los logs del Worker.
  if (res.status !== 204) throw new Error(`GitHub respondió ${res.status}: ${await res.text()}`);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await dispatchDeploy(env);
  },
};
