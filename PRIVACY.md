# Privacy Policy

## Conduit – AI‑Powered API Playground for VS Code

**Last Updated:** April 2026

This Privacy Policy describes how Conduit ("we," "us," "our," or the "extension") handles user data and protects your privacy. Conduit is a developer productivity extension designed for secure API testing within VS Code.

---

## 1. Data Collection

**Personal Information:** Conduit does not collect, store, or transmit any personal information from users.

**Local Processing:** All API routes, payloads, test data, and configurations are processed exclusively within your VS Code environment. No data is transmitted to our servers.

**Database Credentials:** MongoDB and other database connections are configured by you locally. Conduit does not store, log, or transmit database credentials under any circumstances.

**API Keys:** AI-powered payload generation requires an OpenAI API key or optional Groq API key. These keys are:

- Stored exclusively in local `.env` files on your machine
- Never transmitted to Conduit developers or third parties
- Never logged or recorded in any way

---

## 2. Data Sharing and Third Parties

**Third-Party Services:** Conduit does not share user data with third parties except when explicitly configured by you:

- OpenAI (for AI-powered features) — subject to [OpenAI's Privacy Policy](https://openai.com/privacy)
- Groq (for optional AI features) — subject to Groq's privacy terms
- MongoDB Atlas (for database operations) — subject to [MongoDB's Privacy Policy](https://www.mongodb.com/legal/privacy-policy)

**Analytics and Telemetry:** We do not collect, store, or transmit any telemetry, usage analytics, or diagnostic data.

---

## 3. Security Measures

**Environment Variables:** Sensitive credentials are stored in `.env` files, which are configured to be excluded from version control (`.gitignore`).

**Authentication:** JWT (JSON Web Tokens) is used to secure backend-to-extension communication where applicable.

**Best Practices for Users:** MongoDB Atlas users should:

- Enable IP whitelisting for production environments
- Use strong, unique credentials
- Regularly rotate API keys
- Review access controls and permissions

---

## 4. Data Retention

We do not retain any user data, configurations, or API credentials. All data remains under your control and stored locally on your machine.

---

## 5. Your Rights and Choices

You have full control over:

- What data Conduit processes (local to your machine)
- Which external services Conduit connects to
- When and how you provide API keys and credentials
- Deletion of all local configuration and data (via VS Code settings)

---

## 6. Contact Us

For questions, privacy concerns, or to report a security issue, please contact us:

- **GitHub Issues:** [Conduit Repository](https://github.com)
- **Email:** mahtabjmi2005@gmail.com

For security vulnerabilities, please email directly rather than opening a public issue.

---

## 7. Changes to This Policy

We may update this Privacy Policy to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify users of significant changes. Continued use of Conduit constitutes acceptance of the updated policy.
