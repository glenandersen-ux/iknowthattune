import type { Env } from '../env';
import type { Challenge } from '../../src/types/challenge';

/** R2 presigned URLs (upload and playback) are valid for one hour (TechStack §D.13). */
const PRESIGN_TTL_SECONDS = 60 * 60;

const CHALLENGE_TTL_SECONDS = 60 * 60 * 24 * 90;

/**
 * The standard Workers `R2Bucket` type doesn't expose the S3-compatible
 * presigned URL API; it's available on the underlying binding at runtime
 * (TechStack §D.13).
 */
interface PresignableR2Bucket {
  createPresignedUrl(key: string, options: { method: 'PUT' | 'GET'; expiresIn: number }): Promise<string>;
}

/** R2 object key for a BYOC clip (TechStack §D.7). */
function clipKey(challengeId: string, slot: string): string {
  return `ugc-clips/${challengeId}/${slot}.mp3`;
}

async function presignUpload(url: URL, env: Env): Promise<Response> {
  const challengeId = url.searchParams.get('challengeId');
  const slot = url.searchParams.get('slot');
  if (!challengeId || !slot) {
    return new Response('Missing challengeId or slot', { status: 400 });
  }

  const key = clipKey(challengeId, slot);
  const bucket = env.R2 as unknown as PresignableR2Bucket;
  const uploadUrl = await bucket.createPresignedUrl(key, {
    method: 'PUT',
    expiresIn: PRESIGN_TTL_SECONDS,
  });

  return Response.json({ uploadUrl, key });
}

/**
 * Returns a short-lived signed GET URL for a previously-confirmed BYOC clip,
 * so the audio is never publicly hot-linkable (TechStack §D.13).
 */
async function presignClip(url: URL, env: Env): Promise<Response> {
  const challengeId = url.searchParams.get('challengeId');
  const slot = url.searchParams.get('slot');
  if (!challengeId || !slot) {
    return new Response('Missing challengeId or slot', { status: 400 });
  }

  const key = clipKey(challengeId, slot);
  const object = await env.R2.head(key);
  if (object === null) return new Response('Clip not found', { status: 404 });

  const bucket = env.R2 as unknown as PresignableR2Bucket;
  const clipUrl = await bucket.createPresignedUrl(key, {
    method: 'GET',
    expiresIn: PRESIGN_TTL_SECONDS,
  });

  return Response.json({ url: clipUrl });
}

interface ConfirmUgcRequest {
  challengeId: string;
  slot: string;
}

async function confirmUpload(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as ConfirmUgcRequest;
  if (!body.challengeId || !body.slot) {
    return new Response('Missing challengeId or slot', { status: 400 });
  }

  const challengeData = await env.CHALLENGES_KV.get(`challenge:${body.challengeId}`);
  if (challengeData === null) return new Response('Challenge not found', { status: 404 });

  const key = clipKey(body.challengeId, body.slot);
  const object = await env.R2.head(key);
  if (object === null) return new Response('Clip not found in storage', { status: 404 });

  const challenge = JSON.parse(challengeData) as Challenge;
  const updated: Challenge = {
    ...challenge,
    byoc_clips: { ...(challenge.byoc_clips ?? {}), [body.slot]: key },
  };

  await env.CHALLENGES_KV.put(`challenge:${body.challengeId}`, JSON.stringify(updated), {
    expirationTtl: CHALLENGE_TTL_SECONDS,
  });

  return Response.json({ key });
}

/** Routes all `/api/ugc/*` requests (TechStack §D.7, §4.2). */
export async function handleUgcRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);

  // GET /api/ugc/presign?challengeId=&slot=
  if (request.method === 'GET' && segments.length === 3 && segments[1] === 'ugc' && segments[2] === 'presign') {
    return presignUpload(url, env);
  }

  // POST /api/ugc/confirm
  if (request.method === 'POST' && segments.length === 3 && segments[1] === 'ugc' && segments[2] === 'confirm') {
    return confirmUpload(request, env);
  }

  // GET /api/ugc/clip-url?challengeId=&slot=
  if (request.method === 'GET' && segments.length === 3 && segments[1] === 'ugc' && segments[2] === 'clip-url') {
    return presignClip(url, env);
  }

  return new Response('Not found', { status: 404 });
}
