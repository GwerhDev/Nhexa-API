const mongoose = require("mongoose");
const { mongodbString } = require("../config");

async function connect() {
  try {
    await mongoose.connect(mongodbString);
    console.log("Successfully connected to MongoDB (Mongoose)");
  } catch (error) {
    console.error("Unable to connect to MongoDB (Mongoose)", error);
    throw error;
  }
}

async function disconnect() {
  await mongoose.disconnect();
  console.log("Disconnected from MongoDB");
}

module.exports = {
  connect,
  disconnect,
};