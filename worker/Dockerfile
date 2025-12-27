FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy common package (needed for settings and database)
COPY common /app/common

# Copy worker package
COPY worker /app/worker

# Set Python path to include current directory
ENV PYTHONPATH=/app

# Run the worker
CMD ["python", "worker/main.py"]
