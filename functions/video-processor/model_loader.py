"""Lazy ONNX Runtime session loader.

Downloads the MegaDetector + species classifier .onnx files from GCS on
the first invocation, builds CPU ORT sessions, and caches them as module
globals so subsequent warm invocations skip the I/O cost.

Model artefacts use FIXED filenames in the bucket so a new model version
can be deployed by overwriting the same GCS object — no code change, no
redeploy required.  Object versioning on the bucket gives rollback safety.
"""

from __future__ import annotations

import os
import threading
from pathlib import Path

import onnx
import onnxruntime as ort
from google.cloud import storage


# ─── Configuration (env-driven) ───────────────────────────────────────────────

MODEL_BUCKET_NAME = os.environ.get("MODEL_BUCKET_NAME", "aussie-ecolens-gcp-models")
DETECTOR_FILE     = os.environ.get("DETECTOR_FILE",     "mdv5a.onnx")
CLASSIFIER_FILE   = os.environ.get("CLASSIFIER_FILE",   "model.onnx")
MODEL_DIR         = Path(os.environ.get("MODEL_DIR",    "/tmp/models"))


# ─── Cached singletons ────────────────────────────────────────────────────────

_detector_session:   ort.InferenceSession | None = None
_classifier_session: ort.InferenceSession | None = None
_init_lock = threading.Lock()


# ─── ONNX graph patching (from model-try/test_onnx.py) ────────────────────────

def _patch_fp16_cast_nodes(model_path: Path) -> bytes:
    """Fix Cast node type mismatches produced by onnxconverter_common's fp16
    conversion: it updates value_info to FLOAT16 but leaves Cast 'to'
    attributes at FLOAT32, which ORT rejects.

    Returns the (possibly patched) model as serialised bytes.
    """
    proto = onnx.load(str(model_path))
    g = proto.graph

    vi_type: dict[str, int] = {
        vi.name: vi.type.tensor_type.elem_type for vi in g.value_info
    }

    FLOAT32 = onnx.TensorProto.FLOAT
    FLOAT16 = onnx.TensorProto.FLOAT16

    patched = 0
    for node in g.node:
        if node.op_type != "Cast":
            continue
        for attr in node.attribute:
            if attr.name != "to":
                continue
            if attr.i != FLOAT32:
                continue
            for out_name in node.output:
                if vi_type.get(out_name) == FLOAT16:
                    attr.i = FLOAT16
                    patched += 1
                    break

    if patched:
        print(f"[MODEL] Patched {patched} Cast node(s) for fp16 type mismatch ({model_path.name})")

    return proto.SerializeToString()


# ─── GCS download ─────────────────────────────────────────────────────────────

def _download_blob_if_missing(bucket: storage.Bucket, blob_name: str, destination: Path) -> Path:
    """Download a single GCS object to /tmp if not already cached."""
    if destination.exists():
        print(f"[MODEL] {blob_name} already cached at {destination}")
        return destination

    print(f"[MODEL] Downloading gs://{bucket.name}/{blob_name} → {destination}")
    blob = bucket.blob(blob_name)
    blob.download_to_filename(str(destination))
    print(f"[MODEL] Downloaded {blob_name} ({destination.stat().st_size / 1e6:.1f} MB)")
    return destination


def _ensure_models_downloaded() -> tuple[Path, Path]:
    """Download detector + classifier .onnx files to MODEL_DIR if needed."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    client = storage.Client()
    bucket = client.bucket(MODEL_BUCKET_NAME)

    detector_path   = _download_blob_if_missing(bucket, DETECTOR_FILE,   MODEL_DIR / DETECTOR_FILE)
    classifier_path = _download_blob_if_missing(bucket, CLASSIFIER_FILE, MODEL_DIR / CLASSIFIER_FILE)

    return detector_path, classifier_path


# ─── ORT session factory ──────────────────────────────────────────────────────

def _make_session(model_path: Path, patch_fp16: bool) -> ort.InferenceSession:
    opts = ort.SessionOptions()
    opts.inter_op_num_threads = 4
    opts.intra_op_num_threads = 4
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    if patch_fp16:
        model_bytes = _patch_fp16_cast_nodes(model_path)
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


# ─── Public API ───────────────────────────────────────────────────────────────

def get_sessions() -> tuple[ort.InferenceSession, ort.InferenceSession]:
    """Return (detector_session, classifier_session), initialising on first call."""
    global _detector_session, _classifier_session

    if _detector_session is not None and _classifier_session is not None:
        return _detector_session, _classifier_session

    with _init_lock:
        # Double-check inside the lock
        if _detector_session is None or _classifier_session is None:
            print("[MODEL] Cold start — downloading models and building ORT sessions")
            detector_path, classifier_path = _ensure_models_downloaded()

            print(f"[MODEL] Loading detector   : {detector_path}")
            _detector_session = _make_session(detector_path, patch_fp16=True)

            print(f"[MODEL] Loading classifier : {classifier_path}")
            _classifier_session = _make_session(classifier_path, patch_fp16=False)

            print("[MODEL] ORT sessions ready")

    return _detector_session, _classifier_session
