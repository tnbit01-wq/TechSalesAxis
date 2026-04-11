import requests
import json
import time

base_url = "http://127.0.0.1:8005/api/v1/intelligence/career-readiness/adaptive-question"

profiles = [
    ("Profile A (Employed, Active)", {"employment_status": "Employed", "job_search_mode": "Active", "timeline": "1 month", "step": 2}),
    ("Profile B (Unemployed, Passive)", {"employment_status": "Unemployed", "job_search_mode": "Passive", "timeline": "6 months", "step": 2}),
    ("Profile C (Employed, Exploring)", {"employment_status": "Employed", "job_search_mode": "Exploring", "timeline": "3 months", "step": 2})
]

results = []

for i, (name, params) in enumerate(profiles, 1):
    try:
        r = requests.post(base_url, json=params, timeout=10)
        r.raise_for_status()
        results.append({"name": name, "response": r.json()})
        time.sleep(0.5)
    except Exception as e:
        results.append({"name": name, "error": str(e)})

# Print all results cleanly
for result in results:
    print(f"\n{'='*70}")
    print(f"TEST: {result['name']}")
    print(f"{'='*70}")
    if "error" in result:
        print(f"ERROR: {result['error']}")
    else:
        data = result["response"].get("data", {})
        print(f"QUESTION:\n{data.get('question', 'N/A')}\n")
        print(f"OPTIONS:")
        for j, opt in enumerate(data.get("options", []), 1):
            print(f"  {j}. {opt}")
        print(f"\nREASONING:\n{data.get('reasoning', 'N/A')}\n")
        print(f"PERSONALIZATION:\n{data.get('personalization_notes', 'N/A')}")

# Comparison
print(f"\n{'='*70}")
print("COMPARISON ANALYSIS")
print(f"{'='*70}")

if len(results) == 3 and all("response" in r for r in results):
    q1 = results[0]["response"]["data"]["question"]
    q2 = results[1]["response"]["data"]["question"]
    q3 = results[2]["response"]["data"]["question"]
    
    print(f"\nProfile A question: {q1[:60]}...")
    print(f"Profile B question: {q2[:60]}...")
    print(f"Profile C question: {q3[:60]}...")
    
    if q1 == q2 == q3:
        print(f"\n*** RESULT: ALL QUESTIONS ARE IDENTICAL ***")
        print(f"The API is NOT personalizing based on user input!")
    else:
        print(f"\n*** RESULT: QUESTIONS ARE DIFFERENT ***")
        print(f"The API IS personalizing based on user input!")
        if q1 == q2:
            print(f"Profile A == Profile B")
        if q1 == q3:
            print(f"Profile A == Profile C")
        if q2 == q3:
            print(f"Profile B == Profile C")
