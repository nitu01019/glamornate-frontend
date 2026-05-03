# Security Policy

## Reporting a Vulnerability

If you believe you have found a security vulnerability in the Glamornate frontend (or the deployed Glamornate app), please **do not** open a public issue.

Instead, email a private disclosure to: **security@glamornate.app** (or open a GitHub Security Advisory if you have access).

Include in your report:
- A description of the vulnerability and its potential impact
- Steps to reproduce
- Any proof-of-concept code or screenshots
- Your contact information

## Disclosure Window

We commit to:
- Acknowledging receipt within 5 business days
- Providing an initial assessment within 14 days
- Coordinating public disclosure no earlier than 90 days after the fix is deployed (unless mutually agreed otherwise)

## Scope

In scope:
- This repository (frontend Next.js app)
- The companion backend repository (`glamornate-backend-`)
- The deployed production application

Out of scope:
- Social engineering, phishing, or physical security
- Vulnerabilities in third-party services not under our control (Firebase, Vercel, Sentry, etc.) — please report to the respective vendor
- Spam, denial-of-service via traffic flooding, or rate-limit bypass without demonstrable impact

## Safe Harbor

We will not pursue legal action against researchers who:
- Make a good-faith effort to avoid privacy violations and disruption
- Only interact with their own accounts or accounts they have explicit permission to test
- Report vulnerabilities promptly and in good faith
- Refrain from public disclosure until coordinated with us
