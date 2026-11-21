# Stage 1: Build do Frontend (React + Vite + Tailwind)
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build do Backend (NestJS)
FROM node:22-bookworm-slim AS backend-build
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# Stage 3: Imagem final de producao (Backend serve API + Frontend SPA + /uploads)
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=backend-build /build/backend/dist ./dist
COPY --from=frontend-build /build/frontend/dist ./public

RUN mkdir -p /app/uploads/capsulas

EXPOSE 3000
CMD ["node", "dist/main"]
