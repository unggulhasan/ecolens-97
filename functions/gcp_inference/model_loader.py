from google.cloud import storage
import os

# directqory to download the model files from GCS to the local file system of the Cloud Run container.
MODEL_DIR = "/tmp/models"

# being read from env variables, with a default values.
MODEL_BUCKET_NAME = os.getenv("MODEL_BUCKET_NAME", "aussie-ecolens-gcp-models")
MEGADETECTOR_MODEL_FILE = os.getenv("MEGADETECTOR_MODEL_FILE", "mdv5a.pt")
SPECIES_MODEL_FILE = os.getenv("SPECIES_MODEL_FILE", "model.pt")
LABELS_FILE = os.getenv("LABELS_FILE", "labels.txt")


def download_blob_if_missing(bucket, file_name: str) -> str:
    """
    Downloads a single file from GCS into /tmp/models if it does not already exist.
    Returns the local file path.
    """

    destination = os.path.join(MODEL_DIR, file_name)

    # If the file already exists in the Cloud Run container,
    # avoid downloading it again.
    if os.path.exists(destination):
        print(f"{file_name} already exists. Skipping download.")
        return destination

    # a blob is the GCS object representing the file in the bucket.
    blob = bucket.blob(file_name)

    # blob.download_to_filename(destination) is how its being downloaded.
    print(f"Downloading {file_name} from bucket {MODEL_BUCKET_NAME}...")
    blob.download_to_filename(destination)
    print(f"Downloaded {file_name} to {destination}")

    return destination


# downloads the model files from GCP models bucket to the local file system of the Cloud Run container.
def download_models() -> dict[str, str]:
    """
    Downloads the model files from GCP models bucket to the local file system of the Cloud Run container.
    Returns:
    A dictionary containing the local file paths of the downloaded model files.
    """
    os.makedirs(MODEL_DIR, exist_ok=True)

    # creates the client that can access GCS. 
    # In Cloud Run, the client will automatically use the service account's credentials.
    client = storage.Client()
    bucket = client.bucket(MODEL_BUCKET_NAME)

    megadetector_path = download_blob_if_missing(bucket, MEGADETECTOR_MODEL_FILE)
    species_model_path = download_blob_if_missing(bucket, SPECIES_MODEL_FILE)
    labels_path = download_blob_if_missing(bucket, LABELS_FILE)

    return {
        "megadetector_model": megadetector_path,
        "species_model": species_model_path,
        "labels": labels_path
    }