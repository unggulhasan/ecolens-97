from pydantic import BaseModel

class InferenceRequest(BaseModel):
    image_uri: str

class InferenceResponse(BaseModel):
    status: str
    image_uri: str
    tags: dict[str, float]