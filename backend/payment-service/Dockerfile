FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY shared /app/shared
COPY payment-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY payment-service/ .

ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings

EXPOSE 8005

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8005", "--workers", "4", "--timeout", "120"]
