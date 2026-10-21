/// <reference types="node" />
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { apiBodyParsers, streambyBodyParser, STREAMBY_PATH } from '../src/middleware/body';

// The API's parsers, and StreamBy's under its path, as app.ts and integrations/streamby mount them.
const app = express();
app.use(apiBodyParsers());
app.post('/login-inner', (req, res) => { res.json({ size: JSON.stringify(req.body).length }); });
app.use(STREAMBY_PATH, streambyBodyParser());
app.post(`${STREAMBY_PATH}/projects/p1/exports`, (req, res) => { res.json({ size: JSON.stringify(req.body).length }); });

let server: Server;
let base: string;
before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const post = (path: string, megabytes: number) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'x'.repeat(Math.round(megabytes * 1024 * 1024)) }),
});

describe('request body limits', () => {
  it('takes a small body in the API', async () => {
    assert.equal((await post('/login-inner', 0.1)).status, 200);
  });

  it('turns down a body over 1 MB in the API', async () => {
    assert.equal((await post('/login-inner', 2)).status, 413);
  });

  it('takes a bigger body in StreamBy (a node schema, a JSON export), up to 10 MB', async () => {
    assert.equal((await post(`${STREAMBY_PATH}/projects/p1/exports`, 2)).status, 200);
    assert.equal((await post(`${STREAMBY_PATH}/projects/p1/exports`, 11)).status, 413);
  });
});
