import { Router } from "express";
import { authenticateToken } from "../middleware/authentication.js";
import { getMe } from "../controllers/UserController.js";

const userRouter = Router();

userRouter.get("/me", authenticateToken, getMe);

export default userRouter;
