import bodyParser from 'body-parser';
import type { RequestHandler } from 'express';

// How big a request body may be. The API's own routes take small JSON (forms, settings):
// files never go through it (they're uploaded straight to storage with presigned URLs).
// StreamBy, mounted under /streamby, parses its own bodies with a larger limit -- a node
// schema or a JSON export can be big.
export const API_BODY_LIMIT = '1mb';
export const STREAMBY_BODY_LIMIT = '10mb';
export const STREAMBY_PATH = '/streamby';

const underStreamBy = (path: string) => path === STREAMBY_PATH || path.startsWith(`${STREAMBY_PATH}/`);

/** The API's body parsers (JSON and forms), leaving StreamBy's routes to its own. */
export const apiBodyParsers = (): RequestHandler[] =>
  [bodyParser.json({ limit: API_BODY_LIMIT }), bodyParser.urlencoded({ limit: API_BODY_LIMIT, extended: true })]
    .map((parse): RequestHandler => (req, res, next) => (underStreamBy(req.path) ? next() : parse(req, res, next)));

/** StreamBy's body parser. */
export const streambyBodyParser = (): RequestHandler => bodyParser.json({ limit: STREAMBY_BODY_LIMIT });
