import functions_framework


@functions_framework.http
def orchestrate(request):
    """
    AWS -> GCP Orchestrator endpoint.

    Expected request:
    {
        "file_id": "uuid",
        "presigned_url": "https://..."
    }

    Temporary response:
    {
        "file_id": "same uuid",
        "tags": [
            {"koala": 1},
            {"wombat": 2}
        ]
    }
    """

    try:
        if request.method == "GET":
            return {
                "status": "ok",
                "service": "gcp-orchestrator"
            }, 200

        if request.method != "POST":
            return {
                "status": "error",
                "message": "Only POST requests are supported."
            }, 405

        request_json = request.get_json(silent=True)

        if not request_json:
            return {
                "status": "error",
                "message": "Missing JSON body."
            }, 400

        file_id = request_json.get("file_id")
        presigned_url = request_json.get("presigned_url")

        if not file_id:
            return {
                "status": "error",
                "message": "Missing required field: file_id."
            }, 400

        if not presigned_url:
            return {
                "status": "error",
                "message": "Missing required field: presigned_url."
            }, 400

        if not isinstance(file_id, str):
            return {
                "status": "error",
                "message": "file_id must be a string."
            }, 400

        if not isinstance(presigned_url, str):
            return {
                "status": "error",
                "message": "presigned_url must be a string."
            }, 400

        if not presigned_url.startswith("https://"):
            return {
                "status": "error",
                "message": "presigned_url must start with https://."
            }, 400

        print("[ORCHESTRATOR] Received AWS request")
        print("[ORCHESTRATOR] file_id:", file_id)
        print("[ORCHESTRATOR] presigned_url:", presigned_url)

        # Temporary mock response for AWS -> GCP connection testing.
        # Later, replace this with calls to Media Processor and Inference.
        return {
            "file_id": file_id,
            "tags": [
                {
                    "koala": 1
                },
                {
                    "wombat": 2
                }
            ]
        }, 200

    except Exception as error:
        print("[ORCHESTRATOR] Error:", str(error))

        return {
            "status": "error",
            "message": str(error)
        }, 500