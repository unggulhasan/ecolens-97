from google.cloud import storage
import os

MODEL_DIR = "tmp/models"

def download_models():
    os.makedirs(MODEL_DIR, exist_ok=True)
    client = storage.Client()
    bucket = client.bucket("aussie-ecolens-gcp-models")

    files = [
        "mdv5a.pt",
        "model.pt",
        "labels.txt"
    ]

    for file_name in files:
        destination = os.path.join(MODEL_DIR, file_name)

        if os.path.exists(destination):
            continue

        blob = bucket.blob(file_name)
        print(f"Downloading {file_name}...")
        blob.download_to_filename(destination)
        print(f"Downloaded {file_name}")