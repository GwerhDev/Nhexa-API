require("dotenv").config();
const server = require('./app');
const { port, environment } = require("./config");
const mongooseDb = require("./integrations/mongoose");

async function main() {
  console.log(environment)
  try {
    await mongooseDb.connect();
    
    server.listen(port, ()=> console.log(`server listening on port ${port}`));
  } catch (error) {
    server.listen(port, ()=> console.log(`server listening on port ${port}`));
  }
};

main();