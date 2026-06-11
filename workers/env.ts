/** Cloudflare bindings declared in wrangler.toml. */
export interface Env {
  CHALLENGES_KV: KVNamespace;
  R2: R2Bucket;
  LEADERBOARD: DurableObjectNamespace;
  DAILY_DROP: DurableObjectNamespace;
}
