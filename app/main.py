import os
import shutil
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.security import APIKeyHeader
from dotenv import load_dotenv

from .parser import extract_users_from_csv
from .user_manage import get_company_by_name, create_user

load_dotenv()

app = FastAPI(title="User Management API")

API_KEY_NAME = "X-API-Key"
API_KEY = os.getenv("MY_API_KEY") or "changeme"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

LOGS_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")

@app.post("/users/add")
async def bulk_add_users(
    company_name: str,
    csv_file: UploadFile = File(...),
    api_key: str = Depends(verify_api_key),
):
    # Save to logs directory with timestamped filename
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{csv_file.filename}"
    file_path = os.path.join(LOGS_DIR, filename)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(csv_file.file, f)
    print(f"📁 File saved to: {file_path}")

    # Extract and push all users
    try:
        users = extract_users_from_csv(file_path)
        company_id = get_company_by_name(company_name)
        if not company_id:
            raise HTTPException(status_code=404, detail=f"Company '{company_name}' not found.")

        pushed = []
        for u in users:
            res = create_user(u["email"], u["password"], u["full_name"], company_id)
            if res.get("success"):
                pushed.append(u["email"])
    finally:
        # Clean up file
        os.remove(file_path)
        print(f"🗑️ Deleted file: {file_path}")

    return {"created": len(pushed), "total": len(users)}