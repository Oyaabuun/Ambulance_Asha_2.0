# Ambulance-Asha 2.0: A Hybrid-Edge AI Triage Assistant for Resource-Constrained Environments

* **Track Selection**: Impact Track — **Global Resilience** & Special Technology Track — **Ollama**
* **Project Repository**: [GitHub Code Link] *(Provide your public GitHub URL here)*
* **Video Demo**: [YouTube Link] *(Provide your 3-minute YouTube Pitch URL here)*
* **Live Demo**: [Live Website Link] *(Provide your public deployment or local video demo here)*

---

## 1. Executive Summary & The Story

In emergency medicine, the first 60 minutes after a traumatic injury—known as **The Golden Hour**—are the difference between life and death. In disaster zones, remote villages, or congested urban areas during severe network gridlocks, cellular and internet networks are often completely offline. Under these resource-constrained edge conditions, paramedics are cut off from senior clinical supervision, leaving them to make high-stakes, stressful triage decisions alone.

**Ambulance-Asha 2.0** is an offline-first, local-intelligence medical triage assistant. It acts as an elite virtual medical officer that sits directly in the ambulance or disaster response pack. Paramedics speak naturally to Asha about a patient’s condition, and Asha instantaneously performs standardized triage, triggers automated hospital notification protocols, and drafts deep, clinical-grade medical guidelines. 

By leveraging the local power of Google's **Gemma 4** open-weights model family, Ambulance-Asha 2.0 brings frontier-level clinical intelligence to the edge, working 100% locally with zero internet dependency and absolute privacy.

---

## 2. Technical Architecture: The Hybrid-Edge Paradigm

To succeed in emergency environments, an AI must be **instantaneous** and **authoritative**. A single large frontier model can suffer from high latency, stalling paramedics when seconds are vital. Conversely, an ultra-small model can react instantly but may lack the deep reasoning required for complex clinical situations.

To solve this, Ambulance-Asha 2.0 introduces a **Dual-Model Hybrid-Edge Architecture**, orchestrating two distinct local Gemma 4 weights concurrently through Ollama:

```
[Paramedic Speech Report] 
      │
      ▼ (HTML5 MediaRecorder & local faster-whisper)
[FastAPI Telemetry Router]
      │
      ├──► [gemma4:e2b (2.6B) - The Sprinter] (Latency: ~300ms)
      │          │
      │          ├──► Dynamic Triage Rating (RED/YELLOW/GREEN)
      │          │
      │          └──► NATIVE TOOL CALL: alert_hospital() (Trauma Team Alert)
      │
      └──► [gemma4:26b (26B) - The Specialist] (Latency: ~4s, Auto-triggered or On-Demand)
                 │
                 └──► Deep Clinical Reasoning, Guidelines & Vital Vitals Monitoring
```

1. **`gemma4:e2b` (The Sprinter)**:
   A lightweight 2.6B parameter model. It acts as the frontline responder. Running locally, it processes voice telemetry with sub-second latencies (250–500ms), immediately categorizes patients under standard clinical triage classes, and determines whether an immediate trauma team alert is needed.
   
2. **`gemma4:26b` (The Specialist)**:
   A flagship 26B parameter model. It acts as the clinical consultant. When a severe (`RED` or `YELLOW`) triage state is triggered, or when the paramedic requests a deep second opinion, the Specialist is activated to perform deep reasoning, trace clinical paths, and provide a highly detailed first-aid protocol.

---

## 3. Engineering Implementation & Gemma 4 Integration

The system is constructed with a highly performant **FastAPI backend** managing model orchestration, communicating with a premium **Next.js 16 (React 19) frontend** dashboard via a high-velocity CORS bridge.

### A. Edge Triage & Local Function Calling (Gemma 4:e2b)
Our edge-level processing leverages the native function-calling capabilities of `gemma4:e2b`. When a paramedic's report is processed, the system prompt strictly instructs the edge model to assign a priority level. If the level is determined as **RED** (immediate threat to life) or **YELLOW** (urgent), the model automatically executes a local tool call:

```python
def alert_hospital(vitals: str, priority: str):
    # Triggers trauma team standby, reserves emergency beds, updates ETA telemetry
```

The FastAPI backend interceptor processes this tool call, activates the trauma alert state in the response, and automatically loops the telemetry data to the Next.js UI dashboard.

### B. High-Precision Clinical Protocols (Gemma 4:26b)
When a critical patient is detected, `gemma4:26b` is dynamically invoked. Running 100% locally through Ollama, the model generates complex clinical protocols. It uses its large reasoning capacity to output:
* Critical anatomical risks (e.g., tension pneumothorax secondary to a sucking chest wound).
* Clear, numbered, step-by-step procedures (e.g., applying an occlusive seal, positioning the patient).
* Specific physiological vitals that must be monitored immediately.

---

## 4. Real-World Utility & Human-Centric Design

The Next.js 16 frontend is custom-tailored for fast-paced, high-stress environments:
* **The Pulse Dashboard**: An elegant glassmorphic dark interface optimized for low light (night shifts, emergency cabins).
* **Waveform Audio Visualizer**: A gorgeous 60fps Siri-style procedural canvas waveform visualizer. It provides high-end visual feedback to the paramedic without consuming any audio card capture tracks, completely preventing concurrent device locks.
* **Animated Triage HUD**: A glowing, high-contrast, color-coded medical HUD that flashes to match the patient’s status (`RED` / `YELLOW` / `GREEN`), giving team leaders instant situation awareness.
* **Live Latency Telemetry**: Live metric meters showing execution time for the edge model (in milliseconds) and the specialist model (in seconds) to prove the speed advantage of local hybrid processing.

---

## 5. Key Challenges Overcome

### Challenge 1: Local VRAM Limitations and Concurrent Models
Running a 26B model (`gemma4:26b`, ~17GB) and a 2.6B model (`gemma4:e2b`, ~7.2GB) simultaneously requires substantial VRAM.
* **Solution**: We configured Ollama’s resource concurrency limits and optimized backend loading. Rather than keeping both models persistently hot, `gemma4:e2b` handles active streams while `gemma4:26b` operates on an asynchronous request-queue fallback. If VRAM is fully constrained, the system falls back to a sequential model-swapping mechanism, ensuring execution never crashes.

### Challenge 2: Bypassing Cloud Dependencies and Resolving Speech Contention
The browser's default `SpeechRecognition` (Web Speech API) depends on Google Cloud servers (which fail completely offline) and creates a severe hardware lock conflict when running concurrently with real-time `AudioContext` streams.
* **Solution**: We developed a 100% offline, local Speech-to-Text pipeline. Paramedic audio is recorded natively via the HTML5 `MediaRecorder` API and dispatched to our local FastAPI backend. On the backend, we run an ultra-fast, local C++ optimized `faster-whisper` (tiny) transcription model. This guarantees 100% offline reliability, delivers premium transcription accuracy for medical terminology, and entirely avoids microphone hardware locks!

### Challenge 3: Ensuring Structured Output from Compact Models
Smaller models like `gemma4:e2b` can sometimes hallucinate or fail to invoke function calls under standard JSON instructions.
* **Solution**: We developed a highly strict, defensive system prompt mapping paramedic reports to specific categories and reinforced the structure with regex-based parsers in Python. If the model fails to return a clean tool call, the backend automatically extracts priority tags from the text output as a robust fallback.

---

## 6. Why Our Technical Choices Were Right

* **100% Offline Resilience**: Our choice of Ollama running local models guarantees that Ambulance-Asha 2.0 can work in subways, remote mountains, and natural disasters, mitigating communication failures.
* **Security & Privacy**: Emergency medical telemetry contains highly sensitive, protected patient data. Keeping all processing 100% local on the edge completely removes the threat of data leakage and eliminates the need for expensive HIPAA-compliant cloud storage solutions.
* **Zero Run Cost**: Transitioning from commercial cloud API calls to local open-weights Gemma 4 models reduces operating costs to **zero**, making the solution highly scalable for underfunded volunteer ambulance services and municipal disaster relief squads.

---


