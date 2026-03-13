'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AgoraRTC from 'agora-rtc-react';
import AgoraRTM from 'agora-rtm';
import {
  useRTCClient,
  useLocalMicrophoneTrack,
  useRemoteUsers,
  useClientEvent,
  useIsConnected,
  useJoin,
  usePublish,
  RemoteUser,
  UID,
} from 'agora-rtc-react';
import { MicrophoneButton } from './MicrophoneButton';
import { MicrophoneSelector } from './MicrophoneSelector';
import { AudioVisualizer } from './AudioVisualizer';
import type {
  ConversationComponentProps,
  ClientStartRequest,
} from '@/types/conversation';
import ConvoTextStream from './ConvoTextStream';
import {
  AgoraVoiceAI,
  AgoraVoiceAIEvents,
  TranscriptHelperMode,
  TurnStatus,
  type TranscriptHelperItem,
  type UserTranscription,
  type AgentTranscription,
} from 'agora-agent-client-toolkit';

type MessageItem = TranscriptHelperItem<Partial<UserTranscription | AgentTranscription>>;

export default function ConversationComponent({
  agoraData,
  onTokenWillExpire,
  onEndConversation,
}: ConversationComponentProps) {
  const client = useRTCClient();
  const isConnected = useIsConnected();
  const remoteUsers = useRemoteUsers();
  const [isEnabled, setIsEnabled] = useState(true);
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(isEnabled);
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const agentUID = process.env.NEXT_PUBLIC_AGENT_UID;
  const [activeAgentId, setActiveAgentId] = useState<string | undefined>(agoraData.agentId);
  const [joinedUID, setJoinedUID] = useState<UID>(0);
  const [messageList, setMessageList] = useState<MessageItem[]>([]);
  const [currentInProgressMessage, setCurrentInProgressMessage] = useState<MessageItem | null>(null);

  const rtmClientRef = useRef<any>(null);
  const conversationalAPIRef = useRef<AgoraVoiceAI | null>(null);

  // Check if agent UID is properly set
  useEffect(() => {
    if (!agentUID) {
      console.warn('NEXT_AGENT_UID environment variable is not set');
    } else {
      console.log('Agent UID is set to:', agentUID);
    }
  }, [agentUID]);

  // Join the channel using the useJoin hook
  const { isConnected: joinSuccess } = useJoin(
    {
      appid: process.env.NEXT_PUBLIC_AGORA_APP_ID!,
      channel: agoraData.channel,
      token: agoraData.token,
      uid: parseInt(agoraData.uid, 10) || 0,
    },
    true
  );

  // Enable audio PTS metadata for timing synchronization
  useEffect(() => {
    if (client) {
      try {
        // Access AgoraRTC from the client's constructor if available
        const rtcConstructor = (client as any).constructor?.AgoraRTC || AgoraRTC;
        if (rtcConstructor && typeof rtcConstructor.setParameter === 'function') {
          rtcConstructor.setParameter('ENABLE_AUDIO_PTS_METADATA', true);
          console.log('Enabled audio PTS metadata for timing synchronization');
        }
      } catch (error) {
        console.warn('Could not enable audio PTS metadata:', error);
      }
    }
  }, [client]);

  // Initialize RTM and ConversationalAIAPI when client is ready and connected
  useEffect(() => {
    if (!client || !isConnected || !agoraData.token) return;

    const initializeRTMAndAPI = async () => {
      try {
        // Clean up existing instances
        if (conversationalAPIRef.current) {
          console.log('Cleaning up existing AgoraVoiceAI instance');
          try {
            conversationalAPIRef.current.destroy();
          } catch (err) {
            console.error('Error cleaning up AgoraVoiceAI:', err);
          }
          conversationalAPIRef.current = null;
        }

        if (rtmClientRef.current) {
          console.log('Cleaning up existing RTM client');
          try {
            await rtmClientRef.current.logout();
          } catch (err) {
            console.error('Error logging out RTM:', err);
          }
          rtmClientRef.current = null;
        }

        // Create RTM client
        console.log('Creating RTM client...');
        const rtmClient = new AgoraRTM.RTM(
          process.env.NEXT_PUBLIC_AGORA_APP_ID!,
          agoraData.uid
        );
        rtmClientRef.current = rtmClient;

        // Login to RTM with the same token
        console.log('Logging in to RTM with UID:', agoraData.uid);
        await rtmClient.login({
          token: agoraData.token,
        });
        console.log('RTM login successful');

        // Subscribe to the channel
        console.log('Subscribing to RTM channel:', agoraData.channel);
        await rtmClient.subscribe(agoraData.channel);
        console.log('RTM channel subscription successful');

        // Initialize AgoraVoiceAI
        console.log('Initializing AgoraVoiceAI...');
        const api = await AgoraVoiceAI.init({
          rtcEngine: client as any,
          rtmConfig: { rtmEngine: rtmClient as any },
          renderMode: TranscriptHelperMode.TEXT,
          enableLog: true,
        });
        conversationalAPIRef.current = api;

        // Subscribe to events
        api.on(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, (transcript) => {
          console.log('Transcript updated:', transcript);
          setMessageList(transcript.filter((m) => m.status === TurnStatus.END));
          setCurrentInProgressMessage(
            transcript.find((m) => m.status === TurnStatus.IN_PROGRESS) ?? null
          );
        });

        api.on(AgoraVoiceAIEvents.AGENT_STATE_CHANGED, (agentUserId, event) => {
          console.log(`Agent ${agentUserId} state changed:`, event);
        });

        api.on(AgoraVoiceAIEvents.AGENT_ERROR, (agentUserId, error) => {
          console.error(`Agent ${agentUserId} error:`, error);
        });

        api.on(AgoraVoiceAIEvents.AGENT_METRICS, (agentUserId, metrics) => {
          console.log(`Agent ${agentUserId} metrics:`, metrics);
        });

        // Subscribe to messages
        api.subscribeMessage(agoraData.channel);
        console.log('AgoraVoiceAI initialized and subscribed');
      } catch (error) {
        console.error('Failed to initialize RTM and AgoraVoiceAI:', error);
      }
    };

    initializeRTMAndAPI();

    // Cleanup on unmount or state change
    return () => {
      if (conversationalAPIRef.current) {
        console.log('Cleaning up AgoraVoiceAI on unmount');
        try {
          conversationalAPIRef.current.destroy();
        } catch (err) {
          console.error('Error cleaning up AgoraVoiceAI:', err);
        }
        conversationalAPIRef.current = null;
      }

      if (rtmClientRef.current) {
        console.log('Cleaning up RTM client on unmount');
        rtmClientRef.current
          .logout()
          .catch((err: any) => console.error('Error logging out RTM:', err));
        rtmClientRef.current = null;
      }
    };
  }, [client, isConnected, agoraData.token, agoraData.channel, agoraData.uid]);

  // Update actualUID when join is successful
  useEffect(() => {
    if (joinSuccess && client) {
      const uid = client.uid;
      setJoinedUID(uid as UID);
      console.log('Join successful, using UID:', uid);
    }
  }, [joinSuccess, client]);

  // Publish local microphone track
  usePublish([localMicrophoneTrack]);

  // Ensure local track is enabled for testing
  useEffect(() => {
    if (localMicrophoneTrack) {
      localMicrophoneTrack.setEnabled(true);
    }
  }, [localMicrophoneTrack]);

  // Handle remote user events
  useClientEvent(client, 'user-joined', (user) => {
    console.log('Remote user joined:', user.uid);
    if (user.uid.toString() === agentUID) {
      setIsAgentConnected(true);
      setIsConnecting(false);
    }
  });

  useClientEvent(client, 'user-left', (user) => {
    console.log('Remote user left:', user.uid);
    if (user.uid.toString() === agentUID) {
      setIsAgentConnected(false);
      setIsConnecting(false);
    }
  });

  // Sync isAgentConnected with remoteUsers
  useEffect(() => {
    const isAgentInRemoteUsers = remoteUsers.some(
      (user) => user.uid.toString() === agentUID
    );
    setIsAgentConnected(isAgentInRemoteUsers);
  }, [remoteUsers, agentUID]);

  // Connection state changes
  useClientEvent(client, 'connection-state-change', (curState, prevState) => {
    console.log(`Connection state changed from ${prevState} to ${curState}`);

    if (curState === 'DISCONNECTED') {
      console.log('Attempting to reconnect...');
    }
  });

  // Cleanup local microphone track on unmount
  // Note: useJoin already handles client.leave() automatically — do NOT call it
  // here too, as doing so while a join is still in progress causes WS_ABORT: LEAVE.
  useEffect(() => {
    return () => {
      if (localMicrophoneTrack) {
        localMicrophoneTrack.close();
      }
    };
  }, [localMicrophoneTrack]);

  const handleStartConversation = async () => {
    if (!activeAgentId) return;
    setIsConnecting(true);

    try {
      const startRequest: ClientStartRequest = {
        requester_id: joinedUID?.toString(),
        channel_name: agoraData.channel,
      };

      const response = await fetch('/api/invite-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(startRequest),
      });

      if (!response.ok) {
        throw new Error(`Failed to start conversation: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.agent_id) {
        setActiveAgentId(data.agent_id);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('Error starting conversation:', error.message);
      }
      setIsConnecting(false);
    }
  };

  // Toggle microphone functionality
  const handleMicrophoneToggle = async (isOn: boolean) => {
    setIsEnabled(isOn);

    if (isOn && !isAgentConnected) {
      // Start conversation when microphone is turned on
      await handleStartConversation();
    }
  };

  // Add token renewal handler
  const handleTokenWillExpire = useCallback(async () => {
    if (!onTokenWillExpire || !joinedUID) return;
    try {
      const newToken = await onTokenWillExpire(joinedUID.toString());
      await client?.renewToken(newToken);
      
      // Also renew RTM token
      if (rtmClientRef.current) {
        await rtmClientRef.current.renewToken(newToken);
        console.log('Successfully renewed Agora RTC and RTM tokens');
      }
    } catch (error) {
      console.error('Failed to renew Agora token:', error);
    }
  }, [client, onTokenWillExpire, joinedUID]);

  // Add token observer
  useClientEvent(client, 'token-privilege-will-expire', handleTokenWillExpire);

  // Debug remote users to ensure we have the right agent UID
  useEffect(() => {
    if (remoteUsers.length > 0) {
      console.log(
        'Remote users detected:',
        remoteUsers.map((u) => u.uid)
      );
      console.log('Current NEXT_AGENT_UID:', agentUID);

      // If we see UIDs that don't match our expected agent UID
      const potentialAgents = remoteUsers.map((u) => u.uid.toString());
      if (agentUID && !potentialAgents.includes(agentUID)) {
        console.warn(
          'Agent UID mismatch! Expected:',
          agentUID,
          'Available users:',
          potentialAgents
        );
        console.info(
          `Consider updating NEXT_AGENT_UID to one of: ${potentialAgents.join(
            ', '
          )}`
        );
      }
    }
  }, [remoteUsers, agentUID]);

  return (
    <div className="flex flex-col gap-6 p-4 h-full">
      {/* Connection Status - Always show End Conversation button */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={onEndConversation}
          className="px-4 py-2 bg-transparent text-red-500 rounded-full border border-red-500 backdrop-blur-sm
          hover:bg-red-500 hover:text-black transition-all duration-300 shadow-lg hover:shadow-red-500/20 text-sm font-medium"
        >
          End Conversation
        </button>
        <div
          className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
      </div>

      {/* Remote Users Section - Moved to top */}
      <div className="flex-1">
        {remoteUsers.map((user) => (
          <div key={user.uid}>
            <AudioVisualizer track={user.audioTrack} />
            <RemoteUser user={user} />
          </div>
        ))}

        {remoteUsers.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Waiting for AI agent to join...
          </div>
        )}
      </div>

      {/* Local Controls - Fixed at bottom center */}
      <div className="fixed bottom-14 md:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <MicrophoneButton
          isEnabled={isEnabled}
          setIsEnabled={setIsEnabled}
          localMicrophoneTrack={localMicrophoneTrack}
        />
        <MicrophoneSelector localMicrophoneTrack={localMicrophoneTrack} />
      </div>

      {/* Conversation Text Stream component */}
      <ConvoTextStream
        messageList={messageList}
        currentInProgressMessage={currentInProgressMessage}
      />
    </div>
  );
}
