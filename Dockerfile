FROM node:22-bookworm-slim

WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile --prod=false && pnpm typecheck

ENV NODE_ENV=production
EXPOSE 4310
CMD ["pnpm", "start"]
