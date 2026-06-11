import { describe, it, expect } from 'vitest';
import { buildR2Key, buildUploadArgs, BUCKET_NAME } from './upload-r2';

describe('buildR2Key', () => {
  it('namespaces a catalog data file under catalog/data/', () => {
    expect(buildR2Key('seed-tracks.json')).toBe('catalog/data/seed-tracks.json');
  });
});

describe('buildUploadArgs', () => {
  it('builds a local wrangler r2 object put command', () => {
    const args = buildUploadArgs(BUCKET_NAME, 'catalog/data/seed-tracks.json', '/tmp/seed-tracks.json', true);
    expect(args).toEqual([
      'r2',
      'object',
      'put',
      `${BUCKET_NAME}/catalog/data/seed-tracks.json`,
      '--file=/tmp/seed-tracks.json',
      '--local',
    ]);
  });

  it('builds a remote wrangler r2 object put command', () => {
    const args = buildUploadArgs(BUCKET_NAME, 'catalog/data/seed-tracks.json', '/tmp/seed-tracks.json', false);
    expect(args).toEqual([
      'r2',
      'object',
      'put',
      `${BUCKET_NAME}/catalog/data/seed-tracks.json`,
      '--file=/tmp/seed-tracks.json',
      '--remote',
    ]);
  });
});
