from fastapi import FastAPI, HTTPException
from schemas import InferenceRequest, InferenceResponse
from inference_service import perform_inference
from model_loader import download_models
from gcs_service import download_gcs_file, cleanup_file
from model_loader import download_models, load_species_model

app = FastAPI()

@app.get("/")
def health_check():
    return {"status": "ok"}

# enpoint receives the GCS URI of the image/frame to be processed.
# media processor cloud run servise will upload the image/frame to gcs,
# and then call this endpoint with the GCS URI of the uploaded image/frame.
@app.post("/infer", response_model=InferenceResponse)
def infer(request: InferenceRequest):
    local_file_path = None
    try:
        local_file_path = download_gcs_file(request.image_uri)
        tags = perform_inference(local_file_path)

        return InferenceResponse(
            status="success",
            image_uri=request.image_uri,
            tags=tags
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    # always ensuring that the downloaded file is cleaned up after inference.
    finally:
        if local_file_path:
            cleanup_file(local_file_path)



# test endpoint to trigger model download
@app.get("/test-model-download")
def test_model_download():

    results = load_species_model()

    return {
        "status": "success",
        **results
    }