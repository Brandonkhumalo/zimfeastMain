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

# Gunicorn + Uvicorn workers handle both HTTP and WebSocket via ASGI
CMD ["gunicorn", "config.asgi:application", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8002", "--workers", "4"]
