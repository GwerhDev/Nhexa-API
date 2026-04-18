require("dotenv").config();
const app = require('./app');
const { port, environment } = require("./config");
const mongoDb = require("./integrations/mongodb");
const createStreamByServer = require("./integrations/streamby");

async function main() {
  console.log(environment);
  const server = createStreamByServer(app);
  try {
    await mongoDb.connect();
    server.listen(port, () => console.log(`server listening on port ${port}`));
  } catch (error) {
    server.listen(port, () => console.log(`server listening on port ${port}`));
  }
}

main();
