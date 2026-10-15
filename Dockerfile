# The app as a Node server (`next start`), for running it with a database through docker-compose.yml.
# The public demo runs on Cloudflare Workers instead (docs/cloudflare-deployment.md).
# Not run yet: using Docker on this machine waits for the user's approval.

FROM node:24.19.0-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24.19.0-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
# Kept whole (not a standalone bundle) so the database scripts in package.json can run in this image too.
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
