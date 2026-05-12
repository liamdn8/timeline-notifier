FROM node:24-alpine AS frontend-build

WORKDIR /app

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
RUN npm ci

COPY index.html ./index.html
COPY tsconfig.json ./tsconfig.json
COPY tsconfig.app.json ./tsconfig.app.json
COPY tsconfig.node.json ./tsconfig.node.json
COPY vite.config.ts ./vite.config.ts
COPY src ./src

RUN npm run build

FROM node:24-alpine

WORKDIR /app

COPY server/package.json ./package.json
COPY server/package-lock.json ./package-lock.json
RUN npm ci --omit=dev

COPY server/src ./src
COPY --from=frontend-build /app/dist ./public

ENV PORT=3001
ENV STATIC_DIR=/app/public
EXPOSE 3001

CMD ["npm", "start"]