# Roadmap

Planned work on this project:

## Security
- [ ] Remove hard-coded e-mail addresses and special-case users from `src/server.js` and services; use roles/config instead
- [ ] Restrict CORS to configured origins and add rate limiting
- [ ] Verify Stripe webhook signatures for every event type and add idempotency handling

## Code quality
- [ ] Break up the very large `server.js` into modules
- [ ] Add ESLint/Prettier and remove commented-out code
- [ ] Replace `sequelize.sync` with migrations
- [ ] Add unit and integration tests (Jest + Supertest)

## Features
- [ ] OpenAPI / Swagger documentation
- [ ] Background job queue (BullMQ) instead of in-process cron
- [ ] Better ranking and anti-fraud checks for voting
- [ ] Per-user notification preferences

## DevOps
- [ ] Dockerfile and docker-compose with PostgreSQL
- [ ] GitHub Actions workflow for lint, test and build
