# FastAPI Mass User Import API

A professional, production-ready FastAPI microservice for bulk importing users into a Supabase backend. This project provides a single, robust endpoint for mass user creation, suitable for admin and automation use cases.

---

## Features
- **Bulk User Import:** Add multiple users in one API call, with company association.
- **Supabase Integration:** Uses service role for secure, privileged access.
- **CSV-Driven:** Reads user data from a CSV file (`data.csv`).
- **API Key Security:** Protects endpoints with a configurable API key.

---

## Setup Instructions

### 1. Clone the Repository
```bash
# (If not already done)
git clone <your-repo-url>
cd <your-repo-folder>
```

### 2. Create and Activate Virtual Environment
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
- Copy `.env.example` to `.env` (or ensure `.env` exists).
- Set your Supabase credentials and API key in `.env`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `MY_API_KEY` (for API authentication)

### 5. Prepare your CSV
- Place your user data in `data.csv` (must have columns: `email`, `full_name`, `password`).

---

## Running the API

### 1. Start the FastAPI Server
```bash
uvicorn app.main:app --reload
```

### 2. Test the API (in a new terminal)
```bash
python ./test.py
```

---

## API Usage

### Endpoint: `POST /users/add`
Bulk import users from the CSV for a given company.

**Parameters (query or body):**
- `num_users` (int): Number of users to import (from the top of the CSV)
- `company_name` (str): Name of the company to associate users with

**Headers:**
- `X-API-KEY`: Your API key (as set in `.env`)

**Example Request:**
```
curl -X POST "http://127.0.0.1:8000/users/add?num_users=20&company_name=Acme" -H "X-API-KEY: changeme"
```

**Response:**
```json
{
  "created": 18,
  "total": 20
}
```
- `created`: Number of users successfully imported
- `total`: Number of users attempted (from CSV)

---

## File Structure
```
├── app/
│   ├── main.py         # FastAPI app and API endpoint
│   ├── parser.py       # CSV parsing utilities
│   ├── user_manage.py  # Supabase interaction logic
│   └── log_utils.py    # (Optional) Logging utilities
├── data.csv            # Your user data source
├── requirements.txt    # Python dependencies
├── test.py             # Example API test script
├── .env                # Environment variables (not committed)
└── README.md           # This documentation
```

---

## Notes & Best Practices
- **Security:** Keep your `.env` file secure. Do not expose your Supabase service role key.
- **Idempotency:** Duplicate emails in the CSV or existing users will not be created again (see API response for counts).
- **Extensibility:** The codebase is modular and can be extended for additional user management features.
- **Production:** For production use, remove `--reload` from the `uvicorn` command and use a robust process manager.

---

## License
MIT License. See `LICENSE` file for details.

---

## Maintainer
- [Your Name or Team]
- [Contact/Email/Website]

---

For issues, suggestions, or contributions, please open an issue or pull request on GitHub.
