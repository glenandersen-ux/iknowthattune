import type { Env } from '../env';

export interface AuthUser {
  user_id: string;
  google_sub: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const STATE_TTL_SECONDS = 300; // 5 minutes for CSRF state

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

function getRedirectUri(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/api/auth/google/callback`;
}

function sessionCookie(token: string): string {
  return `iktt_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearCookie(): string {
  return `iktt_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)iktt_session=([^;]+)/);
  return match?.[1] ?? null;
}

async function getSessionUser(token: string | null, env: Env): Promise<AuthUser | null> {
  if (!token) return null;
  const userId = await env.AUTH_KV.get(`session:${token}`);
  if (!userId) return null;
  const raw = await env.AUTH_KV.get(`user:${userId}`);
  if (!raw) return null;
  return JSON.parse(raw) as AuthUser;
}

/** GET /api/auth/google/start — initiates the Google OAuth flow. */
export async function handleGoogleStart(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'Google auth not configured' }), { status: 503, headers: CORS });
  }
  // Store CSRF state in a cookie rather than KV. Cloudflare KV is eventually
  // consistent across regions, so a start/callback pair that hits different
  // datacenters within the 5-minute window can fail the state lookup.
  // A cookie travels with the browser and is guaranteed to be present.
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(request),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      'Set-Cookie': `iktt_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${STATE_TTL_SECONDS}`,
    },
  });
}

/** GET /api/auth/google/callback — Google redirects here after consent. */
export async function handleGoogleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Verify CSRF state against the cookie set by /google/start.
  const cookie = request.headers.get('Cookie') ?? '';
  const cookieState = cookie.match(/(?:^|;\s*)iktt_oauth_state=([^;]+)/)?.[1] ?? null;
  if (!code || !state || state !== cookieState) {
    return new Response(null, { status: 302, headers: { Location: '/?auth=error' } });
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(request),
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    return new Response(null, { status: 302, headers: { Location: '/?auth=error' } });
  }
  const tokens = (await tokenRes.json()) as { access_token: string };

  // Fetch user info from Google
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userInfoRes.ok) {
    return new Response(null, { status: 302, headers: { Location: '/?auth=error' } });
  }
  const googleUser = (await userInfoRes.json()) as GoogleUserInfo;

  // Find or create user
  let userId = await env.AUTH_KV.get(`user_by_google:${googleUser.sub}`);
  if (!userId) {
    userId = crypto.randomUUID();
    const user: AuthUser = {
      user_id: userId,
      google_sub: googleUser.sub,
      email: googleUser.email,
      display_name: googleUser.name,
      avatar_url: googleUser.picture ?? null,
      created_at: new Date().toISOString(),
    };
    await env.AUTH_KV.put(`user:${userId}`, JSON.stringify(user));
    await env.AUTH_KV.put(`user_by_google:${googleUser.sub}`, userId);
  } else {
    // Update display name and avatar in case they changed on Google
    const existing = await env.AUTH_KV.get(`user:${userId}`);
    if (existing) {
      const user = JSON.parse(existing) as AuthUser;
      user.display_name = googleUser.name;
      user.avatar_url = googleUser.picture ?? user.avatar_url;
      await env.AUTH_KV.put(`user:${userId}`, JSON.stringify(user));
    }
  }

  // Issue a short-lived exchange code (30s TTL) rather than setting the cookie
  // directly on the redirect response. Cloudflare's service binding between
  // Pages and Worker silently drops Set-Cookie headers on redirect responses,
  // so the cookie has to be set in a normal JSON response instead. The frontend
  // reads the exchange code from the URL and calls /api/auth/exchange to swap
  // it for a real session cookie.
  const exchangeCode = crypto.randomUUID();
  const sessionToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  await env.AUTH_KV.put(`session:${sessionToken}`, userId, { expirationTtl: SESSION_TTL_SECONDS });
  await env.AUTH_KV.put(`exchange:${exchangeCode}`, sessionToken, { expirationTtl: 30 });

  return new Response(null, {
    status: 302,
    headers: { Location: `/?auth_exchange=${exchangeCode}` },
  });
}

/** GET /api/auth/me — returns the current user, or 401 if not logged in. */
export async function handleAuthMe(request: Request, env: Env): Promise<Response> {
  const user = await getSessionUser(getSessionToken(request), env);
  if (!user) {
    return new Response(JSON.stringify(null), { status: 200, headers: CORS });
  }
  return new Response(
    JSON.stringify({ user_id: user.user_id, display_name: user.display_name, email: user.email, avatar_url: user.avatar_url }),
    { status: 200, headers: CORS },
  );
}

/** POST /api/auth/logout — clears the session cookie and deletes the KV entry. */
export async function handleAuthLogout(request: Request, env: Env): Promise<Response> {
  const token = getSessionToken(request);
  if (token) await env.AUTH_KV.delete(`session:${token}`);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, 'Set-Cookie': clearCookie() },
  });
}

/**
 * POST /api/auth/sync — merges the player's local stats with their server
 * profile. The client sends its playerStore snapshot; the server keeps the
 * higher score and union of badges.
 */
export async function handleAuthSync(request: Request, env: Env): Promise<Response> {
  const user = await getSessionUser(getSessionToken(request), env);
  if (!user) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: CORS });

  const body = (await request.json()) as Record<string, unknown>;
  await env.AUTH_KV.put(`player_stats:${user.user_id}`, JSON.stringify(body));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
}

/**
 * POST /api/auth/exchange — swaps a short-lived exchange code for a real
 * session cookie. Called by the frontend immediately after the OAuth callback
 * redirect, in a normal JSON request where Set-Cookie works correctly.
 */
export async function handleAuthExchange(request: Request, env: Env): Promise<Response> {
  const { code } = (await request.json()) as { code?: string };
  if (!code) return new Response(JSON.stringify({ error: 'code required' }), { status: 400, headers: CORS });

  const sessionToken = await env.AUTH_KV.get(`exchange:${code}`);
  if (!sessionToken) return new Response(JSON.stringify({ error: 'invalid or expired code' }), { status: 401, headers: CORS });

  // Consume the exchange code so it can't be replayed.
  await env.AUTH_KV.delete(`exchange:${code}`);

  const user = await getSessionUser(sessionToken, env);
  if (!user) return new Response(JSON.stringify({ error: 'session not found' }), { status: 401, headers: CORS });

  return new Response(
    JSON.stringify({ user_id: user.user_id, display_name: user.display_name, email: user.email, avatar_url: user.avatar_url }),
    {
      status: 200,
      headers: { ...CORS, 'Set-Cookie': sessionCookie(sessionToken) },
    },
  );
}

export async function handleAuthRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  // segments: ['api', 'auth', ...]

  if (segments[2] === 'google' && segments[3] === 'start') return handleGoogleStart(request, env);
  if (segments[2] === 'google' && segments[3] === 'callback') return handleGoogleCallback(request, env);
  if (segments[2] === 'me') return handleAuthMe(request, env);
  if (segments[2] === 'exchange' && request.method === 'POST') return handleAuthExchange(request, env);
  if (segments[2] === 'logout' && request.method === 'POST') return handleAuthLogout(request, env);
  if (segments[2] === 'sync' && request.method === 'POST') return handleAuthSync(request, env);

  return new Response('Not found', { status: 404 });
}
