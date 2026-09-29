FROM golang:1.27
WORKDIR /go
COPY . .
RUN go build -o app
EXPOSE 2727
CMD ["./app"]

