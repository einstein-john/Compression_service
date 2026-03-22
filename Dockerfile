# API: Node + ffmpeg, Ghostscript, zip/unzip (document strategy)
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    ghostscript \
    zip \
    unzip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

ENV OUTPUT_TEMP_DIR=/data/compressed-output
ENV PORT=3001
RUN mkdir -p /data/compressed-output

EXPOSE 3001
CMD ["node", "dist/server.js"]
