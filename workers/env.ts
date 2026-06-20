/** Cloudflare bindings declared in wrangler.toml. */
export interface Env {
  CHALLENGES_KV: KVNamespace;
  R2: R2Bucket;
  LEADERBOARD: DurableObjectNamespace;
  /** Spotify OAuth client ID — set as a [vars] entry in wrangler.toml. */
  SPOTIFY_CLIENT_ID: string;
  /** Spotify OAuth client secret — set via `wrangler secret put SPOTIFY_CLIENT_SECRET`. */
  SPOTIFY_CLIENT_SECRET: string;
}
