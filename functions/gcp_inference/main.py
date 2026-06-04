import functions_framework

from inference_service import perform_inference
from gcs_service import download_gcs_file, cleanup_file
from model_loader import download_models, load_species_model


# enpoint receives the GCS URI of the image/frame to be processed.
# media processor cloud run servise will upload the image/frame to gcs,
# and then call this endpoint with the GCS URI of the uploaded image/frame.
@functions_framework.http
def infer(request):
    local_file_path = None
    try:

        # health check 
        if request.method == "GET":
            return {
                "status": "ok"
            }, 200
        
        request_json = request.get_json(silent=True)

        if not request_json:
            return {
                "status": "error",
                "message": "Missing JSON body."
            }, 400

        image_uri = request_json.get("image_uri")
        if not image_uri:
            return {
                "status": "error",
                "message": "Missing 'image_uri' in request body."
            }, 400
        
        local_file_path = download_gcs_file(image_uri)
        tags = perform_inference(local_file_path)

        return {
            "status": "success",
            "image_uri": image_uri,
            "tags": tags
        }, 200
    except Exception as error:
        print("[INFER] Error:", str(error))
        return {
            "status": "error",
            "message": str(error)
        }, 500
        
    # always ensuring that the downloaded file is cleaned up after inference.
    finally:
        if local_file_path:
            cleanup_file(local_file_path)



