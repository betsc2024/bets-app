import csv

def extract_users_from_csv(csv_file):
    """
    Read the entire CSV and return a list of user dicts.
    """
    users = []
    with open(csv_file, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            users.append({
                "email": row["email"].lower(),
                "full_name": row["full_name"],
                "password": row["password"]
            })
    return users

def prepare_users_for_import(users, company_name):
    """
    Add company field to each user, defaulting to company_name.
    """
    for user in users:
        user["company"] = company_name
    return users
