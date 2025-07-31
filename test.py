import requests

API_KEY  = "changeme"
BASE_URL = "http://127.0.0.1:8000"
ENDPOINT = "/users/add"

params = {
    "company_name": "test"
}
headers = {
    "X-API-Key": API_KEY
}
files = {
    "csv_file": open("data.csv", "rb")
}

response = requests.post(
    f"{BASE_URL}{ENDPOINT}",
    params=params,
    headers=headers,
    files=files
)

print("Status Code:", response.status_code)
print("Response:", response.json())
