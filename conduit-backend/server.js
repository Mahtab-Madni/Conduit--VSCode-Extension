import dotenv from "dotenv";
import express, { json, urlencoded } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import {
  authRouter,
  userRouter,
  aiRouter,
  collectionRouter,
  snapshotRouter,
} from "./routes/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Database connection
connectDB();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for development (adjust for production)
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// CORS
app.use(
  cors({
    origin: true,
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

// Body parsing
app.use(json({ limit: "10mb" }));
app.use(urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/ai", aiRouter);
app.use("/api/collections", collectionRouter);
app.use("/api/snapshots", snapshotRouter);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler (must be after all routes)
app.use(notFoundHandler);

app.listen(PORT, () => {
  console.log(`Conduit Backend running on port ${PORT}`);
  console.log(`MongoDB URI: ${process.env.MONGODB_URI}`);
});

export default app;
