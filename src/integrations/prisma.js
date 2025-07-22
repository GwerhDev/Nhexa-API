const { PrismaClient } = require('@prisma/client');

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

module.exports = { prisma, connect, disconnect };
