require("dotenv").config();
const server = require('./app');
const { port, environment } = require("./config");
const prismaDb = require("./integrations/prisma");
const mongooseDb = require("./integrations/mongoose");

async function main() {
  console.log(environment)
  try {
    await prismaDb.connect();
    await mongooseDb.connect();
    
    server.listen(port, ()=> console.log(`server listening on port ${port}`));
  } catch (error) {
    server.listen(port, ()=> console.log(`server listening on port ${port}`));
  }
};

main();