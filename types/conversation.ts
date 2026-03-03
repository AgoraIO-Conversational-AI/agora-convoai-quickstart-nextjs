export interface AgoraTokenData {
  token: string;
  uid: string;
  channel: string;
  agentId?: string;
}

export interface ClientStartRequest {
  requester_id: string;
  channel_name: string;
  rtc_codec?: number;
  input_modalities?: string[];
  output_modalities?: string[];
}

interface MicrosoftTTSParams {
  key: string;
  region: string;
  voice_name: string;
  rate?: number;
  volume?: number;
}

interface ElevenLabsTTSParams {
  key: string;
  voice_id: string;
  model_id: string;
}

export enum TTSVendor {
  Microsoft = 'microsoft',
  ElevenLabs = 'elevenlabs',
}

export interface TTSConfig {
  vendor: TTSVendor;
  params: MicrosoftTTSParams | ElevenLabsTTSParams;
}

// Agora API request body
export interface AgoraStartRequest {
  name: string;
  properties: {
    channel: string;
    token: string;
    agent_rtc_uid: string;
    remote_rtc_uids: string[];
    enable_string_uid?: boolean;
    idle_timeout?: number;
    advanced_features?: {
      enable_rtm?: boolean;
      enable_aivad?: boolean;
      enable_bhvs?: boolean;
    };
    parameters?: {
      data_channel?: string;
      enable_metrics?: boolean;
      enable_error_message?: boolean;
    };
    turn_detection?: {
      mode?: string;
      config?: {
        silence_duration_ms?: number;
        speech_duration_ms?: number;
        threshold?: number;
        prefix_padding_ms?: number;
      };
      start_of_speech?: {
        interrupt?: boolean;
        interrupt_duration_ms?: number;
      };
      end_of_speech?: Record<string, unknown>;
    };
    asr: {
      language: string;
      task?: string;
      vendor?: string;
      params?: {
        api_key?: string;
        language_hints?: string[];
      };
    };
    llm: {
      url?: string;
      api_key?: string;
      system_messages: Array<{
        role: string;
        content: string;
      }>;
      greeting_message: string;
      failure_message: string;
      max_history?: number;
      input_modalities?: string[];
      output_modalities?: string[];
      params: {
        model: string;
        max_tokens: number;
        temperature?: number;
        top_p?: number;
        // tools?: Array<{ type: string }>;
      };
    };
    vad: {
      silence_duration_ms: number;
      speech_duration_ms?: number;
      threshold?: number;
      interrupt_duration_ms?: number;
      prefix_padding_ms?: number;
    };
    tts: TTSConfig;
  };
}

export interface StopConversationRequest {
  agent_id: string;
}

export interface AgentResponse {
  agent_id: string;
  create_ts: number;
  state: string;
}

export interface ConversationComponentProps {
  agoraData: AgoraTokenData;
  onTokenWillExpire: (uid: string) => Promise<string>;
  onEndConversation: () => void;
}
