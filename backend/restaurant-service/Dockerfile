FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY shared /app/shared
COPY restaurant-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY restaurant-service/ .

ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings

EXPOSE 8002

# Use daphne for WebSocket support (restaurant dashboard)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8002", "config.asgi:application"]
