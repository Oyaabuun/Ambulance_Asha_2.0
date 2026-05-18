import os
import shutil
import json
import ollama
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from faster_whisper import WhisperModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize offline Whisper STT model (tiny: ~75MB, CPU-friendly)
print("Initializing offline Whisper STT model...")
whisper_model = WhisperModel("tiny", device="cpu", compute_type="float32")
print("Offline Whisper STT model ready!")

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        # Save uploaded file temporarily
        temp_file_path = f"temp_{file.filename}"
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Transcribe audio file
        segments, info = whisper_model.transcribe(temp_file_path, beam_size=5)
        
        text = " ".join([segment.text for segment in segments]).strip()
        
        # Clean up temporary file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            
        print(f"[OFFLINE STT] Transcribed text: {text}")
        return {"status": "success", "text": text}
    except Exception as e:
        print(f"[OFFLINE STT] Error: {e}")
        return {"status": "error", "message": str(e)}

# Mock function for Gemma to call
def alert_hospital(vitals: str, priority: str):
    """
    Alert the local hospital of an incoming high-priority emergency.
    
    Args:
        vitals (str): Patient's vital signs and key symptoms.
        priority (str): Priority level (e.g., RED or YELLOW).
    """
    print(f"\n[ALERTAGENT] 🚨 Hospital notified for {priority} case. Vitals: {vitals}\n")
    
    if priority.upper() == "RED":
        return "Hospital Alerted. Trauma team activated. ETA required."
    elif priority.upper() == "YELLOW":
        return "Hospital Alerted. ER bed reserved. Await further updates."
    return "Hospital Alerted."

class Message(BaseModel):
    role: str
    text: str

class TriageRequest(BaseModel):
    voice_input: str
    history: list[Message] = []

@app.post("/triage")
async def process_emergency(request: TriageRequest):
    system_prompt = """You are 'Asha', an elite Medic Assistant AI. Your role is to rapidly triage patient conditions reported by paramedics and assign a priority level.

CATEGORIES:
- RED (Immediate): Life-threatening injuries (e.g., crushed chest, cardiac arrest, severe bleeding).
- YELLOW (Urgent): Serious but not immediately life-threatening.
- GREEN (Delayed): Minor injuries.
- BLACK (Deceased/Expectant): Unresponsive with no vital signs.

INSTRUCTIONS:
1. Analyze the paramedic's input and ANY PREVIOUS CONTEXT provided in the history.
2. Determine the Priority Level.
3. Recommend an immediate First Aid Protocol.
4. If Priority is RED or YELLOW, you MUST call the `alert_hospital` function (only once per session).
5. ALWAYS provide a verbal summary of your triage and next steps to the paramedic. 
6. Keep your text response under 3 sentences. Be concise, fast, and authoritative."""

    # Using the new Gemma 4 edge model for ultra-fast triage
    model_name = 'gemma4:e2b'
    
    messages = [{'role': 'system', 'content': system_prompt}]
    
    # Reconstruct history for context
    for msg in request.history:
        # Map frontend roles to Ollama roles
        role = 'user' if msg.role == 'paramedic' else 'assistant'
        messages.append({'role': role, 'content': msg.text})
    
    # Add current input
    messages.append({'role': 'user', 'content': request.voice_input})
    
    try:
        response = ollama.chat(
            model=model_name,
            messages=messages,
            tools=[alert_hospital]
        )
        
        # Check if the model called a tool
        if 'message' in response and 'tool_calls' in response['message'] and response['message']['tool_calls']:
            tool_call = response['message']['tool_calls'][0]
            if tool_call['function']['name'] == 'alert_hospital':
                args = tool_call['function']['arguments']
                tool_result = alert_hospital(args.get('vitals', 'unknown'), args.get('priority', 'unknown'))
                
                # Append tool call and result to messages to let the model generate the final response
                messages.append(response['message'])
                messages.append({
                    'role': 'tool',
                    'content': tool_result,
                    'name': 'alert_hospital'
                })
                
                final_response = ollama.chat(
                    model=model_name,
                    messages=messages
                )
                
                # Fallback if the model is silent after tool call
                content = final_response['message'].get('content', '').strip()
                if not content:
                    content = f"Priority {args.get('priority', 'UNKNOWN')}. Hospital has been notified. Trauma team is on standby. Follow primary trauma protocols."

                print(f"[ASHA] Response: {content}")
                return {
                    "status": "success", 
                    "response": content,
                    "hospital_alerted": True,
                    "alert_details": args
                }
                
        content = response['message']['content']
        print(f"[ASHA] Standard Response: {content}")
        
        # Fallback: Parse priority from text if tool call was missed
        priority_fallback = None
        content_upper = content.upper()
        if "RED" in content_upper: priority_fallback = "RED"
        elif "YELLOW" in content_upper: priority_fallback = "YELLOW"
        elif "GREEN" in content_upper: priority_fallback = "GREEN"

        return {
            "status": "success", 
            "response": content,
            "hospital_alerted": False,
            "alert_details": {"priority": priority_fallback} if priority_fallback else None
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/deep-analysis")
async def deep_analysis(request: TriageRequest):
    """
    Uses gemma4:26b for high-precision medical protocol and risk assessment.
    """
    system_prompt = """You are 'Asha-Specialist', a senior Medical Consultant AI. 
    You are provided with a paramedic's report and the conversation history. 
    Your task is to provide:
    1. A detailed risk assessment based on the evolving situation.
    2. A step-by-step advanced first-aid protocol.
    3. Specific vitals to monitor closely.
    
    Be extremely detailed, clinical, and authoritative. Use the full reasoning capability of Gemma 4:26B."""

    messages = [{'role': 'system', 'content': system_prompt}]
    for msg in request.history:
        role = 'user' if msg.role == 'paramedic' else 'assistant'
        messages.append({'role': role, 'content': msg.text})
    
    messages.append({'role': 'user', 'content': request.voice_input})

    try:
        response = ollama.chat(
            model='gemma4:26b',
            messages=messages
        )
        return {
            "status": "success",
            "analysis": response['message']['content']
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
