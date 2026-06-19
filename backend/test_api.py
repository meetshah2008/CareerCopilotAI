import requests

try:
    resp = requests.post("http://127.0.0.1:8000/answer", json={"query": "What is your name?", "tone": "professional"})
    print("Status Code:", resp.status_code)
    print("Response:", resp.text)
except Exception as e:
    print("Error:", e)
