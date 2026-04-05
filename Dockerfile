FROM --platform=${BUILDPLATFORM} golang:1 AS gobuild
ARG TARGETOS
ARG TARGETARCH
WORKDIR /go
COPY backend/ .
RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} CGO_ENABLED=0 go build -o /go/app

FROM node:24-alpine AS nodebuild
WORKDIR /app
COPY frontend/package*.json .
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM scratch
ARG TARGETOS
ARG TARGETARCH
COPY --from=gobuild /go/app /brave-bpc/brave-bpc.${TARGETARCH}
COPY --from=nodebuild /app/dist /brave-bpc/dist

