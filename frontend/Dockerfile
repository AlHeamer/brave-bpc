#Build stage
FROM --platform=$TARGETPLATFORM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

#Dev stage for running VITE in test mode
FROM base AS dev
EXPOSE 3000
CMD ["npm", "run", "dev"]

