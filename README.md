# User Management API

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.85-green)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](#license)

---

## 📖 Table of Contents

1. [Overview](#-overview)
2. [Features](#-features)
3. [Prerequisites](#-prerequisites)
4. [Project Structure](#-project-structure)
5. [Installation & Setup](#-installation--setup)
6. [Configuration](#-configuration)
7. [Running the Server](#-running-the-server)
8. [API Usage](#-api-usage)

   * [Add Users Endpoint](#add-users-endpoint)
9. [Client Example](#-client-example)
10. [Scripts](#-scripts)
11. [Logs](#-logs)
12. [Cleaning Up](#-cleaning-up)
13. [License](#-license)

---

## 🔍 Overview

This **User Management API** allows bulk importing of users from a CSV file into a Supabase backend, including both database records and authentication. Uploaded CSVs are temporarily stored in `app/logs/`, processed, then automatically removed.

Built with:

* **FastAPI** for the HTTP server
* **Supabase** client for database & auth
* **python-multipart** for file uploads
* **python-dotenv** for environment variables

## ✨ Features

* Upload any-size CSV of users (email, full\_name, password)
* Automatically create auth and DB records via a Supabase RPC
* Logs each upload in `app/logs/` with timestamped filenames
* Cleans up log files after processing
* Script to backfill empty department/designation fields

## 🛠 Prerequisites

* Python 3.8 or higher
* Pip (Python package installer)
* Supabase project with following tables/functions:

  * `companies(id, name)`
  * `users` table for user metadata
  * `create_user_with_auth` RPC for combined auth + DB insert

## 📂 Project Structure

```
FastAPI_Based/
├── app/
│   ├── logs/                # Temp storage for uploaded CSVs
│   │   └── <timestamp>_file.csv
│   ├── main.py              # FastAPI routes & logic
│   ├── parser.py            # CSV parsing helper
│   ├── user_manage.py       # Supabase client & RPC wrapper
│   └── delete_users.py      # (if used for separate deletion)
├── scripts/
│   └── update_empty_fields.py  # Backfill department/designation
├── data.csv                 # Sample CSV for testing
├── test.py                  # Example client script
├── .env                     # Environment variables
├── requirements.txt         # Python dependencies
├── README.md                # This file
└── PushLog.txt              # (if used for logging)
```

## ⚙️ Installation & Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/yourusername/UserManagementAPI.git
   cd UserManagementAPI
   ```

2. **Create a virtual environment** (optional but recommended)

   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Unix/macOS
   .\.venv\Scripts\activate  # Windows
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**

   * Copy `.env.example` to `.env`
   * Fill in your Supabase and API key values

## 📝 Configuration

Your `.env` should include:

```ini
SUPABASE_URL="https://xyz.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
MY_API_KEY="changeme"
```

## 🚀 Running the Server

```bash
uvicorn app.main:app --reload
```

* The API will be available at `http://127.0.0.1:8000`
* Swagger UI: `http://127.0.0.1:8000/docs`
* ReDoc: `http://127.0.0.1:8000/redoc`

## 📡 API Usage

### Add Users Endpoint

```http
POST /users/add
```

| Parameter      | Type     | In    | Description                                        |
| -------------- | -------- | ----- | -------------------------------------------------- |
| `company_name` | `string` | Query | Name of the company to associate users             |
| `csv_file`     | `file`   | Form  | CSV file with headers: email, full\_name, password |

**Headers:**

```
X-API-Key: <your_api_key>
```

**Response:**

```json
{
  "created": 10,
  "total": 10
}
```

## 🧪 Client Example

Use `test.py` to quickly test:

```bash
python test.py
```

```
For better debugging , can move the test.py and data.csv to a different folder and run the test.py from that folder.
no issues for current structure as well.
```

```python
# test.py excerpt
files = {"csv_file": open("data.csv","rb")}
params = {"company_name": "test"}

response = requests.post(...)
print(response.json())
```

## 🛠 Scripts

* **Update empty fields:** `scripts/update_empty_fields.py`

  * Backfills any user with empty `department` or `designation` to "No Department" / "No Designation".

```bash
python scripts/update_empty_fields.py
```

## 📂 Logs

Uploaded CSVs are stored in `app/logs/` with filenames like `20250731_142200_data.csv` and deleted immediately after processing.

## 🧹 Cleaning Up

* To disable auto-deletion for debugging, comment out the `os.remove(file_path)` line in `app/main.py`.
* Old logs folder auto-creates; ensure it's in `.gitignore`.
