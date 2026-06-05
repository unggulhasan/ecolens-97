import os
from urllib.parse import urlparse

import requests


DOWNLOAD_DIR = "/tmp/video-inputs"


def get_video_extension_from_url(presigned_url: str) -> str:
    parsed_url = urlparse(presigned_url)
    path = parsed_url.path

    extension = os.path.splitext(path)[1].lower()

    if extension in [".mp4", ".mov", ".avi", ".mkv"]:
        return extension

    return ".mp4"


def download_presigned_url_video(presigned_url: str, request_uuid: str) -> str:
    """
    Downloads a video from an AWS S3 presigned URL into the Cloud Run Job's /tmp storage.
    """

    if not presigned_url:
        raise ValueError("Missing PRESIGNED_URL.")

    if not request_uuid:
        raise ValueError("Missing JOB_UUID.")

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

    extension = get_video_extension_from_url(presigned_url)
    local_file_path = os.path.join(DOWNLOAD_DIR, f"{request_uuid}{extension}")

    print("Downloading video for uuid:", request_uuid)

    response = requests.get(
        presigned_url,
        stream=True,
        timeout=300
    )

    response.raise_for_status()

    with open(local_file_path, "wb") as file:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                file.write(chunk)

    print("Downloaded video to:", local_file_path)

    return local_file_path


def cleanup_file(file_path: str):
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
        print("Deleted video file:", file_path)