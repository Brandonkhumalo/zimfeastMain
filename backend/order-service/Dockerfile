FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go-shared /app/go-shared
COPY order-service /app/service
WORKDIR /app/service
RUN go mod download && CGO_ENABLED=0 go build -o /order-server .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /order-server /order-server
EXPOSE 8003
CMD ["/order-server"]
