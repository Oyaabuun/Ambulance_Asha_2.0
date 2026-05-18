import requests
import json

def test_emergency(input_text):
    url = "http://127.0.0.1:8000/triage"
    payload = {"voice_input": input_text}
    
    print(f"\n[TEST] Sending Emergency Input: '{input_text}'")
    try:
        response = requests.post(url, json=payload)
        result = response.json()
        print(f"Status: {result.get('status')}")
        print(f"Hospital Alerted: {result.get('hospital_alerted')}")
        print(f"Asha's Response: {result.get('response')}")
        if result.get('alert_details'):
            print(f"Alert Details: {json.dumps(result['alert_details'], indent=2)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Test a RED priority case
    test_emergency("Patient is unconscious with a deep puncture wound in the abdomen. Massive blood loss.")
