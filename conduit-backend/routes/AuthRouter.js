import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  login,
  githubAuth,
  githubCallback,
} from "../controllers/AuthController.js";

const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit auth attempts
  message: "Too many authentication attempts, please try again later.",
});

authRouter.post("/vscode", authLimiter, login);
authRouter.get("/github", githubAuth);
authRouter.get("/github/callback", githubCallback);

export default authRouter;
