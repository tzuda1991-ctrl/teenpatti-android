# Teen Patti Android + Railway (virtual chips)

**India-only virtual-chips practice project. No cash betting, deposits, withdrawals or redeemable rewards.**

## Current implementation
- Android starter APK with local card dealing and practice chips
- Node backend with registration/login, hashed passwords, session tokens
- WebSocket table lobby (2–6 seats), server-side shuffled cards, seen/pack/show
- Hand-ranking tests
- Railway-compatible Docker deployment and /admin dashboard
- PostgreSQL player/virtual-chip storage when DATABASE_URL is configured

## Not yet production-ready
Android does not yet connect to backend. Chaal and settlement are intentionally disabled. No complete online gameplay, advanced animations, matchmaking, reconnect, anti-cheat review, session persistence, CSRF protection or production rate limits. Do not launch publicly without security review.

## Railway
Deploy this repository as a service. Root railway.json points to server/Dockerfile. Add PostgreSQL and set DATABASE_URL using Railway variable reference. Set ADMIN_USER and a long random ADMIN_PASSWORD as Railway service variables. Generate a public domain in Railway Networking. Visit https://YOUR-DOMAIN/admin for the admin login and https://YOUR-DOMAIN/health for status. Do not commit credentials.

## GitHub Actions
Open Actions > Build Android APK > Run workflow. Download the debug APK artifact after a successful build.
