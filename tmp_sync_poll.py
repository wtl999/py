import sys
import time
import requests

task_id = sys.argv[1]
deadline = time.time() + 1800
url = f"http://127.0.0.1:8000/api/sync/status/{task_id}"

last = None
while time.time() < deadline:
    data = requests.get(url, timeout=30).json()
    key = (data.get("status"), data.get("done"), data.get("total"), data.get("failed"))
    if key != last:
        print(data, flush=True)
        last = key
    if data.get("status") in {"done", "done_with_errors", "unknown"}:
        break
    time.sleep(5)
