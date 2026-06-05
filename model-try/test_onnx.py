"""
test_onnx.py
============
End-to-end camera-trap inference using ONNX Runtime only — no PyTorch required.

Pipeline (mirrors model-converter/onnx/old/batch.py but with .onnx models):
  1. Load MegaDetector v5a  (mdv5a.onnx)  — detect animals in each image
  2. Crop detected bounding boxes, resize to 600×600  (SNIP_SIZE)
  3. Load species classifier  (model.onnx)  — classify each crop
  4. Output a JSON array where each element maps a common name to its detection
     count across all images, e.g.:
       [{"australian magpie": 2}, {"northern brown bandicoot": 3}]

Model input/output specs (from convert_to_onnx.py):
  mdv5a.onnx
    input  "images"  : float32  [batch, 3, 640, 640]   BCHW, values in [0, 1]
    output "output0" : float32  [batch, 25200, 6]       raw YOLO predictions
                                                        columns: cx, cy, w, h, obj_conf, class_conf
                                                        (class=1 → animal)
  model.onnx
    input  "input"   : float32  [batch, 480, 480, 3]   BHWC, values in [0, 1]
    output "logits"  : float32  [batch, num_classes]

Usage
-----
  uv run python test_onnx.py
  uv run python test_onnx.py --detector mdv5a.onnx --classifier model.onnx --images test_images/
  uv run python test_onnx.py --conf 0.1 --iou 0.45 --top-k 5
  uv run python test_onnx.py --output results.json
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from PIL import Image
from tqdm import tqdm

# ─── Class labels (from batch.py) and common names (from labels.txt) ─────────
# Order must match the species classifier's output logits exactly.

CLASSES: list[str] = [
    'Alectura_lathami', 'Antechinus_agilis', 'Bos_taurus', 'Burhinus_grallarius',
    'Canis_familiaris', 'Chalcophaps_longirostris', 'Colluricincla_harmonica',
    'Corcorax_melanorhamphos', 'Dacelo_novaeguineae', 'Dama_dama',
    'Eopsaltria_australis', 'Felis_catus', 'Geopelia_humeralis', 'Gymnorhina_tibicen',
    'Homo_sapiens', 'Isoodon_macrourus', 'Lepus_europaeus', 'Macropus_giganteus',
    'Menura_novaehollandiae', 'Mus_musculus', 'Oryctolagus_cuniculus',
    'Perameles_nasuta', 'Pitta_versicolor', 'Rattus', 'Rattus_fuscipes',
    'Rattus_rattus', 'Strepera_graculina', 'Sus_scrofa', 'Tachyglossus_aculeatus',
    'Thylogale_stigmatica', 'Trichosurus_caninus', 'Trichosurus_cunninghami',
    'Trichosurus_vulpecula', 'Varanus_varius', 'Vombatus_ursinus', 'Vulpes_vulpes',
    'Wallabia_bicolor', 'Canis_dingo', 'Capra_hircus', 'Casuarius_casuarius',
    'Heteromyias_cinereifrons', 'Hypsiprymnodon_moschatus', 'Megapodius_reinwardt',
    'Notamacropus_rufogriseus', 'Orthonyx_spaldingii', 'Uromys_caudimaculatus',
]

# Maps Genus_species → common name (field 6 of labels.txt)
COMMON_NAMES: dict[str, str] = {
    'Alectura_lathami':         'australian brushturkey',
    'Antechinus_agilis':        'agile antechinus',
    'Bos_taurus':               'cattle',
    'Burhinus_grallarius':      'bush thick-knee',
    'Canis_familiaris':         'dingo',
    'Chalcophaps_longirostris': 'pacific emerald dove',
    'Colluricincla_harmonica':  'grey shrikethrush',
    'Corcorax_melanorhamphos':  'white-winged chough',
    'Dacelo_novaeguineae':      'laughing kookaburra',
    'Dama_dama':                'fallow deer',
    'Eopsaltria_australis':     'eastern yellow robin',
    'Felis_catus':              'domestic cat',
    'Geopelia_humeralis':       'bar-shouldered dove',
    'Gymnorhina_tibicen':       'australian magpie',
    'Homo_sapiens':             'human',
    'Isoodon_macrourus':        'northern brown bandicoot',
    'Lepus_europaeus':          'european hare',
    'Macropus_giganteus':       'eastern gray kangaroo',
    'Menura_novaehollandiae':   'superb lyrebird',
    'Mus_musculus':             'house mouse',
    'Oryctolagus_cuniculus':    'european rabbit',
    'Perameles_nasuta':         'long-nosed bandicoot',
    'Pitta_versicolor':         'noisy pitta',
    'Rattus':                   'rattus',
    'Rattus_fuscipes':          'australian bush rat',
    'Rattus_rattus':            'black rat',
    'Strepera_graculina':       'pied currawong',
    'Sus_scrofa':               'wild boar',
    'Tachyglossus_aculeatus':   'australian echidna',
    'Thylogale_stigmatica':     'red-legged pademelon',
    'Trichosurus_caninus':      'short-eared possum',
    'Trichosurus_cunninghami':  'mountain brushtail opossum',
    'Trichosurus_vulpecula':    'common brushtail',
    'Varanus_varius':           'lace monitor',
    'Vombatus_ursinus':         'common wombat',
    'Vulpes_vulpes':            'red fox',
    'Wallabia_bicolor':         'swamp wallaby',
    'Canis_dingo':              'dingo',
    'Capra_hircus':             'domestic goat',
    'Casuarius_casuarius':      'southern cassowary',
    'Heteromyias_cinereifrons': 'grey-headed robin',
    'Hypsiprymnodon_moschatus': 'musky rat kangaroo',
    'Megapodius_reinwardt':     'orange-footed scrubfowl',
    'Notamacropus_rufogriseus': 'red-necked wallaby',
    'Orthonyx_spaldingii':      'northern chowchilla',
    'Uromys_caudimaculatus':    'giant white-tailed rat',
}

# ─── Constants (mirror batch.py / convert_to_onnx.py) ────────────────────────

DETECTOR_SIZE   = 640   # MegaDetector input resolution (square)
CLASSIFIER_H    = 480   # Classifier input height
CLASSIFIER_W    = 480   # Classifier input width
SNIP_SIZE       = 600   # Crop resize before classifier (cosmetic — we resize again to 480×480)
ANIMAL_CLASS_ID = 1     # MegaDetector category 1 = animal
DEFAULT_CONF    = 0.05  # minimum object confidence (matches batch.py LOWER_CONF)
DEFAULT_IOU     = 0.45  # IoU threshold for NMS


# ─── ONNX graph patching ─────────────────────────────────────────────────────

def patch_fp16_cast_nodes(model_path: Path) -> bytes:
    """
    Fix a known bug in onnxconverter_common's convert_float_to_float16:
    it updates value_info type annotations to FLOAT16 (10) but leaves Cast
    node 'to' attributes pointing to FLOAT32 (1), causing ORT to reject the
    graph with a type mismatch error.

    Strategy: for every Cast node whose output is annotated as FLOAT16 in
    value_info but whose 'to' attribute says FLOAT32, update 'to' to FLOAT16.
    Returns the patched model as serialised bytes (not written to disk).
    """
    proto = onnx.load(str(model_path))
    g = proto.graph

    # Build lookup: tensor_name → elem_type from value_info
    vi_type: dict[str, int] = {
        vi.name: vi.type.tensor_type.elem_type for vi in g.value_info
    }

    FLOAT32  = onnx.TensorProto.FLOAT        # 1
    FLOAT16  = onnx.TensorProto.FLOAT16      # 10

    patched = 0
    for node in g.node:
        if node.op_type != "Cast":
            continue
        for attr in node.attribute:
            if attr.name != "to":
                continue
            if attr.i != FLOAT32:
                continue
            # Cast says → FLOAT32, but check what value_info says
            for out_name in node.output:
                if vi_type.get(out_name) == FLOAT16:
                    attr.i = FLOAT16
                    patched += 1
                    break

    if patched:
        print(f"  ⚙  Patched {patched} Cast node(s) (fp16 type mismatch fix).")

    return proto.SerializeToString()


# ─── ONNX Runtime session helpers ────────────────────────────────────────────

def make_session(model_path: Path, patch_fp16: bool = False) -> ort.InferenceSession:
    """Create a CPU ONNX Runtime session.

    If patch_fp16=True, fix Cast node type mismatches in fp16 models produced
    by onnxconverter_common before handing the graph to ORT.
    """
    opts = ort.SessionOptions()
    opts.inter_op_num_threads = 4
    opts.intra_op_num_threads = 4
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    if patch_fp16:
        model_bytes = patch_fp16_cast_nodes(model_path)
        return ort.InferenceSession(
            model_bytes,
            sess_options=opts,
            providers=["CPUExecutionProvider"],
        )

    return ort.InferenceSession(
        str(model_path),
        sess_options=opts,
        providers=["CPUExecutionProvider"],
    )


# ─── Image preprocessing ──────────────────────────────────────────────────────

def preprocess_for_detector(image: Image.Image) -> np.ndarray:
    """
    Resize to DETECTOR_SIZE×DETECTOR_SIZE, normalise to [0, 1].
    Returns float32 array with shape [1, 3, H, W]  (BCHW).
    """
    img = image.convert("RGB").resize(
        (DETECTOR_SIZE, DETECTOR_SIZE), Image.BILINEAR
    )
    arr = np.array(img, dtype=np.float32) / 255.0   # HWC [0,1]
    arr = arr.transpose(2, 0, 1)                      # CHW
    return arr[np.newaxis, ...]                        # BCHW


def preprocess_for_classifier(crop: Image.Image) -> np.ndarray:
    """
    Resize to CLASSIFIER_H×CLASSIFIER_W, normalise to [0, 1].
    Returns float32 array with shape [1, H, W, C]  (BHWC — channel-last,
    matching the permute(0,2,3,1) done in batch.py after ToTensor()).
    """
    img = crop.convert("RGB").resize(
        (CLASSIFIER_W, CLASSIFIER_H), Image.BILINEAR
    )
    arr = np.array(img, dtype=np.float32) / 255.0   # HWC [0,1]
    return arr[np.newaxis, ...]                        # BHWC


# ─── Detection post-processing (YOLO NMS) ────────────────────────────────────

def xywh_to_xyxy(boxes: np.ndarray) -> np.ndarray:
    """Convert [cx, cy, w, h] → [x1, y1, x2, y2]."""
    out = np.empty_like(boxes)
    out[:, 0] = boxes[:, 0] - boxes[:, 2] / 2  # x1
    out[:, 1] = boxes[:, 1] - boxes[:, 3] / 2  # y1
    out[:, 2] = boxes[:, 0] + boxes[:, 2] / 2  # x2
    out[:, 3] = boxes[:, 1] + boxes[:, 3] / 2  # y2
    return out


def iou(box: np.ndarray, boxes: np.ndarray) -> np.ndarray:
    """Compute IoU between one box [x1,y1,x2,y2] and an array of boxes."""
    inter_x1 = np.maximum(box[0], boxes[:, 0])
    inter_y1 = np.maximum(box[1], boxes[:, 1])
    inter_x2 = np.minimum(box[2], boxes[:, 2])
    inter_y2 = np.minimum(box[3], boxes[:, 3])

    inter_area = np.maximum(0, inter_x2 - inter_x1) * np.maximum(0, inter_y2 - inter_y1)
    box_area   = (box[2] - box[0]) * (box[3] - box[1])
    boxes_area = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
    union_area = box_area + boxes_area - inter_area
    return inter_area / (union_area + 1e-6)


def nms(boxes: np.ndarray, scores: np.ndarray, iou_thresh: float) -> list[int]:
    """Greedy NMS. Returns indices of kept boxes (sorted by descending score)."""
    order  = np.argsort(scores)[::-1]
    kept: list[int] = []
    while order.size > 0:
        i = int(order[0])
        kept.append(i)
        if order.size == 1:
            break
        rest_boxes = boxes[order[1:]]
        ious       = iou(boxes[i], rest_boxes)
        order      = order[1:][ious <= iou_thresh]
    return kept


def decode_detector_output(
    output0: np.ndarray,
    orig_w: int,
    orig_h: int,
    conf_thresh: float,
    iou_thresh: float,
) -> list[tuple[int, int, int, int, float]]:
    """
    Decode raw YOLO output into a list of bounding boxes for category=1 (animal).

    output0 shape: [1, num_predictions, 6]  (cx, cy, w, h, obj_conf, cls1_conf)
    MegaDetector v5a has 3 classes: 1=animal, 2=person, 3=vehicle.
    The raw format after ONNX export (with Detect.export=True set during conversion)
    is: [cx, cy, w, h, conf_animal, conf_person, conf_vehicle]  — 7 columns,
    OR the objectness-multiplied format [cx, cy, w, h, obj*cls0, obj*cls1, obj*cls2] — 7 cols,
    OR the compact [cx, cy, w, h, max_conf, class_id] — 6 cols.
    We handle both by checking the last dimension.

    All coordinates are normalised to [0, 1] relative to DETECTOR_SIZE.

    Returns list of (x1, y1, x2, y2, conf) in original image pixel coordinates.
    """
    preds = output0[0]  # [num_preds, cols]
    cols  = preds.shape[1]

    if cols >= 7:
        # Format: cx, cy, w, h, obj_conf, cls0_conf, cls1_conf, ...
        # Compute per-class scores = obj_conf * cls_conf
        obj_conf  = preds[:, 4:5]               # [N,1]
        cls_confs = preds[:, 5:]                 # [N, num_classes]
        scores_all = obj_conf * cls_confs        # [N, num_classes]
        # Animal is class index 0 (MegaDetector: 1=animal → index 0 in cls array)
        animal_scores = scores_all[:, 0]
        mask = animal_scores >= conf_thresh
        filtered = preds[mask]
        animal_scores = animal_scores[mask]
    elif cols == 6:
        # Format: cx, cy, w, h, conf, class_id
        conf_col  = preds[:, 4]
        class_col = preds[:, 5]
        mask = (conf_col >= conf_thresh) & (np.round(class_col).astype(int) == (ANIMAL_CLASS_ID - 1))
        filtered      = preds[mask]
        animal_scores = filtered[:, 4]
    else:
        return []

    if filtered.shape[0] == 0:
        return []

    # Convert normalised cx,cy,w,h → pixel xyxy in original image space
    scale_x = orig_w / DETECTOR_SIZE
    scale_y = orig_h / DETECTOR_SIZE

    boxes_norm = filtered[:, :4].copy()
    boxes_norm[:, 0] *= scale_x
    boxes_norm[:, 2] *= scale_x
    boxes_norm[:, 1] *= scale_y
    boxes_norm[:, 3] *= scale_y

    boxes_xyxy = xywh_to_xyxy(boxes_norm)

    # Clip to image bounds
    boxes_xyxy[:, [0, 2]] = np.clip(boxes_xyxy[:, [0, 2]], 0, orig_w)
    boxes_xyxy[:, [1, 3]] = np.clip(boxes_xyxy[:, [1, 3]], 0, orig_h)

    kept_idx = nms(boxes_xyxy, animal_scores, iou_thresh)
    result = []
    for i in kept_idx:
        x1, y1, x2, y2 = boxes_xyxy[i].astype(int)
        if (x2 - x1) > 0 and (y2 - y1) > 0:
            result.append((x1, y1, x2, y2, float(animal_scores[i])))
    return result


# ─── Crop helper ──────────────────────────────────────────────────────────────

def crop_and_resize(image: Image.Image, box: tuple[int, int, int, int], size: int) -> Image.Image:
    """Crop image to box (x1,y1,x2,y2) and resize to size×size."""
    x1, y1, x2, y2 = box
    crop = image.crop((x1, y1, x2, y2))
    return crop.resize((size, size), Image.BILINEAR)


# ─── Classifier helpers ───────────────────────────────────────────────────────

def softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()


def classify(
    sess: ort.InferenceSession,
    crop: Image.Image,
    classes: list[str],
    top_k: int,
) -> list[tuple[str, float]]:
    """Run the species classifier on a single crop. Returns top-k (label, prob) pairs."""
    inp = preprocess_for_classifier(crop)
    logits = sess.run(None, {"input": inp})[0][0]   # shape [num_classes]
    probs  = softmax(logits)
    order  = np.argsort(probs)[::-1]
    return [(classes[i], float(probs[i])) for i in order[:top_k]]



# ─── Main inference loop ──────────────────────────────────────────────────────

def run(
    detector_path: Path,
    classifier_path: Path,
    images_dir: Path,
    conf_thresh: float,
    iou_thresh: float,
    output_path: Path | None,
) -> None:
    print(f"Loading detector  : {detector_path}")
    det_sess = make_session(detector_path, patch_fp16=True)
    print(f"Loading classifier: {classifier_path}")
    cls_sess = make_session(classifier_path)

    image_files = sorted(images_dir.glob("*.JPG")) + sorted(images_dir.glob("*.jpg"))
    if not image_files:
        print(f"No images found in {images_dir}")
        return

    print(f"\nRunning inference on {len(image_files)} images …\n")

    # common_name → detection count
    counts: dict[str, int] = defaultdict(int)

    for img_path in tqdm(image_files, unit="img"):
        image = Image.open(img_path).convert("RGB")
        W, H  = image.size

        # ── Detection ────────────────────────────────────────────────────────
        det_input  = preprocess_for_detector(image)
        output0    = det_sess.run(None, {"images": det_input})[0]
        detections = decode_detector_output(output0, W, H, conf_thresh, iou_thresh)

        if not detections:
            continue

        for x1, y1, x2, y2, det_conf in detections:
            crop = crop_and_resize(image, (x1, y1, x2, y2), SNIP_SIZE)

            # ── Classification ───────────────────────────────────────────────
            predictions = classify(cls_sess, crop, CLASSES, top_k=1)
            top_label   = predictions[0][0]
            common_name = COMMON_NAMES.get(top_label, top_label)
            counts[common_name] += 1

    # Build output: [{"<common name>": <count>}, ...] sorted by count desc
    result = [{name: count} for name, count in
              sorted(counts.items(), key=lambda x: x[1], reverse=True)]

    output_str = json.dumps(result, indent=4)
    print("\n" + output_str)

    if output_path:
        output_path.write_text(output_str)
        print(f"\nSaved → {output_path}")


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Test ONNX camera-trap pipeline (MegaDetector + species classifier)."
    )
    p.add_argument("--detector",    type=Path, default=Path("mdv5a.onnx"),
                   help="Path to MegaDetector ONNX model  (default: mdv5a.onnx)")
    p.add_argument("--classifier",  type=Path, default=Path("model.onnx"),
                   help="Path to species classifier ONNX model  (default: model.onnx)")
    p.add_argument("--images",      type=Path, default=Path("test_images"),
                   help="Directory containing test images  (default: test_images/)")
    p.add_argument("--conf",        type=float, default=DEFAULT_CONF,
                   help=f"Detection confidence threshold  (default: {DEFAULT_CONF})")
    p.add_argument("--iou",         type=float, default=DEFAULT_IOU,
                   help=f"NMS IoU threshold  (default: {DEFAULT_IOU})")
    p.add_argument("--output",      type=Path,  default=None,
                   help="Optional path to write JSON results  (default: stdout only)")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(
        detector_path=args.detector,
        classifier_path=args.classifier,
        images_dir=args.images,
        conf_thresh=args.conf,
        iou_thresh=args.iou,
        output_path=args.output,
    )
