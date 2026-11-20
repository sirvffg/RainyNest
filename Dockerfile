# RainyNest 生产镜像（Node 20 + Next.js 15 + SQLite）
# 构建：docker build -t rainynest .
# 运行：docker run -d -p 3000:3000 -v rainynest-db:/app/db -v rainynest-uploads:/app/public/uploads rainynest

FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# 依赖层
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 构建层（需要 devDependencies）
FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 构建期仅需占位数据库；运行时挂载真实 db/blog.db
ENV DATABASE_URL="file:../db/blog.db"
RUN mkdir -p db && npx prisma generate \
  && npx prisma generate --schema=prisma-analytics/analytics.prisma \
  && npm run build

# 运行层
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma-analytics ./prisma-analytics
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
RUN mkdir -p db/uploads public/uploads db/plugins-json db/backups
EXPOSE 3000
# 启动前执行迁移，再启动 Next
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node node_modules/next/dist/bin/next start -p ${PORT}"]
