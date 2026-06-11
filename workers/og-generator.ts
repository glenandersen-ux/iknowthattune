import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { createElement } from 'react';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import interRegular from './fonts/Inter-Regular.ttf';
import interBold from './fonts/Inter-Bold.ttf';
import type { Challenge } from '../src/types/challenge';

let wasmReady: Promise<void> | null = null;

/** Lazily initializes the resvg wasm module (Workers cold-start safe, idempotent). */
function ensureWasm(): Promise<void> {
  wasmReady ??= initWasm(resvgWasm);
  return wasmReady;
}

/** Renders a 1200x630 OG preview card for a challenge as a PNG (TechStack §D.11). */
export async function generateOgCard(challenge: Challenge): Promise<Uint8Array> {
  await ensureWasm();

  const title = challenge.name ?? `${challenge.creator_name}'s Music Challenge`;
  const trackCount = challenge.tracks.length;
  const trackLabel = `${trackCount} track${trackCount === 1 ? '' : 's'}`;
  const scoreLabel =
    challenge.creator_score !== null
      ? `Can you beat ${challenge.creator_score.toLocaleString()} pts?`
      : 'Take the challenge';

  const element = createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '1200px',
        height: '630px',
        padding: '64px',
        backgroundColor: '#0f172a',
        fontFamily: 'Inter',
        color: '#ffffff',
      },
    },
    createElement(
      'div',
      { style: { display: 'flex', fontSize: '32px', color: '#34d399', fontWeight: 700 } },
      '🎵 I KNOW THAT TUNE',
    ),
    createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      createElement('div', { style: { display: 'flex', fontSize: '64px', fontWeight: 700 } }, title),
      createElement(
        'div',
        { style: { display: 'flex', fontSize: '36px', color: '#94a3b8' } },
        `Created by ${challenge.creator_name}`,
      ),
    ),
    createElement(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' } },
      createElement(
        'div',
        { style: { display: 'flex', fontSize: '40px', color: '#22d3ee', fontWeight: 700 } },
        scoreLabel,
      ),
      createElement('div', { style: { display: 'flex', fontSize: '32px', color: '#94a3b8' } }, trackLabel),
    ),
  );

  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  return resvg.render().asPng();
}
