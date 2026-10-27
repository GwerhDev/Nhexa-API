/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// The session secret is read when the config loads: set before anything imports it.
process.env.PRIVATE_SECRET = 'test-session-secret';
// eslint-disable-next-line @typescript-eslint/no-var-requires -- after the env is set
const { createToken, decodeToken } = require('../src/integrations/jwt') as typeof import('../src/integrations/jwt');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createOAuthSigner, ephemeralSigningKey } = require('../src/integrations/oauthKeys') as typeof import('../src/integrations/oauthKeys');

describe('a session token', () => {
  it("is one of Nhexa's own (HS256)", async () => {
    const token = await createToken({ id: 'ada', role: 'admin' }, 1);
    assert.equal((await decodeToken(token)).data.id, 'ada');
  });

  it('is never an OAuth access token (RS256), even one shaped like a session', async () => {
    const signer = createOAuthSigner('https://api.nhexa.test', ephemeralSigningKey());
    const now = Math.floor(Date.now() / 1000);
    // An app holding an access token must not pass it off as the user's session.
    const accessToken = signer.sign({
      sub: 'ada', aud: 'https://api.nhexa.test/streamby', client_id: 'app', scope: 'profile', jti: 'j', iat: now, exp: now + 3600,
      ...({ data: { id: 'ada', role: 'admin' } } as object),
    } as Parameters<typeof signer.sign>[0]);
    await assert.rejects(decodeToken(accessToken));
  });
});
