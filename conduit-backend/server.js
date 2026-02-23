import dotenv from "dotenv";
import express, { json, urlencoded } from "express";
import mongoose from "mongoose";
import cors from "cors";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Groq from "groq-sdk";
import { User, RouteSnapshot, Collection } from "./models/index.js";

dotenv.config();
const { connect, connection } = mongoose;
const { verify, sign } = jwt;

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for development
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// More strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit auth attempts
  message: "Too many authentication attempts, please try again later.",
});

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(json({ limit: "10mb" }));
app.use(urlencoded({ extended: true }));
app.use(passport.initialize());

// MongoDB connection
connect(process.env.MONGODB_URI || "mongodb://localhost:27017/conduit")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Passport GitHub Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ githubId: profile.id });

        if (user) {
          // Update existing user
          user.accessToken = accessToken;
          user.refreshToken = refreshToken;
          user.displayName = profile.displayName || profile.username;
          user.email = profile.emails?.[0]?.value;
          user.avatarUrl = profile.photos?.[0]?.value;
          await user.save();
        } else {
          // Create new user
          user = new User({
            githubId: profile.id,
            username: profile.username,
            displayName: profile.displayName || profile.username,
            email: profile.emails?.[0]?.value,
            avatarUrl: profile.photos?.[0]?.value,
            profileUrl: profile.profileUrl,
            accessToken,
            refreshToken,
          });
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    },
  ),
);

// JWT middleware for protected routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  verify(token, process.env.JWT_SECRET, async (err, payload) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }

    try {
      const user = await User.findById(payload.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      req.user = user;
      next();
    } catch (error) {
      return res.status(500).json({ error: "Server error" });
    }
  });
};

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Authentication Routes
app.get(
  "/auth/github",
  authLimiter,
  passport.authenticate("github", { scope: ["user:email"] }),
);

app.get(
  "/auth/github/callback",
  authLimiter,
  passport.authenticate("github", { session: false }),
  (req, res) => {
    const token = sign(
      { userId: req.user._id, githubId: req.user.githubId },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    // Create a simple HTML page that redirects to VS Code
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Conduit Authentication</title>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: #f5f5f5;
          }
          .container { 
            max-width: 500px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .success { color: #28a745; margin-bottom: 20px; }
          .instructions { margin: 20px 0; line-height: 1.5; }
          .button { 
            display: inline-block; 
            background: #007acc; 
            color: white; 
            padding: 10px 20px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 10px;
          }
          .loading { margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="success">Authentication Successful!</h2>
          <div class="instructions">
            <p>You have successfully logged in to Conduit.</p>
            <div class="loading">Redirecting to VS Code...</div>
          </div>
          <a href="conduit://auth-success?token=${encodeURIComponent(token)}" class="button" id="vscode-link">
            Open in VS Code
          </a>
          <br>
          <small>If VS Code doesn't open automatically, click the button above.</small>
        </div>

        <script>
          // Automatically try to redirect to VS Code
          setTimeout(function() {
            window.location.href = 'conduit://auth-success?token=${encodeURIComponent(token)}';
          }, 1000);
          
          // Also try alternative approaches
          setTimeout(function() {
            // Try to close the window if opened in a popup
            try {
              window.close();
            } catch (e) {
              console.log('Cannot close window');
            }
          }, 3000);
        </script>
      </body>
      </html>
    `;

    res.send(html);
  },
);

// User Routes
app.get("/api/user/me", authenticateToken, (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    displayName: req.user.displayName,
    email: req.user.email,
    avatarUrl: req.user.avatarUrl,
  });
});

// AI Routes - Payload Prediction
app.post("/api/ai/predict-payload", async (req, res) => {
  try {
    const { routeInfo, mongoData } = req.body;

    if (!routeInfo) {
      return res.status(400).json({ error: "Route information is required" });
    }

    // Build prompt for Groq
    let prompt = `Based on this API route information, generate a realistic JSON payload:\n\n`;
    prompt += `Route: ${routeInfo.method} ${routeInfo.path}\n`;
    
    if (routeInfo.description) {
      prompt += `Description: ${routeInfo.description}\n`;
    }

    if (routeInfo.parameters && routeInfo.parameters.length > 0) {
      prompt += `Parameters: ${JSON.stringify(routeInfo.parameters, null, 2)}\n`;
    }

    if (mongoData && mongoData.length > 0) {
      prompt += `\nExample data from MongoDB:\n${JSON.stringify(mongoData, null, 2)}\n`;
    }

    prompt += `\nGenerate a realistic JSON payload for this ${routeInfo.method} request. Only respond with valid JSON, no explanations.`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system", 
          content: "You are an API payload expert. Generate realistic JSON payloads based on route information. Only respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama3-8b-8192",
      temperature: 0.7,
      max_tokens: 1000
    });

    const generatedContent = completion.choices[0]?.message?.content;
    
    if (!generatedContent) {
      throw new Error("No response from AI");
    }

    // Try to parse as JSON to validate
    let payload;
    try {
      payload = JSON.parse(generatedContent);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        payload = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("AI did not return valid JSON");
      }
    }

    res.json({
      success: true,
      payload,
      metadata: {
        model: "llama3-8b-8192",
        usedMongoData: !!(mongoData && mongoData.length > 0)
      }
    });

  } catch (error) {
    console.error("AI Payload Prediction Error:", error);
    res.status(500).json({ 
      error: "Failed to generate payload prediction",
      details: error.message 
    });
  }
});

// Collection Routes
app.get("/api/collections", authenticateToken, async (req, res) => {
  try {
    const collections = await Collection.getUserCollections(req.user._id);
    res.json(collections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/collections", authenticateToken, async (req, res) => {
  try {
    const collection = new Collection({
      ...req.body,
      userId: req.user._id,
    });
    await collection.save();
    res.status(201).json(collection);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/collections/:id", authenticateToken, async (req, res) => {
  try {
    const collection = await Collection.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true },
    );
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    res.json(collection);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/collections/:id", authenticateToken, async (req, res) => {
  try {
    const collection = await Collection.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    // Also delete associated snapshots
    await RouteSnapshot.deleteMany({ collectionId: req.params.id });

    res.json({ message: "Collection deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route Snapshot Routes
app.post("/api/snapshots", authenticateToken, async (req, res) => {
  try {
    const {
      routeId,
      routePath,
      method,
      filePath,
      lineNumber,
      code,
      predictedPayload,
      lastResponse,
      metadata,
      collectionId,
      tags,
    } = req.body;

    // Create code hash for deduplication
    const crypto = require("crypto");
    const codeHash = crypto.createHash("md5").update(code).digest("hex");

    // Check if we already have this exact snapshot
    const existingSnapshot = await RouteSnapshot.findOne({
      userId: req.user._id,
      routeId,
      codeHash,
    });

    if (existingSnapshot) {
      return res.json({
        message: "No changes detected, snapshot skipped",
        snapshot: existingSnapshot,
      });
    }

    const snapshot = new RouteSnapshot({
      userId: req.user._id,
      routeId,
      routePath,
      method,
      filePath,
      lineNumber,
      code,
      codeHash,
      predictedPayload,
      lastResponse,
      metadata,
      collectionId,
      tags,
    });

    await snapshot.save();

    // Update collection stats if associated with a collection
    if (collectionId) {
      const collection = await Collection.findById(collectionId);
      if (collection) {
        await collection.updateStats();
      }
    }

    res.status(201).json(snapshot);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get(
  "/api/snapshots/route/:routeId",
  authenticateToken,
  async (req, res) => {
    try {
      const { limit = 20, skip = 0 } = req.query;
      const snapshots = await RouteSnapshot.find({
        userId: req.user._id,
        routeId: req.params.routeId,
      })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .populate("collectionId", "name color")
        .exec();

      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.get("/api/snapshots/:id", authenticateToken, async (req, res) => {
  try {
    const snapshot = await RouteSnapshot.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate("collectionId", "name color");

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/snapshots/:id", authenticateToken, async (req, res) => {
  try {
    const snapshot = await RouteSnapshot.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    // Update collection stats if needed
    if (snapshot.collectionId) {
      const collection = await Collection.findById(snapshot.collectionId);
      if (collection) {
        await collection.updateStats();
      }
    }

    res.json({ message: "Snapshot deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Diff API - Compare two snapshots
app.post("/api/snapshots/diff", authenticateToken, async (req, res) => {
  try {
    const { snapshotId1, snapshotId2 } = req.body;

    const [snapshot1, snapshot2] = await Promise.all([
      RouteSnapshot.findOne({ _id: snapshotId1, userId: req.user._id }),
      RouteSnapshot.findOne({ _id: snapshotId2, userId: req.user._id }),
    ]);

    if (!snapshot1 || !snapshot2) {
      return res.status(404).json({ error: "One or both snapshots not found" });
    }

    // Simple diff implementation
    const diff = {
      code: {
        old: snapshot1.code,
        new: snapshot2.code,
        changed: snapshot1.codeHash !== snapshot2.codeHash,
      },
      payload: {
        old: snapshot1.predictedPayload,
        new: snapshot2.predictedPayload,
        changed:
          JSON.stringify(snapshot1.predictedPayload) !==
          JSON.stringify(snapshot2.predictedPayload),
      },
      timestamps: {
        old: snapshot1.createdAt,
        new: snapshot2.createdAt,
      },
    };

    res.json(diff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server Error:", error);
  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  await connection.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Conduit Backend running on port ${PORT}`);
  console.log(
    `MongoDB URI: ${process.env.MONGODB_URI || "mongodb://localhost:27017/conduit"}`,
  );
});

export default app;
