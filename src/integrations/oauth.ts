import { apiUrl, clientAccountsUrl, environment, oauthPreviousKeys, oauthResources, oauthSigningKey } from '../config';
import { production } from '../misc/consts';
import type { UserRecord } from '../types';
import type { supabase as SupabaseClient } from './supabase';
import { createSupabaseOAuthStore } from './oauthStore';
import { createOAuthSigner, ephemeralSigningKey, splitPemKeys } from './oauthKeys';
import { createClientMetadataResolver } from './oauthClientMetadata';
import { createOAuthServer, OAUTH_SCOPES, OAuthServer } from './oauthServer';

// The OAuth server as the API runs it: its records in Supabase, its key from the environment.
// Without a key in production it's off (its endpoints answer 503); in development an
// ephemeral one is made, so tokens don't outlive the process.

const defaultResources = () => [`${apiUrl}/streamby`, `${apiUrl}/streamby/mcp`];

let server: OAuthServer | null | undefined;

export function getOAuthServer(): OAuthServer | null {
  if (server !== undefined) return server;
  let key = oauthSigningKey;
  if (!key) {
    if (environment === production) {
      console.error('[oauth] OAUTH_SIGNING_KEY is not set: the OAuth server is off');
      return (server = null);
    }
    console.warn('[oauth] OAUTH_SIGNING_KEY is not set: using an ephemeral key (development only)');
    key = ephemeralSigningKey();
  }
  // Loaded only now: the Supabase client is made as its module loads.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { supabase } = require('./supabase') as { supabase: typeof SupabaseClient };
  server = createOAuthServer({
    store: createSupabaseOAuthStore(supabase),
    signer: createOAuthSigner(apiUrl, key, splitPemKeys(oauthPreviousKeys)),
    resolveMetadataClient: createClientMetadataResolver(OAUTH_SCOPES),
    findUser: async (id: string) => {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle<UserRecord>();
      return error ? null : data;
    },
    issuer: apiUrl,
    authorizationEndpoint: `${clientAccountsUrl}/oauth/authorize`,
    resources: oauthResources ? oauthResources.split(',').map(r => r.trim()).filter(Boolean) : defaultResources(),
  });
  return server;
}
