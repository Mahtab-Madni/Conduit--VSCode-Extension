import { Router } from "express";
import { handleMarketplaceWebhook } from "../controllers/MarketplaceController.js";

const router = Router();

/**
 * POST /api/marketplace/webhook
 * GitHub Marketplace webhook endpoint
 */
router.post("/webhook", handleMarketplaceWebhook);

export default router;
