# StreamTime

A Stremio/Netflix-like streaming platform built with React + Express + WebTorrent.

## Stack

- **Frontend:** React 18 · Vite · Tailwind v4 · Zustand · React Router
- **Backend:** Express · TypeScript · WebTorrent · Prisma
- **Database:** PostgreSQL (Neon)
- **Deployment:** Cloudflare Pages (client) · Railway (server)

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

**Server** (`apps/server/.env`):
```env
DATABASE_URL="postgresql://..."
JWT_SECRET="min-32-char-secret"
TMDB_API_KEY="your-tmdb-key"
OPENSUBTITLES_API_KEY="your-os-key"
CLIENT_URL="http://localhost:5173"
NODE_ENV="development"
PORT=3001
```

**Client** (`apps/client/.env`):
```env
VITE_API_URL=http://localhost:3001
VITE_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p
```

### 3. Set up database

```bash
cd apps/server
pnpm db:generate   # generate Prisma client
pnpm db:migrate    # run migrations against Neon
```

### 4. Run in development

```bash
# From root — runs both client and server
pnpm dev
```

Or run individually:
```bash
pnpm --filter @streamtime/server dev   # Express on :3001
pnpm --filter @streamtime/client dev   # Vite on :5173
```

## Deployment

### Railway (Backend)
- Set all server env vars in Railway dashboard
- Deploy using the `apps/server/Dockerfile`

### Cloudflare Pages (Frontend)
- Build command: `pnpm --filter @streamtime/client build`
- Output directory: `apps/client/dist`
- Set `VITE_API_URL` to your Railway URL

## API Keys

| Service | Where to get |
|---|---|
| TMDB | https://www.themoviedb.org/settings/api |
| OpenSubtitles | https://www.opensubtitles.com/en/consumers |
| Neon PostgreSQL | https://neon.tech |

## Architecture

```
Browser → Cloudflare Pages (React)
              ↕ /api/*
          Railway (Express + WebTorrent)
              ↕ Prisma
          Neon PostgreSQL
              ↕ HTTP
          TMDB / YTS / EZTV / OpenSubtitles
```
