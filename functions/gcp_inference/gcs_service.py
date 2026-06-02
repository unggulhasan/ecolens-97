import os
import uuid
from google.cloud import storage


def parse_gcs_uri(gcs_uri: str) -> tuple[str, str]:
    """
    Parses a GCS URI into its bucket name and blob name components.
    Example GCS URI: gs://aussie-ecolens-gcp-processing/jobs/job-123/frames/frame-0001.jpg
        to:
        bucket_name = "aussie-ecolens-gcp-processing"
        blob_name = "jobs/job-123/frames/frame-0001.jpg"
    """
    # making sure the URI is actually a GCS URI
    if not gcs_uri.startswith("gs://"):
        raise ValueError("image_uri must start with gs://")

    # remove the gs:// prefix 
    path = gcs_uri.replace("gs://", "", 1)

    # a valid GCS URI should have at least one "/" separating bucket and file path
    if "/" not in path:
        raise ValueError("Invalid GCS URI. Expected format: gs://bucket-name/path/to/file")

    # split the path into bucket name and blob name
    bucket_name, blob_name = path.split("/", 1)

    return bucket_name, blob_name



def download_gcs_file(gcs_uri: str) -> str:
    """
    Downloads an image/frame from GCS to a local temporary file system of this cloud run container.
    Returns:
        local_file_path, for example:
            /tmp/550e8400-e29b-41d4-a716-446655440000.jpg
    """

    bucket_name, blob_name = parse_gcs_uri(gcs_uri)

    extension = os.path.splitext(blob_name)[1] or ".bin"
    # creating a unique file name in the /tmp directory to avoid conflicts
    local_file_path = f"/tmp/{uuid.uuid4()}{extension}"

    # initialize GCS client
    # in Cloud Run, the client will automatically use the service account's credentials
    client = storage.Client()

    # get reference to the bucket and blob, then download the file to the local path
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    blob.download_to_filename(local_file_path)

    return local_file_path

# to delete the local file after inference is done to free up space in the container's temporary storage
def cleanup_file(file_path: str):
    if os.path.exists(file_path):
        os.remove(file_path)