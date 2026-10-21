/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedRedirect, isRegisteredOrigin, parseOrigins } from '../src/integrations/redirects';

const REGISTERED = parseOrigins("['http://localhost:5173', 'http://localhost:5174', 'https://spellcast.example.com']");

describe('parseOrigins', () => {
  it('reads ALLOWED_ORIGINS as a list or comma-separated, keeping only origins', () => {
    assert.deepEqual(REGISTERED, ['http://localhost:5173', 'http://localhost:5174', 'https://spellcast.example.com']);
    assert.deepEqual(parseOrigins('https://a.nhexa.cl/path, not a url ,https://b.example.com'), ['https://a.nhexa.cl', 'https://b.example.com']);
    assert.deepEqual(parseOrigins(undefined), []);
  });
});

describe('isAllowedRedirect', () => {
  it('lets a login go back to Nhexa\'s own sites, over https', () => {
    for (const target of ['https://nhexa.cl', 'https://accounts.nhexa.cl/', 'https://streamby.nhexa.cl/projects?x=1']) {
      assert.equal(isAllowedRedirect(target, REGISTERED), true, target);
    }
  });

  it('lets a login go back to a registered origin, exactly', () => {
    assert.equal(isAllowedRedirect('http://localhost:5174/somewhere', REGISTERED), true);
    assert.equal(isAllowedRedirect('https://spellcast.example.com/x', REGISTERED), true);
    // Same host, another port or scheme: another origin.
    assert.equal(isAllowedRedirect('http://localhost:6666', REGISTERED), false);
    assert.equal(isAllowedRedirect('http://spellcast.example.com', REGISTERED), false);
  });

  it('turns down any other site, however it is dressed up', () => {
    for (const target of [
      'https://evil.example.com',
      'https://nhexa.cl.evil.example.com',
      'https://evilnhexa.cl',
      'http://accounts.nhexa.cl',
      'https://accounts.nhexa.cl@evil.example.com',
      'https://user:pass@accounts.nhexa.cl',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '//evil.example.com',
      '/relative/path',
      '',
    ]) {
      assert.equal(isAllowedRedirect(target, REGISTERED), false, target);
    }
  });

  it('turns down what isn\'t a single string', () => {
    assert.equal(isAllowedRedirect(undefined, REGISTERED), false);
    assert.equal(isAllowedRedirect(['https://accounts.nhexa.cl'], REGISTERED), false);
    assert.equal(isAllowedRedirect({ toString: () => 'https://accounts.nhexa.cl' }, REGISTERED), false);
  });
});

describe('isRegisteredOrigin (CORS)', () => {
  it('allows a registered origin, exactly', () => {
    assert.equal(isRegisteredOrigin('http://localhost:5173', REGISTERED), true);
    assert.equal(isRegisteredOrigin('https://spellcast.example.com', REGISTERED), true);
  });

  it('turns down an origin that is only part of a registered one, or none at all', () => {
    for (const origin of ['http://localhost', 'http://localhost:517', 'https://spellcast.example', 'https://example.com', 'null', '', undefined]) {
      assert.equal(isRegisteredOrigin(origin, REGISTERED), false, String(origin));
    }
  });
});

