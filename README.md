# WhatsApp Bulk Messaging CRM

A production-ready, full-stack WhatsApp Bulk Messaging CRM with smart number rotation, BullMQ-powered queues, two-way conversations, and Stripe billing — built to run entirely on free-tier platforms.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, TypeScript 5.4, Express 4.19, Drizzle ORM |
| Database | Neon DB (serverless PostgreSQL) |
| Queue | BullMQ 5 + Upstash Redis |
| Realtime | Socket.IO 4.7 |
| Payments | Stripe 15 |
| Frontend | React 18, Vite 5, TailwindCSS 3.4, shadcn/ui |
| Charts | Recharts 2 |
| Deployment | Docker + docker-compose, Render (backend), Vercel (frontend) |

## Features

- **Multi-number support** — Add unlimited WhatsApp numbers, each with its own `phone_number_id` and `access_token`
- **Smart rotation** — Proportional allocation based on daily limits × health score; auto-failover to best available number
- **Rate limiting** — 1 message/sec per number via BullMQ `RateLimiterWorker`, exponential backoff with 5 retries
- **Auto-pause** — Numbers with health score < 40 or ≥ 25 errors are automatically paused
- **Failed message export** — Download failed messages per campaign as CSV or XLSX, then retry
- **Two-way inbox** — Webhook-driven inbound messages, conversation threads, auto-replies by keyword
- **Campaign builder** — Select leads + numbers, launch, track progress in real time via WebSocket
- **Analytics dashboard** — Delivery rate, read rate, reply rate, per-number health, Recharts charts
- **Stripe billing** — $49 setup + $29/month subscription
- **Token encryption** — All WhatsApp access tokens encrypted at rest with AES-256-GCM

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/         # Zod-validated env, DB, Redis
│   │   ├── db/             # Drizzle schema & migrations
│   │   ├── middleware/     # Auth, error, validation
│   │   ├── queues/         # BullMQ queue engine
│   │   ├── routes/         # Express routers
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Logger, crypto, export
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/            # Typed API wrappers
│   │   ├── components/     # UI primitives + layout
│   │   ├── context/        # AuthContext + socket
│   │   ├── lib/            # api-client, auth, utils
│   │   └── pages/          # All page components
│   ├── docker/
│   │   └── nginx.conf
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml
```

## Quick Start

### 1. Configure environment variables

```bash
cp .env.example .env
```

Fill in all values in `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon DB connection string (postgresql://...) |
| `REDIS_URL` | Upstash Redis URL (rediss://...) |
| `JWT_SECRET` | At least 32 random characters |
| `JWT_REFRESH_SECRET` | At least 32 random characters |
| `ENCRYPTION_KEY` | 64 hex characters (32 bytes) — generate with `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe dashboard webhook settings |
| `STRIPE_SETUP_PRICE_ID` | One-time $49 Price ID |
| `STRIPE_MONTHLY_PRICE_ID` | Recurring $29/month Price ID |
| `META_APP_SECRET` | WhatsApp App Secret from Meta Business Manager |
| `META_VERIFY_TOKEN` | Webhook verify token (any string you choose) |

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

- Backend: http://localhost:5000
- Frontend: http://localhost:3000

### 3. Run migrations

After the backend is up, run:

```bash
docker-compose exec backend npm run db:migrate
```

### Manual Setup (without Docker)

```bash
# Backend
cd backend
npm install
npm run db:migrate
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Database Migrations

```bash
# Generate a new migration after schema changes
cd backend && npm run db:generate

# Apply migrations
npm run db:migrate

# Open Drizzle Studio
npm run db:studio
```

## Deployment

### Backend → Render.com

1. Create a new Web Service pointing to the `backend/` directory
2. Set Docker as the build method (uses `backend/Dockerfile`)
3. Add all environment variables in the Render dashboard
4. Set health check path to `/api/health`

### Frontend → Vercel

1. Create a new Vercel project pointing to the `frontend/` directory
2. Set `VITE_API_URL` to your Render backend URL (e.g., `https://wacrm.onrender.com/api`)
3. Vercel auto-detects Vite — no custom build config needed

### Meta Webhook Configuration

After deploying the backend, configure the webhook in Meta Business Manager:

- **URL**: `https://your-backend.onrender.com/api/webhooks/whatsapp`
- **Verify Token**: Value of `META_VERIFY_TOKEN` from your `.env`
- **Subscriptions**: `messages`, `message_status_update`

## Architecture Notes

### Number Rotation Algorithm

Each campaign calculates proportional allocation:

```
weight(n) = dailyLimit(n) × healthWeight(n)
allocation(n) = floor(totalMessages × weight(n) / totalWeight)
```

Health weights: 100% health → 1.0×, 80% → 0.8×, etc. Remainder messages are distributed to highest-weight numbers.

### Queue Architecture

- Each WhatsApp number gets its own `BullMQ Queue + Worker`
- Worker rate limiter: **1 message/second** (Meta hard limit)
- On worker failure: exponential backoff (3s base, up to 5 retries)
- Permanent failures (e.g., blocked number) → persisted to `failed_messages` table
- On failover trigger: job re-enqueued on best available number's queue

### Security

- All API routes require JWT Bearer token authentication
- WhatsApp access tokens encrypted at rest with AES-256-GCM
- Webhook signature verified via `X-Hub-Signature-256` (HMAC-SHA256)
- Stripe webhook signature verified via Stripe SDK
- Passwords hashed with bcrypt (cost factor 12)

## License

MIT
