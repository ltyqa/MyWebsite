FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/data/models
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
RUN useradd --system --uid 10001 knowledge && mkdir -p /data && chown -R knowledge:knowledge /data
USER knowledge
EXPOSE 8088
CMD ["uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8088", "--workers", "1"]
