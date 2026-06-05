FROM python:3.12

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
    
COPY requirements.txt .

RUN python -m pip install --upgrade pip setuptools wheel

RUN python -m pip install --no-cache-dir -r requirements.txt

RUN python -m pip install --no-cache-dir --only-binary=:all: --no-deps "onnx==1.16.2"

RUN python -m pip install --no-cache-dir onnx2torch --no-deps

COPY . .

CMD ["python", "video_job.py"]