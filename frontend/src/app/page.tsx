'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  AlertCircle, 
  Stethoscope, 
  ShieldAlert, 
  ChevronRight, 
  Mic, 
  Zap, 
  BrainCircuit,
  BellRing,
  HeartPulse
} from 'lucide-react';

interface TriageResponse {
  status: string;
  response: string;
  hospital_alerted: boolean;
  alert_details?: {
    vitals: string;
    priority: string;
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [key: number]: {
      isFinal: boolean;
      [key: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export default function AmbulanceAshaDashboard() {
  const [voiceInput, setVoiceInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResponse | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState<string | null>(null);
  const [isAnalyzingDeep, setIsAnalyzingDeep] = useState(false);
  const [transcript, setTranscript] = useState<{role: 'paramedic' | 'asha', text: string}[]>([]);
  const [metrics, setMetrics] = useState<{e2bTime?: number, b26Time?: number}>({});
  
  // Voice Recording and Speech-to-Text States
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechSupported] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !!window.MediaRecorder;
    }
    return true;
  });
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  
  // Microphone Selection States
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  // MediaRecorder Refs for Offline Audio Transcription
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Helper to fetch and update lists of microphones
  const updateDevices = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter(device => device.kind === 'audioinput');
        setDevices(audioInputs);
        
        // If there's no selected device but we found some, default to the first one or 'default'
        if (audioInputs.length > 0) {
          const hasDefault = audioInputs.some(d => d.deviceId === 'default');
          if (hasDefault) {
            setSelectedDeviceId(prev => prev || 'default');
          } else {
            setSelectedDeviceId(prev => prev || audioInputs[0].deviceId);
          }
        }
      } catch (err) {
        console.error('Error enumerating audio devices:', err);
      }
    }
  }, []);

  // Load available microphone devices on mount
  useEffect(() => {
    updateDevices();
    
    // Also listen for device changes (e.g. user plugs/unplugs a mic)
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      const handleDeviceChange = () => {
        updateDevices();
      };
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [updateDevices]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    
    // Stop MediaRecorder if running
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop stream tracks to turn off the microphone light
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // Stop audio visualizer animation loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const drawVisualizer = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    let phase = 0;

    const draw = () => {
      if (!isRecordingRef.current) return;
      animationFrameRef.current = requestAnimationFrame(draw);

      ctx.clearRect(0, 0, width, height);

      // Draw a beautiful Siri-like glowing waveform
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';

      const waves = [
        { amplitude: 12, frequency: 0.02, speed: 0.08, color: 'rgba(239, 68, 68, 0.7)' },
        { amplitude: 8, frequency: 0.035, speed: -0.06, color: 'rgba(239, 68, 68, 0.35)' },
        { amplitude: 4, frequency: 0.015, speed: 0.04, color: 'rgba(239, 68, 68, 0.15)' }
      ];

      waves.forEach(wave => {
        ctx.lineWidth = wave.amplitude === 12 ? 2.5 : 1.2;
        ctx.strokeStyle = wave.color;
        ctx.beginPath();

        for (let x = 0; x < width; x++) {
          const envelope = Math.sin((x / width) * Math.PI);
          const y = Math.sin(x * wave.frequency + phase * wave.speed) * wave.amplitude * envelope + (height / 2);

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      phase += 1;
    };

    draw();
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;

    isRecordingRef.current = true;
    setIsRecording(true);
    setRecognitionError(null);

    try {
      // 1. Request microphone access
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId && selectedDeviceId !== 'default' 
          ? { deviceId: { exact: selectedDeviceId } } 
          : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Update devices list now that permission is granted (to get labels)
      updateDevices();

      // If stopRecording was called while waiting for getUserMedia, clean up and exit
      if (!isRecordingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      // 2. Start MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        
        setIsProcessing(true);
        setVoiceInput('Transcribing offline voice report...');
        
        try {
          const response = await fetch('http://127.0.0.1:8000/transcribe', {
            method: 'POST',
            body: formData
          });
          const data = await response.json();
          if (data.status === 'success') {
            setVoiceInput(data.text);
          } else {
            setRecognitionError(`Offline STT failed: ${data.message}`);
            setVoiceInput('');
          }
        } catch (err) {
          console.error('Offline STT error:', err);
          setRecognitionError('Failed to connect to offline transcription server.');
          setVoiceInput('');
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();

      // 3. Start Siri-like procedural visualizer
      requestAnimationFrame(() => drawVisualizer());

    } catch (err) {
      console.error('Failed to get microphone:', err);
      setRecognitionError('Microphone access denied or not found.');
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [selectedDeviceId, drawVisualizer, updateDevices]);

  const toggleRecording = useCallback(() => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  // Initialize Speech Recognition on mount safely for SSR
  useEffect(() => {
    let rec: SpeechRecognitionInstance | null = null;
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as unknown as WindowWithSpeech).SpeechRecognition || 
                                (window as unknown as WindowWithSpeech).webkitSpeechRecognition;
      if (SpeechRecognition) {
        rec = new SpeechRecognition() as unknown as SpeechRecognitionInstance;
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onstart = () => {
          isRecordingRef.current = true;
          setIsRecording(true);
          setRecognitionError(null);
        };

        rec.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            finalTranscript += event.results[i][0].transcript;
          }
          if (finalTranscript.trim()) {
            setVoiceInput(finalTranscript);
          }
        };

        rec.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setRecognitionError('Microphone permission denied.');
          } else if (event.error === 'no-speech') {
            // No-speech can be ignored to avoid interrupting the user
          } else {
            setRecognitionError(`Speech recognition error: ${event.error}`);
          }
          stopRecording();
        };

        rec.onend = () => {
          isRecordingRef.current = false;
          setIsRecording(false);
        };

        recognitionRef.current = rec;
      }
    }

    return () => {
      if (rec) {
        rec.abort();
      }
    };
  }, [stopRecording]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const runDeepAnalysis = useCallback(async (forcedInput?: string) => {
    const lastParamedicInput = forcedInput || transcript.filter(t => t.role === 'paramedic').slice(-1)[0]?.text;
    if (!lastParamedicInput) return;
    
    const startTime = performance.now();
    setIsAnalyzingDeep(true);
    setDeepAnalysis(null);
    
    try {
      const response = await fetch('http://127.0.0.1:8000/deep-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          voice_input: lastParamedicInput,
          history: transcript 
        }),
      });
      const data = await response.json();
      const endTime = performance.now();
      
      setMetrics(prev => ({ ...prev, b26Time: Math.round(endTime - startTime) }));
      setDeepAnalysis(data.analysis);
    } catch (error) {
      console.error('Deep analysis failed:', error);
    } finally {
      setIsAnalyzingDeep(false);
    }
  }, [transcript]);

  const runTriage = useCallback(async () => {
    if (!voiceInput.trim()) return;
    
    const startTime = performance.now();
    setIsProcessing(true);
    setTranscript(prev => [...prev, {role: 'paramedic', text: voiceInput}]);
    
    try {
      const response = await fetch('http://127.0.0.1:8000/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          voice_input: voiceInput,
          history: transcript 
        }),
      });
      const data = await response.json();
      const endTime = performance.now();
      
      setMetrics(prev => ({ ...prev, e2bTime: Math.round(endTime - startTime) }));
      setTriageResult(data);
      setTranscript(prev => [...prev, {role: 'asha', text: data.response}]);

      // Auto-trigger Deep Analysis for critical cases (RED/YELLOW)
      if (data.alert_details?.priority === 'RED' || data.alert_details?.priority === 'YELLOW') {
        runDeepAnalysis(voiceInput); // Pass the current input directly
      }
    } catch (error) {
      console.error('Triage failed:', error);
    } finally {
      setIsProcessing(false);
      setVoiceInput('');
    }
  }, [voiceInput, transcript, runDeepAnalysis]);

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toUpperCase()) {
      case 'RED': return 'text-red-500 border-red-500/50 bg-red-500/10';
      case 'YELLOW': return 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10';
      case 'GREEN': return 'text-green-500 border-green-500/50 bg-green-500/10';
      default: return 'text-blue-500 border-blue-500/50 bg-blue-500/10';
    }
  };

  return (
    <main className="min-h-screen p-6 md:p-12 lg:p-16 flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-xl">
            <HeartPulse className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ambulance-Asha <span className="text-red-500">2.0</span></h1>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Hybrid-Edge Triage System (Gemma 4)
            </p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-4">
          <div className="glass px-4 py-2 rounded-xl flex flex-col gap-1 min-w-[120px]">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
              <Zap className="w-3 h-3 text-yellow-500" />
              Edge (e2b)
            </div>
            <div className="text-sm font-mono font-bold">
              {metrics.e2bTime ? `${metrics.e2bTime}ms` : '--'}
            </div>
          </div>
          <div className="glass px-4 py-2 rounded-xl flex flex-col gap-1 min-w-[120px]">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
              <BrainCircuit className="w-3 h-3 text-blue-500" />
              Specialist (26b)
            </div>
            <div className="text-sm font-mono font-bold">
              {isAnalyzingDeep ? (
                <span className="text-blue-500 animate-pulse">ANALYZING...</span>
              ) : metrics.b26Time ? (
                `${(metrics.b26Time/1000).toFixed(1)}s`
              ) : '--'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[70vh]">
        
        {/* Left: Live Transcript & Input */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          <div className="glass rounded-3xl p-6 flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Mic className="w-4 h-4 text-red-500" />
                Live Incident Feed
              </h2>
              <span className="text-[10px] uppercase tracking-widest text-slate-500">Encrypted Channel 04</span>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 space-y-4">
              {transcript.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3 opacity-50">
                  <Activity className="w-12 h-12" />
                  <p>Awaiting paramedic voice input...</p>
                </div>
              )}
              {transcript.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i} 
                  className={`flex flex-col ${msg.role === 'paramedic' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-slate-500 mb-1 px-2">
                    {msg.role === 'paramedic' ? 'FIELD PARAMEDIC' : 'ASHA AI'}
                  </span>
                  <div className={`px-4 py-2 rounded-2xl max-w-[85%] ${
                    msg.role === 'paramedic' 
                    ? 'bg-blue-600/20 border border-blue-500/30' 
                    : 'bg-white/5 border border-white/10'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              {isProcessing && (
                <div className="flex gap-2 p-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" />
                </div>
              )}
            </div>
          </div>

          {/* Input Bar */}
          <div className="relative flex flex-col gap-2">
            <div className={`relative group w-full transition-all duration-300 rounded-2xl ${
              isRecording 
                ? 'ring-2 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                : ''
            }`}>
              {/* Audio Waveform Canvas Layer */}
              {isRecording && (
                <canvas 
                  ref={canvasRef} 
                  className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none opacity-40 mix-blend-screen"
                  width={600}
                  height={60}
                />
              )}
              
              <input 
                type="text"
                value={voiceInput}
                onChange={(e) => setVoiceInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runTriage()}
                disabled={isProcessing}
                placeholder={
                  isRecording 
                    ? "Listening... Speak clearly into your mic..." 
                    : "Simulate voice input or click mic to record (e.g., 'Patient has severe chest pain...')"
                }
                className={`w-full glass rounded-2xl py-4 pl-6 pr-28 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all ${
                  isRecording ? 'text-red-400 placeholder-red-500/40 bg-red-950/10 border-red-500/20' : ''
                }`}
              />
              
              {/* Mic Control Button */}
              <button 
                type="button"
                onClick={toggleRecording}
                disabled={isProcessing || !isSpeechSupported}
                className={`absolute right-14 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all duration-300 ${
                  !isSpeechSupported 
                    ? 'opacity-35 cursor-not-allowed text-slate-600'
                    : isRecording 
                      ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50' 
                      : 'text-slate-400 hover:text-red-500 hover:bg-white/5'
                }`}
                title={
                  !isSpeechSupported 
                    ? "Speech recognition not supported in this browser" 
                    : isRecording 
                      ? "Stop recording voice" 
                      : "Record paramedic voice input"
                }
              >
                <Mic className="w-5 h-5" />
              </button>

              {/* Send Button */}
              <button 
                onClick={runTriage}
                disabled={isProcessing || !voiceInput.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl transition-colors"
                title="Send telemetry report"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            {/* Status & Error Helper */}
            <div className="flex flex-col gap-2 px-2">
              {recognitionError && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-xs flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{recognitionError}</span>
                </motion.div>
              )}
              
              <div className="flex items-center justify-between gap-4 text-xs">
                {isRecording ? (
                  <div className="flex items-center gap-2 text-[10px] text-red-500 uppercase tracking-widest font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    Live Transcription Active
                  </div>
                ) : (
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest">
                    Awaiting paramedic report...
                  </div>
                )}

                {/* Microphone selector dropdown */}
                {isSpeechSupported && devices.length > 0 && (
                  <div className="flex items-center gap-2 text-slate-400 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 transition-all hover:bg-white/10">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Input Mic:</span>
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      disabled={isRecording}
                      className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer max-w-[180px] truncate"
                    >
                      {devices.map((device, idx) => (
                        <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-slate-200">
                          {device.label || `Microphone ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right: AI Analysis & HUD */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Triage Status HUD */}
          <AnimatePresence mode="wait">
            {triageResult ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`glass border-2 rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-4 ${getPriorityColor(triageResult.alert_details?.priority)}`}
              >
                <div className="relative">
                  <ShieldAlert className="w-16 h-16" />
                  {triageResult.hospital_alerted && (
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute -top-2 -right-2 p-2 bg-red-600 rounded-full shadow-lg shadow-red-600/50"
                    >
                      <BellRing className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest opacity-70">Assigned Priority</h3>
                  <p className="text-5xl font-black">{triageResult.alert_details?.priority || 'CALCULATING'}</p>
                </div>
                {triageResult.hospital_alerted && (
                  <div className="px-4 py-2 rounded-full bg-white/10 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    HOSPITAL NOTIFIED & TRAUMA TEAM STANDBY
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="glass rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-4 border-dashed border-white/10">
                <Stethoscope className="w-12 h-12 text-slate-600" />
                <p className="text-slate-500 text-sm italic">Waiting for triage data to populate HUD</p>
              </div>
            )}
          </AnimatePresence>

          {/* Deep Insight Panel */}
          <div className="glass rounded-3xl p-6 flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-blue-500" />
                Specialist Protocol (26B)
              </h3>
              <button 
                onClick={() => runDeepAnalysis()}
                disabled={isAnalyzingDeep || transcript.length === 0}
                className="text-[10px] font-bold bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30"
              >
                {isAnalyzingDeep ? 'PROCESSING...' : 'REQUEST PROTOCOL'}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto text-sm text-slate-300 pr-2">
              {isAnalyzingDeep ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 py-12">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <BrainCircuit className="w-6 h-6 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="text-center">
                    <p className="text-blue-400 font-bold animate-pulse">Gemma 4:26B is Reasoning...</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Deep Medical Protocol Generation</p>
                  </div>
                </div>
              ) : deepAnalysis ? (
                <div className="prose prose-invert prose-sm">
                  {deepAnalysis.split('\n').map((line, i) => (
                    <p key={i} className={line.startsWith('#') ? 'font-bold text-white mt-4' : 'mb-2'}>
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 italic">
                  <p>Specialist (26B) is monitoring critical cases and will provide protocols automatically.</p>
                </div>
              )}
            </div>
          </div>

        </section>
      </div>

      {/* Footer Branding */}
      <footer className="mt-auto flex items-center justify-center gap-8 text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]">
        <span>Google Gemma Hackathon 2026</span>
        <span className="w-1 h-1 rounded-full bg-slate-800" />
        <span>Built for Edge Reliability</span>
        <span className="w-1 h-1 rounded-full bg-slate-800" />
        <span>Hybrid Intelligence Architecture</span>
      </footer>
    </main>
  );
}
