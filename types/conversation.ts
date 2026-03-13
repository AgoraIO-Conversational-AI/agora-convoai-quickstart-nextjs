export interface AgoraTokenData {
  token: string;
  uid: string;
  channel: string;
  agentId?: string;
}

export interface ClientStartRequest {
  requester_id: string;
  channel_name: string;
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
