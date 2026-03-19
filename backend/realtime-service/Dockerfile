FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go-shared /app/go-shared
COPY realtime-service /app/service
WORKDIR /app/service
RUN go mod download && CGO_ENABLED=0 go build -o /realtime-server .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /realtime-server /realtime-server
EXPOSE 3001
CMD ["/realtime-server"]
