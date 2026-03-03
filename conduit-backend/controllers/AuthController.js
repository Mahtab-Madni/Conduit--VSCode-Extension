import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { User } from "../models/index.js";

const { sign } = jwt;

/**
 * VS Code authentication
 * POST /auth/vscode
 */
export const login = async (req, res) => {
  try {
    const { accessToken, account } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: "Access token is required" });
    }

    // Fetch user profile from GitHub using the provided token
    const githubResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        "User-Agent": "Conduit-Extension",
      },
    });

    if (!githubResponse.ok) {
      return res.status(401).json({ error: "Invalid GitHub token" });
    }

    const profile = await githubResponse.json();

    // Look for existing user or create new one
    let user = await User.findOne({ githubId: profile.id });

    if (user) {
      // Update existing user
      user.accessToken = accessToken;
      user.displayName = profile.name || profile.login;
      user.email = profile.email;
      user.avatarUrl = profile.avatar_url;
      await user.save();
    } else {
      // Create new user
      user = new User({
        githubId: profile.id,
        username: profile.login,
        displayName: profile.name || profile.login,
        email: profile.email,
        avatarUrl: profile.avatar_url,
        profileUrl: profile.html_url,
        accessToken,
      });
      await user.save();
    }

    // Create JWT token
    const token = sign(
      { userId: user._id, githubId: user.githubId },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("VS Code auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};
