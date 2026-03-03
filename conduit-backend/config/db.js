import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const { connect, connection } = mongoose;

// MongoDB connection options with Stable API
const clientOptions = {
  serverApi: {
    version: "1",
    strict: true,
    deprecationErrors: true,
  },
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
