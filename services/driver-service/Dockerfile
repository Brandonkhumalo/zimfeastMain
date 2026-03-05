FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY services/shared /app/shared
COPY services/driver-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/driver-service/ .

ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings

EXPOSE 8004

# Use daphne for WebSocket support (driver location tracking)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8004", "config.asgi:application"]
