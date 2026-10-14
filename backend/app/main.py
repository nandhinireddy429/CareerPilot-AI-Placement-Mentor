import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

# Load environmental configs
load_dotenv(override=True)

from backend.app.api.routes import router as api_router

app = FastAPI(
    title="CareerPilot AI API",
    description="Backend API services for the CareerPilot AI Campus Placement platform.",
    version="1.0.0"
)

# Enable CORS for local cross-origin development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register backend APIs
app.include_router(api_router, prefix="/api")

# Serve Frontend static assets if directory exists
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))

if os.path.exists(FRONTEND_DIR):
    print(f"Serving frontend static files from: {FRONTEND_DIR}")
    
    # Mount scripts, styles, assets
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")
    
    # Serve index.html at root
    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
else:
    print(f"WARNING: Frontend folder not found at {FRONTEND_DIR}. APIs are active but static pages won't be served.")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "CareerPilot AI"}

if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    print(f"Starting CareerPilot AI server on http://{host}:{port}")
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=True)
