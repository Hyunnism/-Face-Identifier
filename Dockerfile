FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TF_CPP_MIN_LOG_LEVEL=3 \
    GLOG_minloglevel=3 \
    HOST=0.0.0.0 \
    PORT=8000

WORKDIR /app

# Install system dependencies for OpenCV, MediaPipe & ONNX Runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-cache InsightFace buffalo_l models during build time
# Prevents ~300MB download on every container startup
RUN python -c "import insightface; app = insightface.app.FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'], allowed_modules=['detection', 'recognition']); app.prepare(ctx_id=-1, det_size=(320, 320))"

# Copy application source code and assets
COPY src/ /app/src/
COPY static/ /app/static/
COPY run.py /app/run.py

# Create persistent storage folder for SQLite database
RUN mkdir -p /app/data

EXPOSE 8000

# Start server binding to 0.0.0.0:8000 for Docker/Coolify reverse proxy
CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]
