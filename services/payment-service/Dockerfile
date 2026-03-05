FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY services/shared /app/shared
COPY services/payment-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/payment-service/ .

ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings

EXPOSE 8005

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8005", "--workers", "4", "--timeout", "120"]
