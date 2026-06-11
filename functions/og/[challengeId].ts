import type { Challenge } from '../../src/types/challenge';

/** Bindings available to Pages Functions, declared in wrangler.toml. */
interface Env {
  CHALLENGES_KV: KVNamespace;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Serves dynamic OG meta tags for a challenge share link (TechStack §D.7).
 * Social platforms fetch this URL to render link previews; real visitors are
 * redirected to the app via the meta refresh tag.
 */
export const onRequest: PagesFunction<Env> = async ({ params, env }) => {
  const challengeId = params.challengeId as string;
  const data = await env.CHALLENGES_KV.get(`challenge:${challengeId}`);
  if (data === null) return new Response('Not found', { status: 404 });

  const challenge = JSON.parse(data) as Challenge;
  const title = escapeHtml(challenge.name ?? `${challenge.creator_name}'s Music Challenge`);
  const scoreLabel = challenge.creator_score !== null ? `${challenge.creator_score}` : '???';
  const description = escapeHtml(`${challenge.tracks.length} tracks · Can you beat ${scoreLabel} pts?`);

  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="https://iknowthattune.com/og-cards/${challengeId}.png" />
  <meta property="og:url" content="https://iknowthattune.com/?c=${challengeId}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta http-equiv="refresh" content="0; url=/?c=${challengeId}" />
</head>
</html>`,
    { headers: { 'Content-Type': 'text/html' } },
  );
};
