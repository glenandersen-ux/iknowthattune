// Uploads catalog/data/daily-rotation.json to Cloudflare KV using the REST API.
// No wrangler installation required.
//
// Usage:
//   node catalog/scripts/upload-daily-rotation.mjs <CF_API_TOKEN>
//
// Get your API token from:
//   https://dash.cloudflare.com/profile/api-tokens
//   → Create Token → "Edit Cloudflare Workers" template → Create Token
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ACCOUNT_ID  = '3d3a4327a036de9902a7760a03e23ec4';
const NAMESPACE_ID = '335289cc2fe64069ad118f9fcc4f13d6'; // CHALLENGES_KV

const token = process.argv[2];
if (!token) {
  console.error('Usage: node catalog/scripts/upload-daily-rotation.mjs <CF_API_TOKEN>');
  process.exit(1);
}

const entries = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'data', 'daily-rotation.json'), 'utf-8')
);

// Cloudflare bulk KV write accepts up to 10,000 entries per request.
const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/bulk`;

const response = await fetch(url, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(entries),
});

const result = await response.json();

if (result.success) {
  console.log(`✅ Uploaded ${entries.length} daily drop entries to KV.`);
  console.log(`Date range: ${entries[0].key} → ${entries[entries.length - 1].key}`);
} else {
  console.error('❌ Upload failed:', JSON.stringify(result.errors, null, 2));
  process.exit(1);
}
