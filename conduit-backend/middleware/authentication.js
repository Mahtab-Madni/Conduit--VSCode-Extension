import jwt from "jsonwebtoken";
import User from "../models/User.js";

const { verify } = jwt;

// JWT middleware for protected routes
export const authenticateToken = (req, res, next) => {
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
