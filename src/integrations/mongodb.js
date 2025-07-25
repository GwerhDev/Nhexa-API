const { MongoClient } = require("mongodb");
const { mongodbString } = require("../config");

const client = new MongoClient(mongodbString);

async function connect() {
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB (driver)");
  } catch (error) {
    console.error("Unable to connect to MongoDB (driver)", error);
    throw error;
  }
}

async function disconnect() {
  await client.close();
  console.log("Disconnected from MongoDB");
}

module.exports = {
  connect,
  disconnect,
  client,
};