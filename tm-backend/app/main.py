from fastapi import FastAPI

app = FastAPI(title="My FastAPI Backend")


@app.get("/")
def root():
    return {"message": "FastAPI backend is running!"}


@app.get("/health")
def health():
    return {"status": "ok"}
