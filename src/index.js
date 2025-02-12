require("dotenv").config();
const server = require('./app');
const { port, environment } = require("./config");
const { sequelize } = require("./integrations/postgreSQL");

async function main() {
  console.log(environment)
  try {
    await sequelize.sync({ force: false });
    console.log("Succesfully connected");
    server.listen(port, ()=> console.log(`server listening on port ${port}`));
  } catch (error) {
    console.error("Unable to connect to database");
    server.listen(port, ()=> console.log(`server listening on port ${port}`));
  }
};

main();