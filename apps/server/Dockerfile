FROM node:20-slim AS base
RUN npm install -g pnpm

WORKDIR /app

FROM base AS builder
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

WORKDIR /app/apps/server
RUN pnpm db:generate
RUN pnpm build

FROM node:20-slim AS runner
RUN npm install -g pnpm

WORKDIR /app

COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/node_modules ./node_modules
COPY --from=builder /app/apps/server/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

CMD ["node", "dist/index.js"]
