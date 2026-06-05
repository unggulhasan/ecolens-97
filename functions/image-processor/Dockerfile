# ─────────────────────────────────────────────────────────────
# image-processor — ONNX inference worker (Cloud Run + Eventarc)
#
# Pub/Sub triggered: receives {file_id, presigned_url, file_type,
# job_type}, downloads the image, runs MegaDetector + species
# classifier (ONNX Runtime, CPU), logs the structured result.
#
# Built locally with:
#   docker buildx build --platform linux/amd64 --provenance=false \
#     --push -t <repo>/image-processor:latest .
# ─────────────────────────────────────────────────────────────

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps for Pillow + ONNX Runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install -r requirements.txt

COPY . .

# functions-framework dispatches CloudEvents to the @cloud_event handler.
# Pub/Sub trigger via Eventarc delivers a CloudEvent envelope to PORT/.
CMD ["functions-framework", "--target=process_image", "--signature-type=cloudevent", "--host=0.0.0.0", "--port=8080"]
