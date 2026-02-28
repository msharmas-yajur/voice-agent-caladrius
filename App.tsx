import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Activity, 
  Cpu, 
  MessageSquare, 
  Globe2, 
  FileText,
  Stethoscope,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { LiveClient } from './services/liveClient';
import { ConnectionState, ChatMessage, VoiceMode } from './types';
import { Visualizer } from './components/Visualizer';
import { IntegrationBadge } from './components/IntegrationBadge';
import { AGENT_NAME } from './services/knowledgeBase';

// Helper to format time
const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('english');
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(0));
  const [error, setError] = useState<string | null>(null);
  
  const clientRef = useRef<LiveClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleToggleConnection = async () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      clientRef.current?.disconnect();
      return;
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setError("API Key not found in environment.");
      return;
    }

    setError(null);
    clientRef.current = new LiveClient(apiKey, {
      onStateChange: setConnectionState,
      onAudioData: (data) => setAudioData(new Uint8Array(data)), // Clone to trigger re-render
      onTranscript: (text, isUser) => {
        setMessages(prev => {
           const newRole = isUser ? 'user' : 'assistant';
           const lastMsg = prev[prev.length - 1];
           
           // If the last message exists and is from the same role, append text
           // This handles the streaming nature of the API where text comes in chunks
           if (lastMsg && lastMsg.role === newRole) {
             const updatedMessages = [...prev];
             updatedMessages[updatedMessages.length - 1] = {
               ...lastMsg,
               text: lastMsg.text + text
             };
             return updatedMessages;
           }
           
           // Otherwise, start a new message bubble
           return [...prev, {
             id: Date.now().toString(),
             role: newRole,
             text: text,
             timestamp: new Date()
           }];
        });
      },
      onError: (err) => setError(err),
    });

    await clientRef.current.connect(voiceMode);
  };

  const handleVoiceModeToggle = () => {
    // We only allow toggling when disconnected to keep the session config simple for this demo
    if (connectionState === ConnectionState.DISCONNECTED) {
      setVoiceMode(prev => prev === 'english' ? 'hindi_mixed' : 'english');
    }
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;

  // Derive system status from state
  const getSystemStatus = () => {
    if (error) return { text: 'System Error', color: 'text-red-400', bg: 'bg-red-500' };
    if (isConnected) return { text: 'RCM Agent Active', color: 'text-cyan-400', bg: 'bg-cyan-500' };
    if (connectionState === ConnectionState.CONNECTING) return { text: 'Connecting', color: 'text-yellow-400', bg: 'bg-yellow-500' };
    return { text: 'Standby', color: 'text-slate-400', bg: 'bg-slate-500' };
  };

  const status = getSystemStatus();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center p-6 relative overflow-hidden font-sans">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px]" />
      </div>

      <div className="z-10 w-full max-w-6xl flex flex-col gap-6">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-600 p-2.5 rounded-lg shadow-lg shadow-cyan-900/30">
               <Activity className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Caladrius <span className="text-cyan-400">Copilot</span></h1>
              <p className="text-slate-400 text-sm">Revenue Cycle Management (RCM) Voice Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Status</span>
                <span className={`flex items-center gap-2 text-sm font-medium ${status.color}`}>
                  <span className="relative flex h-2 w-2">
                    {isConnected && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${status.bg} opacity-75`}></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${status.bg}`}></span>
                  </span>
                  {status.text}
                </span>
             </div>
          </div>
        </header>

        {/* Integration Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <IntegrationBadge 
            name="Coding Guidelines" 
            description="ICD-10-CM & CPT Standard Reference."
            icon={FileText}
            isActive={isConnected}
            colorClass="cyan"
          />
          <IntegrationBadge 
            name="Payer Rules" 
            description="LCD/NCD & Denial Management Logic."
            icon={ShieldCheck}
            isActive={isConnected}
            colorClass="blue"
          />
          <IntegrationBadge 
            name="Global Support" 
            description="Multi-lingual Medical Terminology."
            icon={Globe2}
            isActive={isConnected && voiceMode === 'hindi_mixed'}
            colorClass="emerald"
          />
        </div>

        {/* Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          
          {/* Left: Visualization & Controls */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Control Card */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center flex-1 shadow-xl backdrop-blur-sm relative overflow-hidden">
              
              <div className="w-full mb-6 z-10">
                <Visualizer active={isConnected} audioData={audioData} />
              </div>
              
              <div className="flex flex-col items-center gap-4 w-full z-10">
                 <button 
                  onClick={handleToggleConnection}
                  disabled={connectionState === ConnectionState.CONNECTING}
                  className={`
                    w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300
                    ${isConnected 
                      ? 'bg-red-500 hover:bg-red-600 shadow-red-900/50' 
                      : error 
                        ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/50 ring-2 ring-red-500 ring-offset-2 ring-offset-slate-900'
                        : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/50 animate-pulse-slow'}
                  `}
                >
                  {connectionState === ConnectionState.CONNECTING ? (
                    <Activity className="animate-spin text-white" />
                  ) : isConnected ? (
                    <MicOff className="text-white" size={32} />
                  ) : (
                    <Mic className="text-white" size={32} />
                  )}
                </button>
                
                <div className="text-center">
                  <h3 className="text-lg font-medium text-white">
                    {isConnected ? 'Consulting ' + AGENT_NAME : 'Start Session'}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {isConnected ? 'Analyzing audio...' : 'Connect to process claims & documentation'}
                  </p>
                </div>

                {error && (
                  <div className="mt-2 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-200 text-xs text-center flex items-center gap-2 max-w-[250px] animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={16} className="shrink-0 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Config Card */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                 <Cpu size={16} /> Language Mode
               </h3>
               
               <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <Globe2 className={`text-${voiceMode === 'hindi_mixed' ? 'emerald' : 'slate'}-400`} size={20} />
                    <div>
                      <div className="text-sm font-medium text-slate-200">Standard English</div>
                      <div className="text-xs text-slate-500">{voiceMode === 'hindi_mixed' ? '+ Hindi Support' : 'US Medical'}</div>
                    </div>
                  </div>
                  <button 
                    onClick={handleVoiceModeToggle}
                    disabled={isConnected} // Lock config while active for stability in this demo
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${voiceMode === 'hindi_mixed' ? 'bg-emerald-600' : 'bg-slate-600'}
                      ${isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <span 
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${voiceMode === 'hindi_mixed' ? 'translate-x-6' : 'translate-x-1'}
                      `} 
                    />
                  </button>
               </div>
            </div>
          </div>

          {/* Right: Transcript / Agent Output */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col shadow-xl overflow-hidden backdrop-blur-md">
            <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex justify-between items-center">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <MessageSquare size={18} className="text-cyan-400" />
                Live Transcript
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Powered by Gemini Live
              </span>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                  <Stethoscope size={48} className="opacity-20" />
                  <p className="text-center max-w-sm">
                    Welcome to the Caladrius RCM Copilot. <br/>
                    Discuss coding guidelines, denials, or clinical documentation.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`
                      max-w-[80%] rounded-2xl p-4 
                      ${msg.role === 'user' 
                        ? 'bg-cyan-600 text-white rounded-br-none' 
                        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'}
                    `}>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                      <div className={`text-[10px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-cyan-200' : 'text-slate-400'}`}>
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Context Awareness Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 font-mono flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                  RCM_DATABASE_ACTIVE
               </div>
               <div>
                  SESSION_ID: {Math.random().toString(36).substring(7).toUpperCase()}
               </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}