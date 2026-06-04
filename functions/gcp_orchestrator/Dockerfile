FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

RUN python -m pip install --upgrade pip
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["functions-framework", "--target=orchestrate", "--host=0.0.0.0", "--port=8080"]