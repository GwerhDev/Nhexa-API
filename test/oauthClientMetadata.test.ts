/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ClientMetadataError, createClientMetadataResolver, isPrivateIp, PINNED_DOCUMENTS, USER_AGENT } from '../src/integrations/oauthClientMetadata';
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

  it('is read as it arrives, and given up on as soon as it is too large', async () => {
    let pulled = 0;
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) { pulled += 1; controller.enqueue(new Uint8Array(16 * 1024).fill(32)); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const resolve = createClientMetadataResolver(OAUTH_SCOPES, async () => new Response(endless), async () => ['93.184.216.34']);
    await assert.rejects(resolve(URL_ID), /too large/);
    assert.ok(pulled <= 6, `read ${pulled} chunks of 16 KiB`);
    assert.equal(cancelled, true);
  });

  it('is turned down unread when it says it is too large', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({ pull(controller) { pulled += 1; controller.enqueue(new TextEncoder().encode(doc())); controller.close(); } }, { highWaterMark: 0 });
    const resolve = createClientMetadataResolver(OAUTH_SCOPES, async () => new Response(body, { headers: { 'Content-Length': String(10 * 1024 * 1024) } }), async () => ['93.184.216.34']);
    await assert.rejects(resolve(URL_ID), /too large/);
    assert.equal(pulled, 0);
  });

  it('is fetched again after a failure: only documents that made a client are kept', async () => {
    let fetched = 0;
    const resolve = createClientMetadataResolver(OAUTH_SCOPES, async () => {
      fetched += 1;
      return fetched === 1 ? new Response('down', { status: 503 }) : new Response(doc());
    }, async () => ['93.184.216.34']);
    await assert.rejects(resolve(URL_ID));
    assert.equal((await resolve(URL_ID)).name, 'Agent');
    assert.equal(fetched, 2);
  });

  it('keeps only so many documents, letting the oldest go first', async () => {
    const fetched = new Map<string, number>();
    const resolve = createClientMetadataResolver(OAUTH_SCOPES, async url => {
      fetched.set(url, (fetched.get(url) ?? 0) + 1);
      return new Response(JSON.stringify({ client_id: url, redirect_uris: ['https://agent.example/cb'] }));
    }, async () => ['93.184.216.34']);
    const id = (i: number) => `https://agent.example/clients/${i}.json`;
    for (let i = 0; i <= 500; i++) await resolve(id(i));
    await resolve(id(500));
    assert.equal(fetched.get(id(500)), 1, 'the newest is still kept');
    await resolve(id(0));
    assert.equal(fetched.get(id(0)), 2, 'the oldest was let go');
  });

  it('is asked for with a User-Agent of its own (some hosts turn a datacenter down without one)', async () => {
    let headers: Headers | undefined;
    const resolve = createClientMetadataResolver(OAUTH_SCOPES, async (_url, init) => { headers = new Headers(init.headers); return new Response(doc()); }, async () => ['93.184.216.34']);
    await resolve(URL_ID);
    assert.equal(headers?.get('user-agent'), USER_AGENT);
    assert.match(USER_AGENT, /^Nhexa-OAuth\/1\.0 \(\+https:\/\/nhexa\.cl\)$/);
  });

  // Why it failed, as the OAuth server tells the client: a document that couldn't be fetched is
  // a "try again" (temporary), one that turns it down is an unknown client. With its cause.
  const failure = async (resolve: (id: string) => Promise<unknown>): Promise<ClientMetadataError> => {
    try { await resolve(URL_ID); } catch (err) { assert.ok(err instanceof ClientMetadataError); return err; }
    assert.fail('it was resolved');
  };
  const fetching = (fetcher: () => Promise<Response>, lookup: () => Promise<string[]> = async () => ['93.184.216.34']) =>
    createClientMetadataResolver(OAUTH_SCOPES, fetcher, lookup);

  it("couldn't be fetched: temporary, with why (the network's code, a timeout, the status)", async () => {
    const reset = await failure(fetching(async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }); }));
    assert.deepEqual([reset.temporary, reset.detail], [true, 'ECONNRESET']);
    const timedOut = await failure(fetching(async () => { throw new DOMException('The operation timed out.', 'TimeoutError'); }));
    assert.deepEqual([timedOut.temporary, timedOut.detail], [true, 'TimeoutError']);
    for (const status of [403, 429, 500, 503]) {
      const refused = await failure(fetching(async () => new Response('no', { status })));
      assert.deepEqual([refused.temporary, refused.detail], [true, `HTTP ${status}`], String(status));
    }
    const notResolved = await failure(fetching(async () => new Response(doc()), async () => { throw Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' }); }));
    assert.deepEqual([notResolved.temporary, notResolved.detail], [true, 'EAI_AGAIN']);
  });

  it('turned down for what it is: not temporary', async () => {
    for (const body of [doc({ client_id: 'https://other.example/c.json' }), doc({ redirect_uris: [] }), 'not json']) {
      assert.equal((await failure(resolverWith(body).resolve)).temporary, false, body);
    }
    const missing = await failure(fetching(async () => new Response('gone', { status: 404 })));
    assert.deepEqual([missing.temporary, missing.detail], [false, 'HTTP 404']);
    assert.equal((await failure(fetching(async () => new Response(doc()), async () => ['10.0.0.5']))).temporary, false);
  });

  // A pinned client's document, when its host turns the server down: the copy, read as the
  // document would be; a document fetched always wins.
  const CLAUDE_ID = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
  const pinning = (fetcher: () => Promise<Response>) => {
    const logged: string[] = [];
    let fetched = 0;
    const resolve = createClientMetadataResolver(OAUTH_SCOPES, async () => { fetched += 1; return fetcher(); }, async () => ['104.18.32.47'], line => logged.push(line));
    return { resolve, logged, fetched: () => fetched };
  };

  it("a pinned client whose document can't be fetched is its pinned copy, logged, and fetched again next time", async () => {
    assert.ok(PINNED_DOCUMENTS[CLAUDE_ID]);
    const { resolve, logged, fetched } = pinning(async () => new Response('Just a moment...', { status: 403 }));
    const client = await resolve(CLAUDE_ID);
    assert.equal(client.name, 'Claude');
    assert.equal(client.type, 'public');
    assert.deepEqual(client.redirect_uris, ['https://claude.ai/api/mcp/auth_callback']);
    assert.deepEqual(logged, [`[oauth] client metadata ${CLAUDE_ID}: using the pinned copy, client_id's document answered 403 (HTTP 403)`]);
    await resolve(CLAUDE_ID);
    assert.equal(fetched(), 2);
    assert.equal((await pinning(async () => new Response('no', { status: 403 })).resolve('https://claude.ai/oauth/claude-code-client-metadata')).name, 'Claude Code');
  });

  it("one not pinned whose document can't be fetched is still a temporary failure", async () => {
    const { resolve, logged } = pinning(async () => new Response('Just a moment...', { status: 403 }));
    const err = await failure(resolve);
    assert.deepEqual([err.temporary, err.detail], [true, 'HTTP 403']);
    assert.deepEqual(logged, []);
  });

  it('a pinned client whose document is fetched is what the document says', async () => {
    const fetchedDoc = JSON.stringify({ client_id: CLAUDE_ID, client_name: 'Claude (fetched)', redirect_uris: ['https://claude.ai/api/mcp/new_callback'] });
    const { resolve, logged } = pinning(async () => new Response(fetchedDoc));
    const client = await resolve(CLAUDE_ID);
    assert.equal(client.name, 'Claude (fetched)');
    assert.deepEqual(client.redirect_uris, ['https://claude.ai/api/mcp/new_callback']);
    assert.deepEqual(logged, []);
  });

  it('knows a private address when it sees one', () => {
    for (const ip of ['0.0.0.0', '10.1.1.1', '192.168.0.1', '198.18.0.1', '224.0.0.1', '::', '::1', 'fe80::1', '::ffff:10.0.0.1']) assert.equal(isPrivateIp(ip), true, ip);
    for (const ip of ['8.8.8.8', '2606:4700::1111', '::ffff:8.8.8.8']) assert.equal(isPrivateIp(ip), false, ip);
  });
});
