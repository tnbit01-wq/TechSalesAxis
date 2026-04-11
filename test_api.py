import requests
import json

base_url = "http://127.0.0.1:8005/api/v1/intelligence/career-readiness/adaptive-question"

profiles = [
    ("Profile A (Employed, Active)", {"employment_status": "Employed", "job_search_mode": "Active", "timeline": "1 month", "step": 2}),
    ("Profile B (Unemployed, Passive)", {"employment_status": "Unemployed", "job_search_mode": "Passive", "timeline": "6 months", "step": 2}),
    ("Profile C (Employed, Exploring)", {"employment_status": "Employed", "job_search_mode": "Exploring", "timeline": "3 months", "step": 2})
]

for i, (name, params) in enumerate(profiles, 1):
    print(f"\n{'='*70}")
    print(f"TEST {i} - {name}")
    print(f"{'='*70}")
    print(f"Parameters: {json.dumps(params, indent=2)}")
    print(f"\nResponse:")
    try:
        r = requests.post(base_url, json=params, timeout=10)
        r.raise_for_status()
        print(json.dumps(r.json(), indent=2))
    except Exception as e:
        print(f"ERROR: {e}")
