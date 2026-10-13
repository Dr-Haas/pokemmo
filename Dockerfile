# One container: builds the game, then the Node server runs the multiplayer
# room AND serves the game files. Works on Render, Fly.io, Railway, a VPS...

# ---- 1. Build the game (client) ----
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ---- 2. Server ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist
# The server reads the maps to keep NPCs off walls (services/mapSpawnValidator.js).
COPY client/src/assets/tilemaps /app/client/src/assets/tilemaps

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
