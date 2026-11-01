# Pericope web app: production image (Next.js standalone output).
#   docker build -t pericope-web .
#   docker run -p 3000:3000 -e API_URL=https://api.example.com pericope-web
# API_URL is read when the container starts, so the same image works in every environment.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Run with an init process (compose `init: true`, or `docker run --init`) so signals reach Node.
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --chmod=755 docker/web-entrypoint.sh /usr/local/bin/web-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/runtime-config.js').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/web-entrypoint.sh"]
CMD ["node", "server.js"]
