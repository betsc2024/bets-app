import requests

API_KEY    = "changeme"
BASE_URL   = "http://127.0.0.1:8000"
ENDPOINT   = "/users/add"

params = {
    "num_users":20,
    "company_name": "test"
}
headers ={
    "X-API-KEY": API_KEY
}

response = requests.post(f"{BASE_URL}{ENDPOINT}", params=params, headers=headers)
print("Status Code:", response.status_code)
print("Response:", response.json())