/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createNhexaEnvironment, normalizeNhexaEnvironment } from '../src/integrations/nhexaEnvironment';

const EXPORT = [
  { _id: 'c1', _name: 'Creatividad', 1: { label: 'StreamBy', url: 'https://streamby.nhexa.cl' }, 0: { label: 'Spellcast', url: 'https://spellcast.nhexa.cl' }, note: 'x' },
  { _id: 'c2', _name: 'Juegos' },
];

describe("the Nhexa environment's catalog", () => {
  it('is its categories, with their apps in order', () => {
    assert.deepEqual(normalizeNhexaEnvironment(EXPORT), [
      { id: 'c1', name: 'Creatividad', apps: [{ label: 'Spellcast', url: 'https://spellcast.nhexa.cl' }, { label: 'StreamBy', url: 'https://streamby.nhexa.cl' }] },
      { id: 'c2', name: 'Juegos', apps: [] },
    ]);
    assert.deepEqual(normalizeNhexaEnvironment({ not: 'a list' }), []);
  });

  it('is read once in a while, and the last one read is kept when it fails', async () => {
    let clock = 0;
    let fetched = 0;
    let failing = false;
    const apps = createNhexaEnvironment('https://api.nhexa.test/streamby/p/export', async () => {
      fetched += 1;
      return failing ? new Response('down', { status: 503 }) : new Response(JSON.stringify(EXPORT));
    }, () => clock);

    assert.equal((await apps())[0].apps.length, 2);
    await apps();
    assert.equal(fetched, 1);

    clock += 6 * 60 * 1000;
    failing = true;
    assert.equal((await apps())[0].name, 'Creatividad');
    assert.equal(fetched, 2);
  });

  it('is empty without its URL', async () => {
    assert.deepEqual(await createNhexaEnvironment(undefined)(), []);
  });
});
