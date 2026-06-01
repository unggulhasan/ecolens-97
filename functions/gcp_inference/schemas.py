from pydantic import BaseModel, HttpUrl

class InferenceRequest(BaseModel):
    presigned_url: HttpUrl

class InferenceResponse(BaseModel):
    status: str
    filename: str
    tags: dict[str, float]