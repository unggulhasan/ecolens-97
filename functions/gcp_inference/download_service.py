import os
import uuid
import requests
from urllib.parse import urlparse

def get_file_extension(url: str) -> str:
    path = urlparse(url).path
    _, extension = os.path.splitext(path)

    if extension:
        return extension
    return ".bin"

def download_file_from_url(presigned_url: str) -> str:
    extension = get_file_extension(presigned_url)
    local_file_path = f"/tmp/{uuid.uuid4()}{extension}"

    response = requests.get(presigned_url, stream=True, timeout=60)
    response.raise_for_status()

    with open(local_file_path, 'wb') as file:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                file.write(chunk)
    return local_file_path


def cleanup_file(file_path: str):
    if os.path.exists(file_path):
        os.remove(file_path)