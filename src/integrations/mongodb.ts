import { MongoClient } from 'mongodb';
import { mongodbString } from '../config';

const client = new MongoClient(mongodbString);

async function connect(): Promise<void> {
  try {
    await client.connect();
    console.log('Successfully connected to MongoDB (driver)');
  } catch (error) {
    console.error('Unable to connect to MongoDB (driver)', error);
    throw error;
  }
}

async function disconnect(): Promise<void> {
  await client.close();
  console.log('Disconnected from MongoDB');
}

export { connect, disconnect, client };
