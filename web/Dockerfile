# Front AI Value (Next 16).
# ⚠️ API_INTERNAL_URL est figée AU BUILD (rewrites Next) : c'est un build-arg.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

ARG API_INTERNAL_URL=http://api:8820
ENV API_INTERNAL_URL=${API_INTERNAL_URL} \
    NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN npm run build


FROM node:22-bookworm-slim
WORKDIR /app
ARG API_INTERNAL_URL=http://api:8820
ENV NODE_ENV=production \
    PORT=3000 \
    API_INTERNAL_URL=${API_INTERNAL_URL} \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --chown=node:node package.json next.config.ts tsconfig.json proxy.ts ./

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
