/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createClientMetadataResolver, isPrivateIp } from '../src/integrations/oauthClientMetadata';
import { OAUTH_SCOPES } from '../src/integrations/oauthServer';

const URL_ID = 'https://agent.example/oauth/client.json';
const doc = (over: object = {}) => JSON.stringify({ client_id: URL_ID, client_name: 'Agent', redirect_uris: ['https://agent.example/cb'], ...over });
const resolverWith = (body: string, addresses = ['93.184.216.34'], status = 200) => {
  let fetched = 0;
  const resolve = createClientMetadataResolver(
    OAUTH_SCOPES,
    async () => { fetched += 1; return new Response(body, { status }); },
    async () => addresses,
  );
  return { resolve, fetched: () => fetched };
};

describe('a client ID metadata document', () => {
  it('makes a public client of what it says, and is kept for a while', async () => {
    const { resolve, fetched } = resolverWith(doc());
    const client = await resolve(URL_ID);
    assert.equal(client.name, 'Agent');
    assert.equal(client.type, 'public');
    assert.deepEqual(client.redirect_uris, ['https://agent.example/cb']);
    await resolve(URL_ID);
    assert.equal(fetched(), 1);
  });

  it('is turned down when it names another client_id, asks for a secret, or lists no redirect URIs', async () => {
    for (const body of [doc({ client_id: 'https://other.example/c.json' }), doc({ token_endpoint_auth_method: 'client_secret_basic' }), doc({ redirect_uris: [] }), 'not json']) {
      await assert.rejects(resolverWith(body).resolve(URL_ID), body);
    }
  });

  it('is never fetched from a local or private address, nor from a URL without a path', async () => {
    for (const addresses of [['10.0.0.5'], ['127.0.0.1'], ['fdaa:0:1::3'], ['169.254.169.254'], []]) {
      const { resolve, fetched } = resolverWith(doc(), addresses);
      await assert.rejects(resolve(URL_ID), JSON.stringify(addresses));
      assert.equal(fetched(), 0);
    }
    await assert.rejects(resolverWith(doc()).resolve('https://agent.example/'));
    await assert.rejects(resolverWith(doc()).resolve('http://agent.example/c.json'));
  });

  it('knows a private address when it sees one', () => {
    for (const ip of ['0.0.0.0', '10.1.1.1', '192.168.0.1', '198.18.0.1', '224.0.0.1', '::', '::1', 'fe80::1', '::ffff:10.0.0.1']) assert.equal(isPrivateIp(ip), true, ip);
    for (const ip of ['8.8.8.8', '2606:4700::1111', '::ffff:8.8.8.8']) assert.equal(isPrivateIp(ip), false, ip);
  });
});
