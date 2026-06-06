"""
convert_to_onnx.py
==================
One-time offline conversion of the two PyTorch models used in the
camera-trap pipeline to ONNX format, ready for ONNX Runtime inference
inside the Cloud Function (no PyTorch at runtime).

Models
------
  mdv5a.pt  → mdv5a.onnx
    MegaDetector v5a (YOLOv5 detection model)
    Loaded via megadetector's PTDetector — plain torch.load fails because
    the checkpoint pickle references the YOLOv5 `models` package.
    Input:  (batch, 3, 640, 640)   BCHW

  model.pt  → model.onnx
    Fine-tuned species classifier
    Saved with onnx2torch classes in its pickle — onnx2torch must be
    installed in the environment for torch.load to unpickle it.
    Input:  (batch, 480, 480, 3)   BHWC  ← channel-last!
    (batch.py: ToTensor() then .permute(0,2,3,1) before calling model)

Usage
-----
  uv run python convert_to_onnx.py
  uv run python convert_to_onnx.py --skip-classifier   # detector only
  uv run python convert_to_onnx.py --skip-detector     # classifier only
  uv run python convert_to_onnx.py \
      --detector  /path/to/mdv5a.pt \
      --classifier /path/to/model.pt \
      --output-dir ./onnx

Upload to GCS after conversion
-------------------------------
  gsutil cp ./onnx/*.onnx gs://<your-models-bucket>/models/
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
import torch.nn as nn

# ─── Input shape constants (sourced from batch.py) ───────────────────────────

# MegaDetector v5a — standard BCHW
DETECTOR_H = 640
DETECTOR_W = 640

# Species classifier — channel-last BHWC (batch.py permutes before calling model)
CLASSIFIER_H = 480
CLASSIFIER_W = 480

ONNX_OPSET = 17


# ─── Model loading ────────────────────────────────────────────────────────────

def load_detector(pt_path: Path) -> nn.Module:
    """
    Load MegaDetector v5a via megadetector's PTDetector.

    Plain torch.load fails with 'No module named models' because the YOLOv5
    checkpoint pickle contains references to the YOLOv5 `models` package.
    PTDetector sets up the correct import context before unpickling.

    PyTorch 2.6 changed weights_only default to True; we register the YOLOv5
    globals so the checkpoint can be unpickled safely.
    """
    # Alias yolov5 modules under the bare `models.*` namespace that the
    # MegaDetector checkpoint pickle expects.
    import importlib, sys
    for _src, _dst in [
        ("yolov5.models.yolo",         "models.yolo"),
        ("yolov5.models.common",       "models.common"),
        ("yolov5.models.experimental", "models.experimental"),
        ("yolov5.utils.general",       "utils.general"),
        ("yolov5.utils.torch_utils",   "utils.torch_utils"),
        ("yolov5.utils.loss",          "utils.loss"),
    ]:
        try:
            if _dst not in sys.modules:
                sys.modules[_dst] = importlib.import_module(_src)
        except ModuleNotFoundError:
            pass

    # PyTorch 2.6+ defaults weights_only=True, which blocks unpickling the
    # YOLOv5 Model class.  PTDetector calls torch.load internally, so we
    # monkeypatch torch.load to force weights_only=False for the duration of
    # the PTDetector instantiation, then restore the original.
    import torch as _torch
    _orig_load = _torch.load

    def _patched_load(*args, **kwargs):
        kwargs.setdefault("weights_only", False)
        return _orig_load(*args, **kwargs)

    from detection.pytorch_detector import PTDetector

    print(f"  Loading {pt_path} via PTDetector …")
    _torch.load = _patched_load
    try:
        detector = PTDetector(str(pt_path), force_cpu=True)
    finally:
        _torch.load = _orig_load  # always restore

    model = detector.model.float().eval()  # fp32 for ONNX export; converted to fp16 post-export
    print("  ↳ Loaded via PTDetector.")
    return model


def load_classifier(pt_path: Path) -> nn.Module:
    """
    Load the fine-tuned species classifier via torch.load.

    model.pt was built by converting an ONNX model to PyTorch using
    onnx2torch, then saving with torch.save. Its pickle contains onnx2torch
    class references, so onnx2torch must be installed in the environment.
    """
    print(f"  Loading {pt_path} via torch.load …")
    model = torch.load(pt_path, map_location="cpu", weights_only=False)
    if not isinstance(model, nn.Module):
        raise ValueError(
            f"Expected an nn.Module in {pt_path}, got {type(model)}.\n"
            "If this is a state-dict, instantiate the architecture first."
        )
    print("  ↳ Loaded full model object.")
    return model.eval()


# ─── ONNX export + validation ─────────────────────────────────────────────────

def export_to_onnx(
    model: nn.Module,
    dummy_input: torch.Tensor,
    output_path: Path,
    input_names: list[str],
    output_names: list[str],
    dynamic_axes: dict | None = None,
) -> None:
    """Trace the model and write an ONNX file."""
    print(f"  Exporting → {output_path}  (input shape: {list(dummy_input.shape)}) …")

    # YOLOv5: set export=True on the Detect head so it returns raw tensors
    # instead of running the dynamic anchor cat() that breaks TorchScript tracing.
    # We must export the DetectionModel (not the inner Sequential) because YOLOv5
    # routing logic (m.f skip-connections) lives in DetectionModel._forward_once.
    export_model = model  # keep the full DetectionModel with routing intact
    # Navigate to the Detect layer: DetectionModel.model[-1]
    _layers = model.model if hasattr(model, "model") else None
    if _layers is not None and hasattr(_layers[-1], "export"):
        _layers[-1].export = True

    with torch.no_grad():
        torch.onnx.export(
            export_model,
            dummy_input,
            str(output_path),
            opset_version=ONNX_OPSET,
            input_names=input_names,
            output_names=output_names,
            dynamic_axes=dynamic_axes,
            do_constant_folding=True,
            export_params=True,
            dynamo=False,  # force legacy TorchScript path; avoids torch.export
                           # data-dependent shape errors in onnx2torch graphs
        )

    print(f"  Saved  ({output_path.stat().st_size / 1_048_576:.1f} MB)")


def validate_onnx(onnx_path: Path, dummy_np: np.ndarray, input_name: str) -> None:
    """
    1. Static graph check via onnx.checker.
    2. Live forward pass through ONNX Runtime (fp32 only — ORT CPU doesn't
       support fp16 weights, so the runtime pass is skipped for fp16 models).
    """
    print("  Validating …")

    model_proto = onnx.load(str(onnx_path))
    onnx.checker.check_model(model_proto)
    print("  ✓ ONNX graph is valid.")

    # Detect whether the model has fp16 initializers (weights).
    has_fp16 = any(
        t.data_type == onnx.TensorProto.FLOAT16
        for t in model_proto.graph.initializer
    )
    if has_fp16:
        print("  ⓘ fp16 model — skipping ORT CPU runtime pass (CPU EP doesn't support fp16 weights).")
        return

    opts = ort.SessionOptions()
    opts.inter_op_num_threads = 1
    opts.intra_op_num_threads = 1
    sess = ort.InferenceSession(
        str(onnx_path), sess_options=opts, providers=["CPUExecutionProvider"]
    )

    outputs = sess.run(None, {input_name: dummy_np})
    print("  ✓ ONNX Runtime forward pass succeeded.")
    for i, out in enumerate(outputs):
        print(f"    output[{i}]  shape={out.shape}  dtype={out.dtype}")


# ─── Conversion routines ──────────────────────────────────────────────────────

def convert_detector(pt_path: Path, output_dir: Path) -> Path:
    """
    MegaDetector v5a (YOLOv5).
    Input: (batch, 3, H, W) — BCHW, float32, values in [0, 1].
    """
    print("\n── MegaDetector v5a ─────────────────────────────────────────────")
    model = load_detector(pt_path)
    dummy = torch.zeros(1, 3, DETECTOR_H, DETECTOR_W, dtype=torch.float32)
    output_path = output_dir / (pt_path.stem + ".onnx")

    export_to_onnx(
        model=model,
        dummy_input=dummy,
        output_path=output_path,
        input_names=["images"],
        output_names=["output0"],
        dynamic_axes={"images": {0: "batch"}, "output0": {0: "batch"}},
    )

    # Convert to fp16 post-export: halves file size back to ~original .pt size.
    # disable_shape_infer=False lets the converter reason about shapes.
    # keep_io_types=True keeps graph inputs/outputs in fp32 for ORT compatibility.
    # op_block_list blocks ops that ORT CPU doesn't support in fp16.
    print("  Converting to fp16 …")
    from onnxconverter_common import convert_float_to_float16
    # Range is the main op ORT CPU can't run in fp16; Cast/Resize/Upsample are
    # fine to convert — the converter updates their 'to' attribute correctly.
    _ORT_FP16_BLOCKLIST = {"Range"}
    fp16_model = convert_float_to_float16(
        onnx.load(str(output_path)),
        keep_io_types=True,
        op_block_list=_ORT_FP16_BLOCKLIST,
        disable_shape_infer=False,
    )
    onnx.save(fp16_model, str(output_path))
    print(f"  Saved fp16 ({output_path.stat().st_size / 1_048_576:.1f} MB)")

    validate_onnx(output_path, dummy.numpy(), input_name="images")
    return output_path


def convert_classifier(pt_path: Path, output_dir: Path) -> Path:
    """
    Fine-tuned species classifier.
    Input: (batch, 480, 480, 3) — BHWC, float32, values in [0, 1].

    Channel-last matches the permute(0,2,3,1) in batch.py that happens
    after transforms.ToTensor() before the model is called.
    """
    print("\n── Species Classifier ───────────────────────────────────────────")
    model = load_classifier(pt_path)
    dummy = torch.zeros(1, CLASSIFIER_H, CLASSIFIER_W, 3, dtype=torch.float32)
    output_path = output_dir / (pt_path.stem + ".onnx")

    export_to_onnx(
        model=model,
        dummy_input=dummy,
        output_path=output_path,
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
    )
    validate_onnx(output_path, dummy.numpy(), input_name="input")
    return output_path


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Export mdv5a.pt and model.pt to ONNX for Cloud Function inference."
    )
    p.add_argument("--detector",         type=Path, default=Path("mdv5a.pt"))
    p.add_argument("--classifier",       type=Path, default=Path("model.pt"))
    p.add_argument("--output-dir",       type=Path, default=Path("./onnx"))
    p.add_argument("--skip-detector",    action="store_true")
    p.add_argument("--skip-classifier",  action="store_true")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    converted: list[Path] = []
    errors: list[str] = []

    if not args.skip_detector:
        if not args.detector.exists():
            errors.append(f"Detector not found: {args.detector}")
        else:
            try:
                converted.append(convert_detector(args.detector, args.output_dir))
            except Exception as exc:
                errors.append(f"Detector conversion failed: {exc}")

    if not args.skip_classifier:
        if not args.classifier.exists():
            errors.append(f"Classifier not found: {args.classifier}")
        else:
            try:
                converted.append(convert_classifier(args.classifier, args.output_dir))
            except Exception as exc:
                errors.append(f"Classifier conversion failed: {exc}")

    print("\n" + "═" * 60)
    print("CONVERSION SUMMARY")
    print("═" * 60)

    if converted:
        print(f"\n✓ {len(converted)} model(s) exported:")
        for p in converted:
            print(f"   {p}  ({p.stat().st_size / 1_048_576:.1f} MB)")
        print("\nUpload to GCS:")
        for p in converted:
            print(f"   gsutil cp {p} gs://<your-models-bucket>/models/")

    if errors:
        print(f"\n✗ {len(errors)} error(s):")
        for e in errors:
            print(f"   {e}")
        sys.exit(1)

    print()


if __name__ == "__main__":
    main()