import requests

resp = requests.post(
    "http://127.0.0.1:8000/api/sync/historical",
    json={"all_listed": True, "incremental_days": 730, "period": "daily"},
    timeout=60,
)
print(resp.status_code)
print(resp.text)
