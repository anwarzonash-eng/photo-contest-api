# Photo Contest API

The backend of a photo-contest community platform. Photographers upload photos to weekly and themed contests, vote and comment, follow each other and earn badges, and subscribe to paid memberships. The API handles users and authentication, contests and events, photo uploads and storage, voting and rankings, Stripe subscriptions and one-off purchases, e-mail through Mailchimp, real-time updates over Socket.IO and AI-assisted photo feedback.

It is paired with [photo-contest-cms](https://github.com/anwarzonash-eng/photo-contest-cms), the admin panel used by the site owner.

## Tech stack

- Node.js, Express 4, Babel
- PostgreSQL with Sequelize, Socket.IO
- Stripe (payments and webhooks), Mailchimp (marketing + transactional)
- Cloudinary and Backblaze B2 for image storage, AWS Secrets Manager (optional)
- OpenAI API, `node-cron` scheduled jobs, `winston` logging

## Getting started

Requirements: Node.js 18+ and a PostgreSQL database.

```bash
git clone https://github.com/anwarzonash-eng/photo-contest-api.git
cd photo-contest-api
npm install
cp .env.example .env      # fill in your own values
npm run dev               # nodemon + babel-node on PORT (default 3334)
```

Production: `npm run build && npm start`.

## Configuration

Configuration comes from environment variables; see [.env.example](.env.example). Real credentials must never be committed. Use Stripe test keys for development.

## Project structure

```
src/
  server.js, app.js   entry points
  controllers/        Express routes
  services/           business logic (contests, photos, payments, mail, ...)
  models/             Sequelize models
  dtos/ enums/        validation and constants
  middleware/         auth, errors, logging
  utils/              storage, scheduling, helpers
```

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## License

[MIT](LICENSE)
