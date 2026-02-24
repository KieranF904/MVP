# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.13.0
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN npm run build

FROM base AS runner
COPY --from=build /app .
EXPOSE 3000
CMD ["npm", "run", "start"]
