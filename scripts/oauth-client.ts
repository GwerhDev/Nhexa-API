// Registers an OAuth client by hand: prints the SQL to run in Supabase's SQL editor, and the
// client's secret (shown only now; only its hash is stored).
//
//   npx ts-node scripts/oauth-client.ts --name StreamBy --redirect https://streamby.nhexa.cl/oauth/callback \
//     [--redirect ...] [--public] [--id streamby] [--scopes "profile email streamby:read streamby:write"]
import crypto from 'crypto';

const args = process.argv.slice(2);
const values = (flag: string) => args.flatMap((arg, i) => (arg === flag && args[i + 1] ? [args[i + 1]] : []));
const name = values('--name')[0];
const redirects = values('--redirect');
const isPublic = args.includes('--public');
const scopes = (values('--scopes')[0] ?? 'profile email streamby:read streamby:write').split(' ').filter(Boolean);
if (!name || !redirects.length) {
  console.error('Usage: --name <name> --redirect <uri> [--redirect <uri>] [--public] [--id <client_id>] [--scopes "<scopes>"]');
  process.exit(1);
}
const clientId = values('--id')[0] ?? crypto.randomBytes(12).toString('hex');
const secret = isPublic ? null : crypto.randomBytes(32).toString('base64url');
const quote = (v: string) => `'${v.replace(/'/g, "''")}'`;
const array = (list: string[]) => `ARRAY[${list.map(quote).join(', ')}]::text[]`;

console.log(`INSERT INTO accounts.oauth_clients (client_id, client_secret_hash, type, name, redirect_uris, scopes, registration)
VALUES (${quote(clientId)}, ${secret ? quote(crypto.createHash('sha256').update(secret).digest('hex')) : 'NULL'}, ${quote(isPublic ? 'public' : 'confidential')}, ${quote(name)}, ${array(redirects)}, ${array(scopes)}, 'manual');`);
console.error(`\nclient_id: ${clientId}${secret ? `\nclient_secret: ${secret}  (shown only now)` : ''}`);
