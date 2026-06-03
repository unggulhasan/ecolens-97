# This file contains the logic for performing inference on the downloaded image.
import os
from collections import Counter
from detector_service import detect_and_crop_animals
from classifier_service import classify_crops


def cleanup_crops(crop_paths: list[str]):
    """
    Deletes the cropped animal images from local temp storage after classification.
    """

    for crop_path in crop_paths:
        if os.path.exists(crop_path):
            os.remove(crop_path)
            print("Deleted crop image:", crop_path)


def perform_inference(local_image_path: str) -> dict[str, int]:
    """
    Performs inference on the downloaded image.
    Steps:
    1. Run MegaDetector to detect animals and get their bounding boxes.
    2. Crop the detected animals from the original image.
    3. Classify the cropped animal images to get common names.
    4. Count the occurrences of each common name and return the counts.
    Returns:
    A dictionary mapping common animal names to their counts in the image.
    """
    
    crop_paths = []
    try:
        crop_paths = detect_and_crop_animals(local_image_path)
        if not crop_paths:
            print("No animals detected in the image.")
            return {}
        predicted_common_names = classify_crops(crop_paths)
        counts = Counter(predicted_common_names)
        final_counts = dict(counts)
        print("Final inference result:", final_counts)

        return final_counts
    finally:
        cleanup_crops(crop_paths)