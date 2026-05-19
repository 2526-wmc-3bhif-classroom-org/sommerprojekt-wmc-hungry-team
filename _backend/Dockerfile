FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npx", "tsx", "watch", "src/app.ts"]

FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npx", "tsx", "src/app.ts"]
