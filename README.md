# WhatsApp Bulk Messaging CRM

Production-ready full-stack WhatsApp Bulk Messaging CRM with smart number rotation, queue-driven delivery, two-way conversations, and real-time monitoring.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, TypeScript, Express, Drizzle ORM |
| Database | PostgreSQL |
| Queue | BullMQ + Redis |
| Realtime | Socket.IO |
| Frontend | React, Vite, TailwindCSS |

## Project Structure

```
backend/
frontend/
render.yaml
```

## Quick Start (Local Runtime)

### 1. Install dependencies

From project root:

```bash
npm run setup
```

Or manually:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

Copy and configure environment files:

```bash
cp .env.example .env
```

Required values:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `ENCRYPTION_KEY`
- `OWNER_EMAIL`
- `OWNER_PASSWORD`

### 3. Run database migration

```bash
cd backend
npm run db:migrate
```

### 4. Start development servers

From root:

```bash
npm run dev
```

This starts:

- Backend on `http://localhost:8080`
- Frontend on `http://localhost:8000`

## Production Deployment

### Backend (Render Node runtime)

Use [render.yaml](render.yaml). It deploys backend as a Node service.

### Frontend

Deploy `frontend/` to your preferred static host (Vercel/Netlify/etc.) and set:

- `VITE_API_URL`
- `VITE_SOCKET_URL`

## Common Commands

### Backend

```bash
cd backend
npm run dev
npm run build
npm run db:migrate
npm run db:generate
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
```

## License

MIT
