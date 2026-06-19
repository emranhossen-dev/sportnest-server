import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);
let db;

export const connectDB = async () => {
  try {
    await client.connect();
    db = client.db('sportnest');
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
};

export const getDB = () => {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
};