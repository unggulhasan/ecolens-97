import numpy as np
import torch
import torchvision.transforms as transforms
from PIL import Image

from model_loader import get_species_model, get_common_name

# croped image is to be resized to 480x480 before classification.
# as seen from the sample code given.
transform = transforms.Compose([
    transforms.Resize((480, 480)),
    transforms.ToTensor(),
])

@torch.no_grad()
def classify_crop(crop_path: str) -> str:
    """
    classifies one cropped animal image.
    returns: common animal name.
    """

    model, species_classes, device = get_species_model()

    print("Classifying crop:", crop_path)
    print("Using device:", device)

    image = Image.open(crop_path).convert("RGB")

    image_tensor = transform(image) # C,H,W
    image_tensor = image_tensor.unsqueeze(0) # B,C,H,W

    # The lecturer sample does:
    # img = img.permute(0,2,3,1)
    # So we follow the same shape conversion.
    image_tensor = image_tensor.permute(0, 2, 3, 1)

    image_tensor = image_tensor.to(device)

    print("Classifier input tensor shape:", list(image_tensor.shape))

    logits = model(image_tensor)

    print("Classifier logits type:", type(logits))

    if hasattr(logits, "shape"):
        print("Classifier logits shape:", list(logits.shape))

    probabilities = torch.softmax(logits, dim=1)[0].cpu().numpy()

    sorted_indexes = np.argsort(probabilities)[::-1]

    top_predictions = []

    for index in sorted_indexes[:5]:
        index = int(index)

        scientific_name = species_classes[index]
        common_name = get_common_name(scientific_name)
        confidence = float(probabilities[index])

        top_predictions.append({
            "index": index,
            "scientific_name": scientific_name,
            "common_name": common_name,
            "confidence": confidence
        })

    print("Top 5 predictions:", top_predictions)

    best_index = int(sorted_indexes[0])
    best_scientific_name = species_classes[best_index]
    best_common_name = get_common_name(best_scientific_name)
    best_confidence = float(probabilities[best_index])

    print("Final crop prediction scientific name:", best_scientific_name)
    print("Final crop prediction common name:", best_common_name)
    print("Final crop prediction confidence:", best_confidence)

    if best_confidence < 0.6:
        print("Skipping crop because classifier confidence is too low:", best_confidence)
        return None
    return best_common_name

def classify_crops(crop_paths: list[str]) -> list[str]:
    """
    classifies multiple cropped animal images.
    returns: list of common animal names.
    """

    predictions = []

    for crop_path in crop_paths:
        prediction = classify_crop(crop_path)
        predictions.append(prediction)

    print("All crop predictions:", predictions)

    return predictions