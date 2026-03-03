import { Router } from "express";
import { predictions, suggestErrorFix } from "../controllers/AiController.js";

const aiRouter = Router();

aiRouter.post("/predict-payload", predictions);
aiRouter.post("/suggest-error-fix", suggestErrorFix);

export default aiRouter;
