import os
import requests

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "usbakers-crm"
_storage_key = None


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY not set")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": key}, timeout=15)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _request(method: str, rel_path: str, **kwargs):
    url = f"{STORAGE_URL}/objects/{APP_NAME}/uploads/{rel_path}"
    headers = kwargs.pop("headers", {})
    resp = requests.request(method, url, headers={**headers, "X-Storage-Key": init_storage()}, **kwargs)
    if resp.status_code == 404 and method == "PUT":
        resp = requests.request(method, url, headers={**headers, "X-Storage-Key": init_storage(force=True)}, **kwargs)
    resp.raise_for_status()
    return resp


def put_upload(rel_path: str, data: bytes, content_type: str) -> dict:
    return _request("PUT", rel_path, data=data, headers={"Content-Type": content_type}, timeout=120).json()


def get_upload(rel_path: str):
    resp = _request("GET", rel_path, timeout=60)
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
