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

/**
 * GitHub OAuth - Redirect to GitHub
 * GET /auth/github?callback=<callbackUrl>
 */
export const githubAuth = (req, res) => {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const callbackUrl =
      req.query.callback || `${process.env.GITHUB_CALLBACK_URL}`;
    const scope = "user:email";
    const state = Math.random().toString(36).substring(7); // Simple state for CSRF protection

    // Store state in session or temporary storage if needed
    const redirectUri = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scope}&state=${state}`;

    console.log("[Auth] Redirecting to GitHub OAuth:", {
      clientId: clientId?.substring(0, 10) + "...",
      callbackUrl,
      state,
    });

    res.redirect(redirectUri);
  } catch (error) {
    console.error("GitHub auth error:", error);
    res.status(500).json({ error: "GitHub authentication failed" });
  }
};

/**
 * GitHub OAuth Callback
 * GET /auth/github/callback?code=<code>&state=<state>
 */
export const githubCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL;

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("[Auth] Token exchange failed:", error);
      return res
        .status(401)
        .json({ error: "Failed to exchange authorization code" });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(401).json({ error: "No access token received" });
    }

    // Fetch user profile
    const profileResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        "User-Agent": "Conduit-Extension",
      },
    });

    if (!profileResponse.ok) {
      return res.status(401).json({ error: "Failed to fetch user profile" });
    }

    const profile = await profileResponse.json();

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
    const jwtToken = sign(
      { userId: user._id, githubId: user.githubId },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    // Redirect back to VS Code extension with token
    // Using the custom conduit:// URI scheme registered in the extension
    const redirectUrl = `conduit://auth-success?token=${jwtToken}`;
    console.log("[Auth] GitHub OAuth successful, redirecting to extension");

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("GitHub callback error:", error);
    res.status(500).json({ error: "GitHub callback failed" });
  }
};
