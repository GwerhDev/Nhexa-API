import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

async function connect() {
  try {
    await prisma.$connect();
    console.log("Successfully connected to Supabase (Prisma)");
  } catch (error) {
    console.error("Unable to connect to Supabase (Prisma)", error);
    throw error;
  }
}

async function disconnect() {
  await prisma.$disconnect();
  console.log("Disconnected from Supabase (Prisma)");
}

export { prisma, connect, disconnect };
