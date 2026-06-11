import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** R2 bucket name, must match `wrangler.toml`'s `[[r2_buckets]]` entry. */
export const BUCKET_NAME = 'iknowthattune';

/** R2 object key under which a catalog data file is stored. */
export function buildR2Key(fileName: string): string {
  return `catalog/data/${fileName}`;
}

/** Arguments for `wrangler r2 object put`, given a bucket, key, and local file path. */
export function buildUploadArgs(bucket: string, key: string, filePath: string, local: boolean): string[] {
  const args = ['r2', 'object', 'put', `${bucket}/${key}`, `--file=${filePath}`, '--remote'];
  if (local) {
    args[args.length - 1] = '--local';
  }
  return args;
}

function main(): void {
  const local = !process.argv.includes('--remote');
  const dataDir = join(import.meta.dirname, '..', 'data');
  const files = readdirSync(dataDir).filter((file) => file.endsWith('.json'));

  for (const file of files) {
    const filePath = join(dataDir, file);
    const key = buildR2Key(file);
    const args = buildUploadArgs(BUCKET_NAME, key, filePath, local);
    console.log(`Uploading ${key} to ${BUCKET_NAME} (${local ? 'local' : 'remote'})...`);
    execFileSync('npx', ['wrangler', ...args], { stdio: 'inherit' });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
