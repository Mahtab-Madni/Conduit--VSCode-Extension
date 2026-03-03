import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const { connect, connection } = mongoose;

// Database connection function
export const connectDB = async () => {
  try {
    await connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
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
