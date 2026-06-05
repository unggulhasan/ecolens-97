import os
import shutil

import cv2

from inference_service import perform_inference
from video_download_service import download_presigned_url_video, cleanup_file


FRAME_DIR = "/tmp/video-frames"


def extract_one_frame_per_second(video_path: str, request_uuid: str) -> list[str]:
    """
    extracts 1 image frame per second from the video.
    and returns a list of local frame img paths.
    """

    frame_output_dir = os.path.join(FRAME_DIR, request_uuid)
    os.makedirs(frame_output_dir, exist_ok=True)

    # open the video using OpenCV
    video_capture = cv2.VideoCapture(video_path)

    if not video_capture.isOpened():
        raise ValueError("Could not open downloaded video file.")

    # read the frames per second value from the video 
    fps = video_capture.get(cv2.CAP_PROP_FPS)

    if fps <= 0:
        raise ValueError("Could not read FPS from video.")

    total_frames = int(video_capture.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_seconds = int(total_frames / fps)

    print("Video FPS:", fps)
    print("Total frames:", total_frames)
    print("Duration seconds:", duration_seconds)

    frame_paths = []

    # looping through each second of the video 
    for second in range(duration_seconds + 1):
        frame_number = int(second * fps)

        if frame_number >= total_frames:
            break

        # move the video reader to the required frame
        video_capture.set(cv2.CAP_PROP_POS_FRAMES, frame_number)

        # read the selected frame.
        success, frame = video_capture.read()

        if not success:
            print("Could not read frame at second:", second)
            continue

        # save the extracted frame as a JPEG image in the output directory
        frame_path = os.path.join(
            frame_output_dir,
            f"{request_uuid}-second-{second}.jpg"
        )

        # save the extracted as a JPEG
        cv2.imwrite(frame_path, frame)
        frame_paths.append(frame_path)

        print("Saved frame:", frame_path)

    video_capture.release()

    return frame_paths


def run_video_job():

    # receives the presigned URL and request UUID as environment variables during job execution
    request_uuid = os.getenv("JOB_UUID")
    presigned_url = os.getenv("PRESIGNED_URL")

    if not request_uuid:
        raise ValueError("Missing JOB_UUID environment variable.")

    if not presigned_url:
        raise ValueError("Missing PRESIGNED_URL environment variable.")

    local_video_path = None
    frame_dir_for_job = os.path.join(FRAME_DIR, request_uuid)

    try:
        print("Starting video inference job for uuid:", request_uuid)

        local_video_path = download_presigned_url_video(
            presigned_url=presigned_url,
            request_uuid=request_uuid
        )

        frame_paths = extract_one_frame_per_second(
            video_path=local_video_path,
            request_uuid=request_uuid
        )

        unique_count_estimate = {}

        # run image inference on each extracted frame.
        for frame_path in frame_paths:
            frame_tags = perform_inference(frame_path)
            # Update the unique estimate using max count per animal across frames.
            for animal_name, count in frame_tags.items():
                current_max = unique_count_estimate.get(animal_name, 0)
                unique_count_estimate[animal_name] = max(current_max, count)

        final_tags = unique_count_estimate

        final_result = {
            "status": "completed",
            "uuid": request_uuid,
            "frame_count": len(frame_paths),
            "tags": final_tags
        }

        print("Final video inference result:", final_result)

    finally:
        if local_video_path:
            cleanup_file(local_video_path)

        if os.path.exists(frame_dir_for_job):
            shutil.rmtree(frame_dir_for_job)
            print("Deleted frame directory:", frame_dir_for_job)


if __name__ == "__main__":
    run_video_job()