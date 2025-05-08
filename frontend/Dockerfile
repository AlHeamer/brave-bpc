#Build stage
FROM node:23-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

#Dev stage for running VITE in test mode
FROM base AS dev
EXPOSE 3000
CMD ["npm","run","dev"]

#Runs Vite build for deployment
FROM base AS build
RUN npm run build

#Production via NGINX
FROM nginx:1.25.4-alpine-slim AS prod
COPY --from=build /app/dist /usr/share/nginx/html
#COPY nginx.conf /etc/nginx/conf.d
EXPOSE 80
CMD ["nginx","-g","daemon off;"]