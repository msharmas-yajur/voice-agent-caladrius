export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface IntegrationStatus {
  id: string;
  name: string;
  description: string;
  active: boolean;
  color: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
}

export type VoiceMode = 'english' | 'hindi_mixed';