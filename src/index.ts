import 'dotenv/config';
import app from './app';
import { port, environment } from './config';
import * as mongoDb from './integrations/mongodb';
import createStreamByServer from './integrations/streamby';

async function main(): Promise<void> {
  console.log(environment);
  const server = createStreamByServer(app);

  try {
    await mongoDb.connect();
  } catch {
    // continue without MongoDB if unavailable
  }

  server.listen(port, () => console.log(`server listening on port ${port}`));
}

main();
