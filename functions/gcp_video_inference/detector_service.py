import os
import uuid 
from pathlib import Path
from PIL import Image

from model_loader import get_megadetector_model
from megadetector.visualization import visualization_utils as vis_utils

# used to store cropped animal images temporarily.
CROP_DIR = "/tmp/crops"

# got these from the sample config.
CONFIDENCE_THRESHOLD = 0.4
SNIP_SIZE = 600

def run_megadetector(local_image_path: str) -> list[dict]:
    """
    MegaDetector detects animal bounding boxes.
    """

    detector = get_megadetector_model()

    # since the megadetector library's generate_detections_one_image function expects a numpy array image,
    # load the image with vis_utils.load_image() instead of PIL.Image.open() here.
    image = vis_utils.load_image(local_image_path)

    results = detector.generate_detections_one_image(image, local_image_path)
    return [results]


def crop_detected_animals(local_image_path: str, detections: list[dict]) -> list[str]:
    """
    Crops detected animals from the original image.

    Returns:
    A list of local crop file paths.
    """

    os.makedirs(CROP_DIR, exist_ok=True)

    image = Image.open(local_image_path).convert("RGB")
    width, height = image.size

    print("Original image size:", width, height)

    crop_paths = []

    for index, detection in enumerate(detections):
        category = detection.get("category")
        confidence = float(detection.get("conf", 0))
        bbox = detection.get("bbox")

        print("Detection index:", index)
        print("Detection category:", category)
        print("Detection confidence:", confidence)
        print("Detection bbox:", bbox)

        # In the lecturer sample, category "1" is treated as animal.
        if category != "1":
            print("Skipping detection because category is not animal.")
            continue

        if confidence < CONFIDENCE_THRESHOLD:
            print("Skipping detection because confidence is below threshold.")
            continue

        if not bbox or len(bbox) != 4:
            print("Skipping detection because bbox is invalid.")
            continue

        x, y, w, h = bbox

        # MegaDetector bbox values are normalised.
        # Convert them into pixel coordinates.
        left = int(x * width)
        top = int(y * height)
        right = int((x + w) * width)
        bottom = int((y + h) * height)

        print("Crop pixel coordinates:", left, top, right, bottom)

        crop = image.crop((left, top, right, bottom))

        resized_crop = crop.resize(
        (SNIP_SIZE, SNIP_SIZE),
        Image.BILINEAR
        )

        crop_file_name = f"{Path(local_image_path).stem}-{index}-{uuid.uuid4()}.jpg"
        crop_path = os.path.join(CROP_DIR, crop_file_name)

        resized_crop.save(crop_path)
        crop_paths.append(crop_path)

        print("Saved crop:", crop_path)

    print("Total crops created:", len(crop_paths))

    return crop_paths


def detect_and_crop_animals(local_image_path: str) -> list[str]:
    """
    Runs MegaDetector and returns the paths to cropped animal image.
    """

    detection_results = run_megadetector(local_image_path)
    if not detection_results:
        print("MegaDetector returned no results.")
        return []
    first_result = detection_results[0]
    print("First MegaDetector result type:", type(first_result))
    if isinstance(first_result, dict):
        print("First MegaDetector result keys:", list(first_result.keys()))
    detections = first_result.get("detections", [])
    print("Number of detections:", len(detections))
    return crop_detected_animals(local_image_path, detections)