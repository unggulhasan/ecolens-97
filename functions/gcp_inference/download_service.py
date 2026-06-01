import os
import uuid
import requests
from urllib.parse import urlparse

# extract file extension from the URL, default to .bin if not found
def get_file_extension(url: str) -> str:
    path = urlparse(url).path
    _, extension = os.path.splitext(path)

    if extension:
        return extension
    return ".bin"

# Download the file from the presigned S3 URL and save it to a temporary location.
def download_file_from_url(presigned_url) -> str:
    # convert pydantic HttpUrl to string.
    presigned_url = str(presigned_url)

    # generate a unique filename with the same extension as the original file
    extension = get_file_extension(presigned_url)
    local_file_path = f"/tmp/{uuid.uuid4()}{extension}"

    # download the file with a timeout and stream it to avoid memory issues
    response = requests.get(presigned_url, stream=True, timeout=60)
    response.raise_for_status()

    with open(local_file_path, 'wb') as file:
        # write the file in chunks to handle large files without consuming too much memory
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                file.write(chunk)
    return local_file_path


# Remove the temporary file after processing to free up space.
def cleanup_file(file_path: str):
    if os.path.exists(file_path):
        os.remove(file_path)