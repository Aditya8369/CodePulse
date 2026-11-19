# Development image for the NestJS API. Source is bind-mounted by
# docker-compose.dev.yml, so only dependencies are baked in here.
FROM node:20-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci || npm install
COPY . .
RUN npx prisma generate \
    && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["sh", "scripts/docker-dev-entrypoint.sh"]
