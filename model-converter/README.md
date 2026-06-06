# EcoLens Model Converter

## Model Download

Model can be downloaded from this link: https://drive.google.com/drive/folders/1GAJFNaymsli6gWbU8jLuvNhOKeuB0GB2?usp=sharing

Put the model in this folder.

## Using `uv`

```
# Install Python 3.12 if you don't have it
uv python install 3.12

# Create venv + install all deps
uv sync
```

## Run the conversion

```
uv run python convert_to_onnx.py
```