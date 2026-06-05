import functions_framework

from inference_service import perform_inference
from download_service import download_presigned_url_file, cleanup_file as cleanup_downloaded_file

# enpoint receives presigned url to the s3 bucket where the image to be processed.
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

        request_uuid = request_json.get("uuid")
        file_type = request_json.get("file_type")
        presigned_url = request_json.get("presigned_url")

        if not request_uuid:
            return {
                "status": "error",
                "message": "Missing 'uuid' in request body."
            }, 400
        
        if not file_type:
            return {
                "status": "error",
                "message": "Missing 'file_type' in request body."
            }, 400

        if not presigned_url:
            return {
                "status": "error",
                "message": "Missing 'presigned_url' in request body."
            }, 400
        
        local_file_path = download_presigned_url_file(presigned_url, request_uuid, file_type)
        tags = perform_inference(local_file_path)

        return {
            "status": "success",
            "uuid": request_uuid,
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
            cleanup_downloaded_file(local_file_path)



