from google.cloud import storage
import os
import uuid

# Directory to download the model files from GCS to the local file system of the Cloud Run container.
MODEL_DIR = "/tmp/models"

# Unique ID created when this Cloud Run container instance starts.
# If this value changes between requests, then your requests are hitting different container instances.
INSTANCE_ID = str(uuid.uuid4())

# Being read from environment variables, with default values.
MODEL_BUCKET_NAME = os.getenv("MODEL_BUCKET_NAME", "aussie-ecolens-gcp-models")
MEGADETECTOR_MODEL_FILE = os.getenv("MEGADETECTOR_MODEL_FILE", "mdv5a.pt")
SPECIES_MODEL_FILE = os.getenv("SPECIES_MODEL_FILE", "model.pt")
LABELS_FILE = os.getenv("LABELS_FILE", "labels.txt")


def download_blob_if_missing(bucket, file_name: str) -> dict:
    """
    Downloads a single file from GCS into /tmp/models if it does not already exist.
    Returns details showing whether the file was downloaded or skipped.
    """

    destination = os.path.join(MODEL_DIR, file_name)

    # If the file already exists in this Cloud Run container,
    # avoid downloading it again.
    if os.path.exists(destination):
        print(f"{file_name} already exists. Skipping download.")

        return {
            "file": file_name,
            "status": "skipped",
            "reason": "already_exists",
            "local_path": destination,
            "size_bytes": os.path.getsize(destination)
        }

    # A blob is the GCS object representing the file in the bucket.
    blob = bucket.blob(file_name)

    # blob.download_to_filename(destination) downloads the object from GCS.
    print(f"Downloading {file_name} from bucket {MODEL_BUCKET_NAME}...")
    blob.download_to_filename(destination)
    print(f"Downloaded {file_name} to {destination}")

    return {
        "file": file_name,
        "status": "downloaded",
        "local_path": destination,
        "size_bytes": os.path.getsize(destination)
    }


def download_models() -> dict:
    """
    Downloads the model files from GCP models bucket to the local file system
    of the Cloud Run container.

    Returns:
    A dictionary showing the Cloud Run instance ID and whether each model file
    was downloaded or skipped.
    """

    os.makedirs(MODEL_DIR, exist_ok=True)

    # Creates the client that can access GCS.
    # In Cloud Run, the client will automatically use the service account's credentials.
    client = storage.Client()
    bucket = client.bucket(MODEL_BUCKET_NAME)

    files = [
        MEGADETECTOR_MODEL_FILE,
        SPECIES_MODEL_FILE,
        LABELS_FILE
    ]

    results = []

    for file_name in files:
        result = download_blob_if_missing(bucket, file_name)
        results.append(result)

    return {
        "instance_id": INSTANCE_ID,
        "model_dir": MODEL_DIR,
        "bucket": MODEL_BUCKET_NAME,
        "files": results
    }