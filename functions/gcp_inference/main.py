from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def health_check():
    return {"status": "ok"}

@app.post("/infer")
def infer(payload: dict):
    return {
        "tags": {
            "koala": 1
        }
    }