import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

// Force DNS to use IPv4 and system resolver
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); // Use Google & Cloudflare DNS

const { connect, connection } = mongoose;

// MongoDB connection options with Stable API
const clientOptions = {
  serverApi: {
    version: "1",
    strict: true,
    deprecationErrors: true,
  },
  // DNS resolution options for Windows compatibility
  family: 4, // Force IPv4
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

// Database connection function
export const connectDB = async () => {
  try {
    await connect(process.env.MONGODB_URI, clientOptions);
    // Ping the database to verify connection
    await connection.db.admin().command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } catch (err) {
    console.error("MongoDB connection error:", err);
    // Don't exit immediately, allow server to continue running
    console.warn("Server is running without MongoDB connection");
  }
};

// Graceful shutdown function
export const gracefulShutdown = async () => {
  try {
    await connection.close();
    console.log("MongoDB connection closed");
  } catch (err) {
    console.error("Error closing MongoDB connection:", err);
  }
};

export default { connectDB, gracefulShutdown };
