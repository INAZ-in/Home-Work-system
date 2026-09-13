# syntax=docker/dockerfile:1
# Small project — we run TypeScript directly via tsx (no separate build/dist
# step) both in dev and in prod, so a single dependency layer covers both.
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 4000

FROM base AS dev
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

FROM base AS runtime
ENV NODE_ENV=production
CMD ["sh", "-c", "npm run migrate && npm run start"]
