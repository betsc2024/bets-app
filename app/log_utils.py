import os
from datetime import datetime

def save_push_log(emails, log_file="PushLog.txt"):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_file, "w", encoding="utf-8") as f:
        f.write(f"Push Time: {now}\n")
        for email in emails:
            f.write(email + "\n")
