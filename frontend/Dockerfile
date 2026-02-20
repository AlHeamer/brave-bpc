#Build stage
FROM --platform=$TARGETPLATFORM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./
# ESLint v10 is intentionally used even though some plugins may declare narrower peer ranges.
# Use legacy peer dependency resolution so Docker builds don't fail on ERESOLVE.
RUN npm ci --legacy-peer-deps
COPY . .

#Dev stage for running VITE in test mode
FROM base AS dev
EXPOSE 3000
CMD ["npm", "run", "dev"]

