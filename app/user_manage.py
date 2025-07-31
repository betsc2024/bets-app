import os
from supabase import create_client, Client
from dotenv import load_dotenv
import json

load_dotenv()
URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not URL or not KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(URL, KEY)

def get_company_by_name(name: str) -> str:
    try:
        response = supabase.table("companies").select("id").eq("name", name).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]["id"]
        else:
            return None
    except Exception as e:
        print(f"❌ Error fetching company: {e}")
        return None

def create_user(email: str, password: str, full_name: str, company_id: str) -> dict:
    payload = {
        "p_email": email,
        "p_password": password,
        "p_full_name": full_name,
        "p_role": "user",
        "p_company_id": company_id,
        "p_department": "No Department",
        "p_designation": "No Designation",
    }
    try:
        res = supabase.rpc("create_user_with_auth", payload).execute()
        data = res.data[0] if isinstance(res.data, list) else res.data
        # If the data is not a dict, try to parse from string
        if not isinstance(data, dict):
            try:
                data = json.loads(data)
            except Exception:
                pass
        # If still not dict, check for error with success in details
        if not isinstance(data, dict) or not data.get("success"):
            # Check for error in res.error or res.data
            error = getattr(res, "error", None) or data
            # Handle Supabase bug: success returned as string in error details
            if isinstance(error, dict) and "details" in error and "success" in error["details"]:
                try:
                    details = error["details"]
                    if details.startswith("b'") or details.startswith('b"'):
                        details = details[2:-1]  # Remove b'' or b""
                    parsed = json.loads(details)
                    if parsed.get("success"):
                        print(f"✅ Imported (workaround): {email} ({full_name})")
                        return parsed
                except Exception:
                    pass
            # If not success, raise error
            raise RuntimeError(f"Error creating user: {data}")
        return data
    except Exception as e:
        # Check for this specific error
        error_str = str(e)
        if "'success' : true" in error_str or '"success" : true' in error_str:
            # Extract the details and treat as success
            import re
            match = re.search(r'\\?{.*?success.*?true.*?}', error_str)
            if match:
                details = match.group(0)
                try:
                    parsed = json.loads(details.replace("'", '"'))
                    print(f"✅ Imported (workaround): {email} ({full_name})")
                    return parsed
                except Exception:
                    pass
        print(f"❌ Error creating user: {e}")
        return {"success": False, "error": str(e)}
