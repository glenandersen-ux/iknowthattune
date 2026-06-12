/** Bindings available to Pages Functions, declared in wrangler-pages.toml. */
interface Env {
  /** Service binding to the `iknowthattune` Worker (workers/api/router.ts). */
  API: Fetcher;
}

/**
 * Forwards every `/api/*` request from the Pages-hosted frontend to the
 * standalone `iknowthattune` Worker, which holds the KV/R2/Durable Object
 * bindings for challenges, results, and the leaderboard (TechStack §D.7).
 */
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  return env.API.fetch(request);
};
