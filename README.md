# Ambulance-Asha 2.0 🏥🚑
> **Hybrid-Edge AI Triage Assistant for Resource-Constrained & Offline Environments**
> 
> *Submitting to the Gemma 4 Good Hackathon (Tracks: Global Resilience & Ollama)*

---

## 🌟 The Vision

In emergencies, **every second counts**. In rural areas, high-altitude regions, or aftermaths of natural disasters, cellular networks are often down or extremely congested, leaving paramedics without critical clinical support. 

**Ambulance-Asha 2.0** is an offline-capable, dual-model triage assistant that brings frontier medical intelligence directly to the edge. Operating 100% locally on standard paramedic field equipment, it processes spoken descriptions of injuries, assigns a standardized triage priority level, triggers hospital alert protocols, and generates complex, specialized clinical procedures on-demand. 

By utilizing Google's groundbreaking **Gemma 4** open-model family, Ambulance-Asha 2.0 democratizes life-saving triage decisions anywhere, anytime, with zero dependency on the cloud.

---

## 🏗️ Architecture: The Hybrid-Edge Principle

Ambulance-Asha 2.0 leverages a **Dual-Model Hybrid-Edge Architecture** to strike the perfect balance between **real-time responsiveness** and **clinical depth**.

```mermaid
graph TD
    A[Paramedic Voice Input] --> B[Siri-Style Procedural Wave Visualizer]
    A --> C[HTML5 MediaRecorder (Offline WebM Blob)]
    C --> C2[FastAPI /transcribe Endpoint]
    C2 --> C3[faster-whisper tiny Local STT]
    C3 --> D[FastAPI Backend Routing]
    
    D --> E[gemma4:e2b - The Sprinter]
    E --> F{Priority Determination}
    
    F -->|RED / YELLOW| G[Hospital Notified via Tool Call]
    F -->|RED / YELLOW| H[Auto-Trigger Deep Specialist Review]
    
    D --> I[gemma4:26b - The Specialist]
    H --> I
    I --> J[Generates Detailed Clinical Protocol]
    
    E --> K[Next.js Pulse HUD Dashboard]
    J --> K
```

### 🧠 Model Orchestration Comparison

| Model | Size | Role | Speed (Latency) | Specialization |
| :--- | :--- | :--- | :--- | :--- |
| **`gemma4:e2b`** <br>*(The Sprinter)* | 2.6B | **Field Triage & Action** | **~250-500ms** | Ultra-low latency voice-to-text triage, live feedback, and automated tool-calling (`alert_hospital`). |
| **`gemma4:26b`** <br>*(The Specialist)* | 26B | **Clinical Reasoning** | **~3-5 seconds** | Advanced diagnosis recommendations, comprehensive medical protocols, and vital monitoring advice. |

---

## 🚀 Key Features

1. **100% Offline Speech-to-Text**: Powered by an ultra-fast, local C++ optimized `faster-whisper` (tiny) model running directly on the backend. Click-to-record voice reports are captured via native HTML5 MediaRecorder and transcribed entirely offline with zero cloud dependency!
2. **Standardized Clinical Priorities**: Dynamically classifies patient status into color-coded emergency categories:
   * 🔴 **RED**: Immediate threat to life (trauma, cardiac arrest).
   * 🟡 **YELLOW**: Urgent but stable.
   * 🟢 **GREEN**: Delayed/minor injury.
   * ⚫ **BLACK**: Deceased/expectant.
3. **Local Tool Calling (Function Calling)**: When a `RED` or `YELLOW` status is determined, the Edge model (`gemma4:e2b`) automatically issues a mock `alert_hospital` function call, notifying ER trauma teams of the incoming ETA and patient vitals.
4. **Deep Specialist Protocol**: पैरामेडिक्स can tap "Request Protocol" to activate `gemma4:26b`, producing a fully detailed, step-by-step treatment guide based on regional clinical protocols.
5. **Gorgeous Pulsing Telemetry HUD**: A dark, glassmorphic Next.js interface with real-time Siri-style procedural waveform audio visualizers, dynamic latency metrics, specialist controls, and interactive patient triage logs.

---

## 🛠️ Installation & Setup

Ensure you have **Ollama** installed on your system.

### Step 1: Install & Boot Ollama Models
Download the Gemma 4 variants to run locally:
```bash
# Pull the 2.6B lightweight Edge model
ollama pull gemma4:e2b

# Pull the 26B flagship reasoning model
ollama pull gemma4:26b
```

### Step 2: Set Up FastAPI Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Set up virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # On Windows PowerShell
   pip install fastapi uvicorn ollama pydantic requests
   ```
3. Run the development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *The backend will now be live on `http://127.0.0.1:8000`.*

### Step 3: Set Up Next.js Frontend
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Boot the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`.

---

## 🧪 Verification & Testing

To test the backend independently of the UI:
1. Make sure your FastAPI backend is running.
2. Execute the test suite script:
   ```bash
   python backend/test_triage.py
   ```
3. This sends a mock high-severity trauma report (`"Patient is unconscious with a deep puncture wound in the abdomen. Massive blood loss."`) and verifies that `gemma4:e2b` correctly triggers the `alert_hospital` tool call and returns triage telemetry.

---

## 🏆 Hackathon Tracks Fit

* **Global Resilience ($10,000 Award)**: 
  Operates completely offline, making it an essential, field-deployable disaster response system that mitigates high-stakes triage bottlenecks when telecommunications infrastructure collapses.
* **Ollama Special Technology ($10,000 Award)**: 
  Exemplifies standard-setting local model orchestration. Shows how lightweight models (`gemma4:e2b`) can run seamlessly alongside heavy frontier models (`gemma4:26b`) on standard consumer laptops with local function calling.
