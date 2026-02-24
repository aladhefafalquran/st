FROM node:20-slim AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/

# Generate Prisma client
RUN pnpm --filter @streamtime/server db:generate

# Build
RUN pnpm --filter @streamtime/server build

# Production image
FROM node:20-slim AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=base /app/apps/server/dist ./apps/server/dist
COPY --from=base /app/apps/server/prisma ./apps/server/prisma
COPY --from=base /app/packages/shared ./packages/shared

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
