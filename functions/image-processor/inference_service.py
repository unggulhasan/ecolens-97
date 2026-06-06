"""Single-image ONNX inference pipeline.

Download → detect (MegaDetector) → crop → classify → aggregate counts.
"""

from __future__ import annotations

import os
import tempfile
import uuid
from collections import defaultdict
from pathlib import Path

import numpy as np
import onnxruntime as ort
import requests
from PIL import Image

from labels import CLASSES, COMMON_NAMES
from model_loader import get_sessions


# ─── Constants (identical to model-try/test_onnx.py) ─────────────────────────

DETECTOR_SIZE   = 640
CLASSIFIER_H    = 480
CLASSIFIER_W    = 480
SNIP_SIZE       = 600
ANIMAL_CLASS_ID = 1
DEFAULT_CONF    = 0.05
DEFAULT_IOU     = 0.45

DOWNLOAD_TIMEOUT_SEC = 30


# ─── Preprocessing ────────────────────────────────────────────────────────────

def _preprocess_for_detector(image: Image.Image) -> np.ndarray:
    img = image.convert("RGB").resize((DETECTOR_SIZE, DETECTOR_SIZE), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)
    return arr[np.newaxis, ...]


def _preprocess_for_classifier(crop: Image.Image) -> np.ndarray:
    img = crop.convert("RGB").resize((CLASSIFIER_W, CLASSIFIER_H), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0
    return arr[np.newaxis, ...]


# ─── Detection post-processing ────────────────────────────────────────────────

def _xywh_to_xyxy(boxes: np.ndarray) -> np.ndarray:
    out = np.empty_like(boxes)
    out[:, 0] = boxes[:, 0] - boxes[:, 2] / 2
    out[:, 1] = boxes[:, 1] - boxes[:, 3] / 2
    out[:, 2] = boxes[:, 0] + boxes[:, 2] / 2
    out[:, 3] = boxes[:, 1] + boxes[:, 3] / 2
    return out


def _iou(box: np.ndarray, boxes: np.ndarray) -> np.ndarray:
    inter_x1 = np.maximum(box[0], boxes[:, 0])
    inter_y1 = np.maximum(box[1], boxes[:, 1])
    inter_x2 = np.minimum(box[2], boxes[:, 2])
    inter_y2 = np.minimum(box[3], boxes[:, 3])

    inter_area = np.maximum(0, inter_x2 - inter_x1) * np.maximum(0, inter_y2 - inter_y1)
    box_area   = (box[2] - box[0]) * (box[3] - box[1])
    boxes_area = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
    union_area = box_area + boxes_area - inter_area
    return inter_area / (union_area + 1e-6)


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_thresh: float) -> list[int]:
    order = np.argsort(scores)[::-1]
    kept: list[int] = []
    while order.size > 0:
        i = int(order[0])
        kept.append(i)
        if order.size == 1:
            break
        rest_boxes = boxes[order[1:]]
        ious       = _iou(boxes[i], rest_boxes)
        order      = order[1:][ious <= iou_thresh]
    return kept


def _decode_detector_output(
    output0: np.ndarray,
    orig_w: int,
    orig_h: int,
    conf_thresh: float,
    iou_thresh: float,
) -> list[tuple[int, int, int, int, float]]:
    preds = output0[0]
    cols  = preds.shape[1]

    if cols >= 7:
        obj_conf      = preds[:, 4:5]
        cls_confs     = preds[:, 5:]
        scores_all    = obj_conf * cls_confs
        animal_scores = scores_all[:, 0]
        mask          = animal_scores >= conf_thresh
        filtered      = preds[mask]
        animal_scores = animal_scores[mask]
    elif cols == 6:
        conf_col  = preds[:, 4]
        class_col = preds[:, 5]
        mask = (conf_col >= conf_thresh) & (
            np.round(class_col).astype(int) == (ANIMAL_CLASS_ID - 1)
        )
        filtered      = preds[mask]
        animal_scores = filtered[:, 4]
    else:
        return []

    if filtered.shape[0] == 0:
        return []

    scale_x = orig_w / DETECTOR_SIZE
    scale_y = orig_h / DETECTOR_SIZE

    boxes_norm = filtered[:, :4].copy()
    boxes_norm[:, 0] *= scale_x
    boxes_norm[:, 2] *= scale_x
    boxes_norm[:, 1] *= scale_y
    boxes_norm[:, 3] *= scale_y

    boxes_xyxy = _xywh_to_xyxy(boxes_norm)
    boxes_xyxy[:, [0, 2]] = np.clip(boxes_xyxy[:, [0, 2]], 0, orig_w)
    boxes_xyxy[:, [1, 3]] = np.clip(boxes_xyxy[:, [1, 3]], 0, orig_h)

    kept_idx = _nms(boxes_xyxy, animal_scores, iou_thresh)
    result: list[tuple[int, int, int, int, float]] = []
    for i in kept_idx:
        x1, y1, x2, y2 = boxes_xyxy[i].astype(int)
        if (x2 - x1) > 0 and (y2 - y1) > 0:
            result.append((int(x1), int(y1), int(x2), int(y2), float(animal_scores[i])))
    return result


# ─── Classifier helpers ───────────────────────────────────────────────────────

def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()


def _classify_crop(sess: ort.InferenceSession, crop: Image.Image) -> str:
    """Return the top-1 common name predicted for this crop."""
    inp    = _preprocess_for_classifier(crop)
    logits = sess.run(None, {"input": inp})[0][0]
    probs  = _softmax(logits)
    top_i  = int(np.argmax(probs))
    label  = CLASSES[top_i]
    return COMMON_NAMES.get(label, label.replace("_", " ").lower())


def _crop_and_resize(image: Image.Image, box: tuple[int, int, int, int], size: int) -> Image.Image:
    x1, y1, x2, y2 = box
    crop = image.crop((x1, y1, x2, y2))
    return crop.resize((size, size), Image.BILINEAR)


# ─── Image download ───────────────────────────────────────────────────────────

def _download_image(presigned_url: str) -> Path:
    """Stream the presigned URL to a unique /tmp file."""
    ext = ".jpg"
    # Try to extract a sensible extension from the URL path (before the query string)
    path_only = presigned_url.split("?", 1)[0]
    if "." in path_only.rsplit("/", 1)[-1]:
        candidate = "." + path_only.rsplit(".", 1)[-1].lower()
        if len(candidate) <= 6 and candidate.isascii():
            ext = candidate

    dest = Path(tempfile.gettempdir()) / f"img-{uuid.uuid4().hex}{ext}"
    print(f"[INFER] Downloading image → {dest}")

    with requests.get(presigned_url, stream=True, timeout=DOWNLOAD_TIMEOUT_SEC) as resp:
        resp.raise_for_status()
        with dest.open("wb") as fh:
            for chunk in resp.iter_content(chunk_size=64 * 1024):
                if chunk:
                    fh.write(chunk)

    print(f"[INFER] Downloaded {dest.stat().st_size / 1e6:.2f} MB")
    return dest


def _cleanup(path: Path | None) -> None:
    if path is None:
        return
    try:
        if path.exists():
            os.remove(path)
            print(f"[INFER] Cleaned up {path}")
    except OSError as e:
        print(f"[INFER] Cleanup failed for {path}: {e}")


# ─── Public entry point ───────────────────────────────────────────────────────

def run_inference(
    presigned_url: str,
    conf_thresh: float = DEFAULT_CONF,
    iou_thresh: float  = DEFAULT_IOU,
) -> list[dict[str, int]]:
    """Download → detect → classify → aggregate.

    Returns a list of single-key dicts sorted by descending count, e.g.
        [{"australian magpie": 2}, {"northern brown bandicoot": 1}]
    Matches the JSON result shape in gcp_image_processor_approach.md.
    """
    det_sess, cls_sess = get_sessions()

    local_path: Path | None = None
    try:
        local_path = _download_image(presigned_url)

        with Image.open(local_path) as image:
            image  = image.convert("RGB")
            W, H   = image.size

            # ── Detection ───────────────────────────────────────────────
            det_input  = _preprocess_for_detector(image)
            output0    = det_sess.run(None, {"images": det_input})[0]
            detections = _decode_detector_output(output0, W, H, conf_thresh, iou_thresh)
            print(f"[INFER] Detected {len(detections)} animal box(es)")

            if not detections:
                return []

            # ── Classification ──────────────────────────────────────────
            counts: dict[str, int] = defaultdict(int)
            for x1, y1, x2, y2, _det_conf in detections:
                crop = _crop_and_resize(image, (x1, y1, x2, y2), SNIP_SIZE)
                common_name = _classify_crop(cls_sess, crop)
                counts[common_name] += 1

        result = [
            {name: count}
            for name, count in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
        ]
        print(f"[INFER] Aggregated counts: {result}")
        return result

    finally:
        _cleanup(local_path)
