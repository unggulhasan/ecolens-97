import functions_framework


@functions_framework.http
def accept(request):
    """Simple Cloud Function that returns a JSON response with HTTP 200."""
    return {"message": "accepted"}, 200, {"Content-Type": "application/json"}
