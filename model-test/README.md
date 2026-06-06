# EcoLens ONNX Model Test

## Model Download

Models and test_images can be downloaded from this link: https://drive.google.com/drive/folders/1GAJFNaymsli6gWbU8jLuvNhOKeuB0GB2?usp=sharing

Put the models and test_images in this folder.

## Using `uv`

```
# Install Python 3.12 if you don't have it
uv python install 3.12

# Create venv + install all deps
uv sync
```

## Run the conversion

```
uv run python test_onnx.py
```