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

RUN python -m pip install --no-cache-dir onnx2torch --no-deps

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]