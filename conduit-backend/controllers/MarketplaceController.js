import crypto from "crypto";

/**
 * Verify GitHub webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - X-Hub-Signature-256 header
 * @param {string} secret - Webhook secret
 * @returns {boolean}
 */
const verifyWebhookSignature = (payload, signature, secret) => {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  const expectedSignature = `sha256=${hash}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
};

/**
 * Handle marketplace webhook events
 */
export const handleMarketplaceWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-hub-signature-256"];
    const payload = req.rawBody || JSON.stringify(req.body);
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    // Verify signature
    if (!secret) {
      console.error("GITHUB_WEBHOOK_SECRET not configured");
      return res.status(400).json({ error: "Webhook not configured" });
    }

    if (!signature || !verifyWebhookSignature(payload, signature, secret)) {
      console.warn("Invalid webhook signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body;
    const action = event.action;
    const marketplace_purchase = event.marketplace_purchase;

    console.log(`Received marketplace event: ${action}`);

    // Handle different event types
    switch (action) {
      case "purchased":
        await handlePurchased(marketplace_purchase);
        break;
      case "pending_change":
        await handlePendingChange(marketplace_purchase);
        break;
      case "pending_change_cancelled":
        await handlePendingChangeCancelled(marketplace_purchase);
        break;
      case "changed":
        await handleChanged(marketplace_purchase);
        break;
      case "cancelled":
        await handleCancelled(marketplace_purchase);
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Marketplace webhook error:", error);
    // Still return 200 to prevent GitHub from retrying
    res.status(200).json({ success: false, error: error.message });
  }
};

/**
 * Handle new purchase
 */
const handlePurchased = async (marketplacePurchase) => {
  const { account, plan, purchased_at } = marketplacePurchase;
  console.log(
    `New purchase: ${account.login} - Plan: ${plan.name} at ${purchased_at}`,
  );

  // TODO: Store in database
  // Example: await MarketplaceEvent.create({
  //   event_type: 'purchased',
  //   account_id: account.id,
  //   account_login: account.login,
  //   plan: plan.name,
  //   timestamp: new Date(purchased_at)
  // });
};

/**
 * Handle pending plan change
 */
const handlePendingChange = async (marketplacePurchase) => {
  const { account, plan, next_billing_date } = marketplacePurchase;
  console.log(
    `Pending change: ${account.login} - New plan: ${plan.name} (effective ${next_billing_date})`,
  );

  // TODO: Store pending change in database
};

/**
 * Handle cancelled pending change
 */
const handlePendingChangeCancelled = async (marketplacePurchase) => {
  const { account, plan } = marketplacePurchase;
  console.log(
    `Pending change cancelled: ${account.login} - Staying on plan: ${plan.name}`,
  );

  // TODO: Update database to remove pending change
};

/**
 * Handle plan change
 */
const handleChanged = async (marketplacePurchase) => {
  const { account, plan, changed_at } = marketplacePurchase;
  console.log(
    `Plan changed: ${account.login} - New plan: ${plan.name} at ${changed_at}`,
  );

  // TODO: Update database with new plan
};

/**
 * Handle cancellation
 */
const handleCancelled = async (marketplacePurchase) => {
  const { account, cancelled_at } = marketplacePurchase;
  console.log(`Subscription cancelled: ${account.login} at ${cancelled_at}`);

  // TODO: Update database to mark subscription as cancelled
};
