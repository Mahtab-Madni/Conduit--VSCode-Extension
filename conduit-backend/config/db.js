import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

// Force DNS to use IPv4 and system resolver
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); // Use Google & Cloudflare DNS

const { connect, connection } = mongoose;

// Connection cache for serverless optimization
let cachedConnection = null;

// MongoDB connection options with Stable API - Optimized for Vercel
const clientOptions = {
  serverApi: {
    version: "1",
    strict: true,
    deprecationErrors: true,
  },
  // Connection pooling for serverless
  maxPoolSize: 5, // Reduced for Vercel limits
  minPoolSize: 1,
  maxIdleTimeMS: 45000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  family: 4, // Force IPv4
};

// Database connection function with caching for serverless
export const connectDB = async () => {
  // Return cached connection if available
  if (cachedConnection) {
    console.log("Using cached MongoDB connection");
    return cachedConnection;
  }

  try {
    const mongoConnection = await connect(
      process.env.MONGODB_URI,
      clientOptions,
    );

    // Cache the connection
    cachedConnection = mongoConnection;

    // Ping the database to verify connection
    await connection.db.admin().command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    return mongoConnection;
  } catch (err) {
    console.error("MongoDB connection error:", err);
    // Don't exit immediately, allow server to continue running
    console.warn("Server is running without MongoDB connection");
  }
};

// Graceful shutdown function (called on process termination)
export const gracefulShutdown = async () => {
  try {
    if (cachedConnection) {
      await connection.close();
      cachedConnection = null;
      console.log("MongoDB connection closed");
    }
  } catch (err) {
    console.error("Error closing MongoDB connection:", err);
  }
};

export default { connectDB, gracefulShutdown };
