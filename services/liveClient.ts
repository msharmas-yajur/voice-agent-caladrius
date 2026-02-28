import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from './audioUtils';
import { ConnectionState, VoiceMode } from '../types';
import { CALADRIUS_SYSTEM_INSTRUCTION } from './knowledgeBase';

interface LiveClientCallbacks {
  onStateChange: (state: ConnectionState) => void;
  onAudioData: (frequencyData: Uint8Array) => void; // For visualization
  onTranscript: (text: string, isUser: boolean) => void;
  onError: (error: string) => void;
}

export class LiveClient {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private analyser: AnalyserNode | null = null;
  
  constructor(apiKey: string, private callbacks: LiveClientCallbacks) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async connect(voiceMode: VoiceMode) {
    this.callbacks.onStateChange(ConnectionState.CONNECTING);

    try {
      // 1. Verify Browser Support & Secure Context
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!window.isSecureContext) {
           throw new Error("Microphone access requires a secure context (HTTPS) or localhost.");
        }
        throw new Error("Your browser does not support audio input. Please use a modern browser.");
      }

      // 2. Request Microphone Access
      try {
        // RELAXED CONSTRAINTS for broader device support
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true 
        });
      } catch (e: any) {
        console.error("Microphone access failed:", e);
        if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError' || e.message?.includes('device not found')) {
            throw new Error("No microphone found. Please connect a microphone and try again.");
        }
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            throw new Error("Microphone permission denied. Please allow access in your browser settings.");
        }
        throw new Error(`Microphone error: ${e.message}`);
      }

      // 3. Initialize Audio Contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Setup Analyser for visualization
      this.analyser = this.outputAudioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.outputAudioContext.destination);

      // Dynamically Select Language Instructions
      const languageInstruction = voiceMode === 'hindi_mixed' 
        ? `
- **Language**: You are bilingual. Speak in a mix of Hindi and English.
- **Context**: Use English for all Medical Terminology (ICD codes, Anatomy, Procedure names). Use Hindi for conversational fillers or explaining simple concepts to staff who might prefer it.
- **Example**: "Sairam! Is patient ka diagnosis code J18.9 unspecified pneumonia hai, humein aur specificity chahiye."`
        : "- **Language**: Speak in professional US English.";

      const systemInstruction = CALADRIUS_SYSTEM_INSTRUCTION + "\n" + languageInstruction;

      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleMessage.bind(this),
          onclose: this.handleClose.bind(this),
          onerror: this.handleError.bind(this),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            // Using 'Kore' for a balanced, professional, yet calming voice suitable for medical environments
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: systemInstruction,
          inputAudioTranscription: {}, // Request transcription for user
          outputAudioTranscription: {}, // Request transcription for model
        },
      });
      
    } catch (error: any) {
      console.error("Connection failed", error);
      let msg = error.message || "Failed to connect";
      
      // Specific Error Mapping
      if (msg.includes("503") || msg.toLowerCase().includes("unavailable")) {
          msg = "Service unavailable (503). The server is temporarily overloaded. Please try again in a few moments.";
      } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
          msg = "Network error. Please check your internet connection.";
      }
      
      this.callbacks.onError(msg);
      this.callbacks.onStateChange(ConnectionState.ERROR);
      // Ensure we clean up if we partially initialized
      this.disconnect();
    }
  }

  private handleOpen() {
    this.callbacks.onStateChange(ConnectionState.CONNECTED);
    this.startAudioInput();
  }

  private startAudioInput() {
    if (!this.inputAudioContext || !this.mediaStream) return;

    this.source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      // Only proceed if session exists and is connected
      if (!this.sessionPromise) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      this.sessionPromise.then((session) => {
        if (session) {
          session.sendRealtimeInput({ media: pcmBlob });
        }
      }).catch((err) => {
         // Silently ignore send errors during connection teardown to prevent log spam
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Transcriptions
    if (message.serverContent?.inputTranscription?.text) {
        this.callbacks.onTranscript(message.serverContent.inputTranscription.text, true);
    }
    if (message.serverContent?.outputTranscription?.text) {
        this.callbacks.onTranscript(message.serverContent.outputTranscription.text, false);
    }

    // Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      try {
        const audioData = base64ToUint8Array(base64Audio);
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        const audioBuffer = await decodeAudioData(
          audioData,
          this.outputAudioContext,
          24000, 
          1
        );

        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect to analyser for visualization AND destination for hearing
        if (this.analyser) {
            source.connect(this.analyser);
        } else {
            source.connect(this.outputAudioContext.destination);
        }

        source.addEventListener('ended', () => {
          this.sources.delete(source);
        });

        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);

        // Trigger visualization update
        if (this.analyser) {
            this.visualize();
        }

      } catch (e) {
        console.error("Error decoding/playing audio", e);
      }
    }

    // Handle Interruption
    if (message.serverContent?.interrupted) {
      this.sources.forEach(s => s.stop());
      this.sources.clear();
      this.nextStartTime = 0;
    }
  }

  private visualize() {
     if (!this.analyser) return;
     const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
     this.analyser.getByteFrequencyData(dataArray);
     this.callbacks.onAudioData(dataArray);
     requestAnimationFrame(() => {
        // Only loop if connected - handled by component generally, 
        // but here we just emit one frame of data when audio plays
     });
  }

  private handleClose(e: CloseEvent) {
    console.log("Session closed", e);
    this.disconnect();
  }

  private handleError(e: any) {
    console.error("Session error", e);
    
    let errorMsg = "An error occurred with the voice connection.";
    
    if (e instanceof ErrorEvent) {
        // WebSocket error events often have empty messages due to security
        errorMsg = e.message || "Connection to the service was lost.";
    } else if (e instanceof Error) {
        errorMsg = e.message;
    } else if (typeof e === 'string') {
        errorMsg = e;
    }

    const lowerMsg = errorMsg.toLowerCase();
    if (lowerMsg.includes("503") || lowerMsg.includes("unavailable")) {
        errorMsg = "Service unavailable. Please try again shortly.";
    } else if (lowerMsg.includes("network") || lowerMsg.includes("fetch")) {
        errorMsg = "Network error. Please check your internet connection.";
    }

    this.callbacks.onError(errorMsg);
    this.disconnect();
  }

  public disconnect() {
    this.callbacks.onStateChange(ConnectionState.DISCONNECTED);
    
    // Stop tracks
    this.mediaStream?.getTracks().forEach(t => t.stop());
    
    // Disconnect nodes
    this.source?.disconnect();
    this.processor?.disconnect();
    this.analyser?.disconnect();
    
    // Close contexts
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    
    // Stop all playing sources
    this.sources.forEach(s => s.stop());
    this.sources.clear();

    this.sessionPromise = null;
    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.processor = null;
    this.source = null;
    this.mediaStream = null;
  }
}