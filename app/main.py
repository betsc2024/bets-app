# app/main.py
import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import APIKeyHeader
from dotenv import load_dotenv

from .parser import extract_users_from_csv
from .user_manage import get_company_by_name, create_user
# from .log_utils import save_push_log

load_dotenv()

app = FastAPI(title="User Management API")

API_KEY_NAME = "X-API-Key"
API_KEY = os.getenv("MY_API_KEY") or "changeme"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")

CSV_FILE = "data.csv"

@app.post("/users/add")
def bulk_add_users(num_users: int, company_name: str, api_key: str = Depends(verify_api_key)):
    users = extract_users_from_csv(CSV_FILE, num_users)
    company_id = get_company_by_name(company_name)
    if not company_id:
        raise HTTPException(status_code=404, detail=f"Company '{company_name}' not found.")

    pushed_emails = []
    for user in users:
        res = create_user(user["email"], user["password"], user["full_name"], company_id)
        if res.get("success"):
            pushed_emails.append(user["email"])
    # save_push_log(pushed_emails)
    return {"created": len(pushed_emails), "total": len(users)}


