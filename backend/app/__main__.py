"""``python -m app`` : run the API on the configured (loopback by default) host."""
import uvicorn

from app.config import get_settings

if __name__ == "__main__":
    s = get_settings()  # validation rejects non-loopback host unless explicitly allowed
    uvicorn.run("app.main:app", host=s.host, port=s.port, log_level="info")
