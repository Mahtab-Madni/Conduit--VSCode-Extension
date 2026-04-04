# GitHub Marketplace Webhook Setup

## Overview

This backend now includes webhook support for GitHub Marketplace events. When users purchase, upgrade, downgrade, or cancel subscriptions to your extension, GitHub will send POST requests to your webhook endpoint.

## Setup Steps

### 1. Generate a Webhook Secret

In Node.js:

```javascript
const crypto = require("crypto");
const secret = crypto.randomBytes(32).toString("hex");
console.log(secret);
```

Or use openssl:

```bash
openssl rand -hex 32
```

### 2. Configure Environment Variable

Add to your `.env` file:

```
GITHUB_WEBHOOK_SECRET=<your-generated-secret>
```

### 3. Set Up Webhook in GitHub Marketplace

1. Go to your app's GitHub Marketplace listing
2. Navigate to **Manage webhook** settings
3. Fill in the form:
   - **Payload URL**: `https://your-domain.com/api/marketplace/webhook`
   - **Content type**: `application/x-www-form-urlencoded`
   - **Secret**: Paste your generated secret
   - **Active**: Check this box
4. Click **Create webhook**

## Webhook Events

The endpoint handles these GitHub Marketplace events:

| Event                      | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `purchased`                | New subscription purchased                                       |
| `pending_change`           | User scheduled a plan change (takes effect at next billing date) |
| `pending_change_cancelled` | User cancelled a pending plan change                             |
| `changed`                  | Plan change took effect                                          |
| `cancelled`                | Subscription was cancelled                                       |

## Webhook Payload

GitHub sends a JSON payload with structure:

```json
{
  "action": "purchased",
  "marketplace_purchase": {
    "account": {
      "type": "Organization",
      "id": 12345,
      "login": "example-org",
      "country_code": "US"
    },
    "plan": {
      "id": 123,
      "name": "Pro",
      "description": "Features for professional teams",
      "monthly_price_in_cents": 9900
    },
    "purchased_at": "2024-01-15T12:00:00Z"
  }
}
```

## Implementation

The webhook handler is located in `/controllers/MarketplaceController.js`. Currently, it logs events but doesn't store them. To persist data:

1. Create a MongoDB model for marketplace events:

```javascript
// models/MarketplaceEvent.js
const eventSchema = new Schema({
  event_type: String,
  account_id: Number,
  account_login: String,
  plan: String,
  timestamp: Date,
});
```

2. Update the event handlers in `MarketplaceController.js` to save to database

## Testing

To test locally with ngrok:

1. Install ngrok: `npm install -g ngrok`
2. Start ngrok: `ngrok http 3002`
3. Use the ngrok URL as your Payload URL in GitHub
4. Send test payloads using GitHub's webhook testing interface

## Security

✅ Webhook signatures are verified using HMAC-SHA256
✅ Invalid signatures are rejected with 401 Unauthorized
✅ Always responds with 200 to prevent GitHub retries (events are logged first)
✅ Uses `crypto.timingSafeEqual()` to prevent timing attacks

## Troubleshooting

**"Webhook not configured"**: Set `GITHUB_WEBHOOK_SECRET` in your `.env` file

**"Invalid signature"**: Verify the secret matches exactly what's configured in GitHub Marketplace settings

**No events received**: Check that the Payload URL is publicly accessible and the "Active" checkbox is enabled in GitHub
