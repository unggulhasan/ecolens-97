import os
from urllib.parse import urlparse

import requests


DOWNLOAD_DIR = "/tmp/inference-inputs"

ALLOWED_FILE_TYPES = {
    "image": ".jpg",
    "frame": ".jpg",
}


def get_extension_from_url_or_file_type(presigned_url: str, file_type: str) -> str:
    """
    Gets the file extension from the URL path.
    If the URL does not contain a usable extension, fallback to file_type.
    """

    parsed_url = urlparse(presigned_url)
    path = parsed_url.path

    extension = os.path.splitext(path)[1].lower()

    if extension in [".jpg", ".jpeg", ".png", ".webp"]:
        return extension

    if file_type in ALLOWED_FILE_TYPES:
        return ALLOWED_FILE_TYPES[file_type]

    return ".jpg"


def download_presigned_url_file(presigned_url: str, request_uuid: str, file_type: str) -> str:
    """
    Downloads an image/frame from an AWS S3 presigned URL
    into the local temporary file system of the Cloud Run container.
    """

    if not presigned_url:
        raise ValueError("Missing 'presigned_url' in request body.")

    if not file_type:
        raise ValueError("Missing 'file_type' in request body.")

    if file_type not in ALLOWED_FILE_TYPES:
        raise ValueError("This inference service only accepts image/frame file types.")


    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

    extension = get_extension_from_url_or_file_type(presigned_url, file_type)
    local_file_path = os.path.join(DOWNLOAD_DIR, f"{request_uuid}{extension}")


    response = requests.get(
        presigned_url,
        stream=True,
        timeout=60
    )

    response.raise_for_status()

    with open(local_file_path, "wb") as file:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                file.write(chunk)

    return local_file_path


def cleanup_file(file_path: str):
    """
    Deletes the local downloaded file after inference.
    """

    if file_path and os.path.exists(file_path):
        os.remove(file_path)
        print("Deleted input file:", file_path)