# updating the empty designation and department users to NoDepartment and NoDesignation.

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# ─── Setup ──────────────────────────────────────────────────────────────────────
load_dotenv()
URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not URL or not KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(URL, KEY)

# ─── Migration Function ─────────────────────────────────────────────────────────
def fill_empty_dept_and_designation():
    # 1️⃣ Fetch all users
    resp = supabase.table("users").select("id, department, designation").execute()
    users = resp.data or []

    updated = 0

    for u in users:
        changes = {}
        if not u.get("department"):
            changes["department"] = "No Department"
        if not u.get("designation"):
            changes["designation"] = "No Designation"

        if changes:
            # 2️⃣ Update only those fields
            upd = supabase.table("users") \
                          .update(changes) \
                          .eq("id", u["id"]) \
                          .execute()
            # Check for update success based on status_code or data
            if hasattr(upd, 'status_code') and (upd.status_code is not None) and (upd.status_code >= 400):
                print(f"❌ Failed to update user {u['id']}: status_code={upd.status_code}")
            elif not getattr(upd, 'data', None):
                print(f"❌ Failed to update user {u['id']}: No data returned")
            else:
                print(f"✅ Updated user {u['id']} → {changes}")
                updated += 1

    print(f"\nFinished. Total users updated: {updated}")

# ─── Run ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    fill_empty_dept_and_designation()
