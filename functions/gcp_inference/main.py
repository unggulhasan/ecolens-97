from fastapi import FastAPI, HTTPException
from schemas import InferenceRequest, InferenceResponse
from download_service import download_file_from_url, cleanup_file
from inference_service import perform_inference
from model_loader import download_models

app = FastAPI()

@app.get("/")
def health_check():
    return {"status": "ok"}

@app.post("/infer", response_model=InferenceResponse)
def infer(request: InferenceRequest):
    local_file_path = None
    try:
        local_file_path = download_file_from_url(request.presigned_url)
        results = perform_inference(local_file_path)

        return InferenceResponse(
            status="success",
            filename=local_file_path,
            tags=results
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    finally:
        if local_file_path:
            cleanup_file(local_file_path)



# test endpoint to trigger model download
@app.get("/test-model-download")
def test_model_download():

    download_models()

    return {
        "status": "success"
    }