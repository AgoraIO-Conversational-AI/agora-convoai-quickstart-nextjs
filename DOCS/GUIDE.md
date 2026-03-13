# Build a Conversational AI App with Next.js and Agora

Conversational Voice AI is hype right nowß. It allows you to have a real-time conversation with an AI agent, and actually get something done without wasting time typing out your thoughts and trying to format them into a clever prompt. It's a major shift in the way people interact with AI.

But given the investment that developers and businesses have made in building their own text based agents that run through custom LLM workflows, there's reluctance to adopt this new paradigm. Especially if it means having to give up all that investment or event worse, hobble it by only connecting them as tools/function calls.

This is why we built the Agora Conversational AI Engine. It allows you to connect your existing LLM workflows to an Agora channel, and have a real-time conversation with the AI agent.

In this guide, we'll build a real-time audio conversation application that connects users with an AI agent powered by Agora's Conversational AI Engine. The app will be built with NextJS, React, and TypeScript. We'll take an incremental approach, starting with the core real-time communication components and then add-in Agora's Convo AI Engine.

By the end of this guide, you will have a real-time audio conversation application that connects users with an AI agent powered by Agora's Conversational AI Engine.

## Prerequisites

Before starting, for the guide you're going to need to have:

- Node.js (v18 or higher)
- A basic understanding of React with TypeScript and NextJS.
- [An Agora account](https://console.agora.io/signup) - _first 10k minutes each month are free_
- Conversational AI service [activated on your AppID](https://console.agora.io/)

## Project Setup

Let's start by creating a new NextJS project with TypeScript support.

```bash
pnpm create next-app@latest ai-conversation-app
cd ai-conversation-app
```

When prompted, select these options:

- TypeScript: <u>Yes</u>
- ESLint: <u>Yes</u>
- Tailwind CSS: <u>Yes</u>
- Use `src/` directory: <u>No</u>
- App Router: <u>Yes</u>
- Use Turbopack: <u>No</u>
- Customize import alias: <u>Yes</u> (use the default `@/*`)

Next, install the required Agora dependencies:

- Agora's React SDK: [agora-rtc-react](https://www.npmjs.com/package/agora-rtc-react)
- Agora's Token Builder: [agora-token](https://www.npmjs.com/package/agora-token)
- Agora's Agent Server SDK: [agora-agent-server-sdk](https://www.npmjs.com/package/agora-agent-server-sdk) (for inviting and managing the AI agent)

```bash
pnpm add agora-rtc-react agora-token agora-agent-server-sdk
```

For UI components, we'll use shadcn/ui in this guide, but you can use any UI library of your choice or create custom components:

```bash
pnpm dlx shadcn@latest init
```

For this guide, we'll also use Lucide icons, so install that too:

```bash
pnpm add lucide-react
```

As we go through this guide, you'll have to create new files in specific directories. So, before we start let's create these new directories.

In your project root directory, create the `app/api/`, `components/`, and `types/` directories, and add the `.env.local` file:

```bash
mkdir app/api components types
touch .env.local
```

Your project directory should now have a structure like this:

```
├── app/
│   ├── api/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
├── types/
├── .env.local
└── (... Existing files and directories)
```

## Landing Page Component

Let's begin by setting up our landing page that initializes the Agora client and sets up the `AgoraProvider`.

Create the `LandingPage` component file at `components/LandingPage.tsx`:

```bash
touch components/LandingPage.tsx
```

For now we'll keep this component simple, and fill it in with more functionality as we progress through the guide. I've included comments throughout the code to help you understand what's happening. At a high level, we're importing the Agora React SDK and creating the AgoraRTC client, and then passing it to the `AgoraProvider` so all child components use the same `client` instance.

Add the following code to the `LandingPage.tsx` file:

```typescript
'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Agora requires access to the browser's WebRTC API,
// - which throws an error if it's loaded via SSR
// Create a component that has SSR disabled,
// - and use it to load the AgoraRTC components on the client side
const AgoraProvider = dynamic(
  async () => {
    // Dynamically import Agora's components
    const { AgoraRTCProvider, default: AgoraRTC } = await import(
      'agora-rtc-react'
    );

    return {
      default: ({ children }: { children: React.ReactNode }) => {
        // Create the Agora RTC client once using useMemo
        const client = useMemo(
          () => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }),
          []
        );

        // The provider makes the client available to all child components
        return <AgoraRTCProvider client={client}>{children}</AgoraRTCProvider>;
      },
    };
  },
  { ssr: false } // Important: disable SSR for this component
);

export default function LandingPage() {
  // Basic setup, we'll add more functionality as we progress through the guide.
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-6 text-center">
        Agora AI Conversation
      </h1>

      <div className="max-w-4xl mx-auto">
        <p className="text-lg mb-6 text-center">
          When was the last time you had an intelligent conversation?
        </p>

        {/* Placeholder for our start conversation button */}
        <div className="flex justify-center mb-8">
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg">
            Start Conversation
          </button>
        </div>

        <AgoraProvider>
          <div>
            "PLACEHOLDER: We'll add the conversation component here"
          </div>
        </AgoraProvider>
      </div>
    </div>
  );
}
```

Now update your `app/page.tsx` file to use this landing page:

```typescript
import LandingPage from '@/components/LandingPage';

export default function Home() {
  return <LandingPage />;
}
```

## Basic Agora React JS Implementation

With the landing page setup we can focus on implementing Agora's React JS SDK to handle the core RTC functionality, like joining a channel, publishing audio, receiving audio, and handling the Agora SDK events.

Create a file at `components/ConversationComponent.tsx`,

```bash
touch components/ConversationComponent.tsx
```

Add the following code:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function ConversationComponent() {
  // Access the client from the provider context
  const client = useRTCClient();

  // Track connection status
  const isConnected = useIsConnected();

  // Manage microphone state
  const [isEnabled, setIsEnabled] = useState(true);
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(isEnabled);

  // Track remote users (like our AI agent)
  const remoteUsers = useRemoteUsers();

  // Join the channel when component mounts
  const { isConnected: joinSuccess } = useJoin(
    {
      appid: process.env.NEXT_PUBLIC_AGORA_APP_ID!, // Load APP_ID from env.local
      channel: 'test-channel',
      token: 'replace-with-token',
      uid: 0, // Join with UID 0 and Agora will assign a unique ID when the user joins
    },
    true // Join automatically when the component mounts
  );

  // Publish our microphone track to the channel
  usePublish([localMicrophoneTrack]);

  // Set up event handlers for client events
  useClientEvent(client, 'user-joined', (user) => {
    console.log('Remote user joined:', user.uid);
  });

  useClientEvent(client, 'user-left', (user) => {
    console.log('Remote user left:', user.uid);
  });

  // Toggle microphone on/off
  const toggleMicrophone = async () => {
    if (localMicrophoneTrack) {
      await localMicrophoneTrack.setEnabled(!isEnabled);
      setIsEnabled(!isEnabled);
    }
  };

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      client?.leave(); // Leave the channel when the component unmounts
    };
  }, [client]);

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="mb-4">
        <p className="text-white">
          {/* Display the connection status */}
          Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
        </p>
      </div>

      {/* Display remote users */}
      <div className="mb-4">
        {remoteUsers.length > 0 ? (
          remoteUsers.map((user) => (
            <div
              key={user.uid}
              className="p-2 bg-gray-700 rounded mb-2 text-white"
            >
              <RemoteUser user={user} />
            </div>
          ))
        ) : (
          <p className="text-gray-400">No remote users connected</p>
        )}
      </div>

      {/* Microphone control */}
      <button
        onClick={toggleMicrophone}
        className={`px-4 py-2 rounded ${
          isEnabled ? 'bg-green-500' : 'bg-red-500'
        } text-white`}
      >
        Microphone: {isEnabled ? 'On' : 'Off'}
      </button>
    </div>
  );
}
```

This component is the foundation for our real-time audio communication, so let's recap the Agora React hooks that we're using:

- `useRTCClient`: Gets access to the Agora RTC client from the provider we set up in the landing page
- `useLocalMicrophoneTrack`: Creates and manages the user's microphone input
- `useRemoteUsers`: Keeps track of other users in the channel (our AI agent will appear here)
- `useJoin`: Handles joining the channel with the specified parameters
- `usePublish`: Publishes our audio track to the channel so others can hear us
- `useClientEvent`: Sets up event handlers for important events like users joining or leaving

> **Note:** We are loading the `APP_ID` from the environment variables using the non-null assertion operator, so make sure to set it in `.env.local` file.

We need to add this component to our `LandingPage.tsx` file. Start by importing the component, and then add it to the AgoraProvider component.

```typescript
// Previous imports remain the same as before...
// Dynamically import the ConversationComponent with ssr disabled
const ConversationComponent = dynamic(() => import('./ConversationComponent'), {
  ssr: false,
});
// Previous code remains the same as before...
<AgoraProvider>
  <ConversationComponent />
</AgoraProvider>;
```

Next, we'll implement token authentication, to add a layer of security to our application.

## 4. Token Generation and Management

The Agora team strongly recommends using token-based authentication for all your apps, especially in production environments. In this step, we'll create a route to generate these tokens and update our `LandingPage` and `ConversationComponent` to use them.

### Token Generation Route

Let's break down what the token generation route needs to do:

1. Generate a secure Agora token using our App ID and Certificate
2. Create a unique channel name for each conversation
3. Return token, along with the channel name, and UID we used to generate it, back to the client
4. Support token refresh, using existing channel name and UID

Create a new file at `app/api/generate-agora-token/route.ts`:

```bash
mkdir app/api/generate-agora-token
touch app/api/generate-agora-token/route.ts
```

Add the following code:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

// Access environment variables
const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID;
const APP_CERTIFICATE = process.env.NEXT_AGORA_APP_CERTIFICATE;
const EXPIRATION_TIME_IN_SECONDS = 3600; // Token valid for 1 hour

// Helper function to generate unique channel names
function generateChannelName(): string {
  // Combine timestamp and random string for uniqueness
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `ai-conversation-${timestamp}-${random}`;
}

export async function GET(request: NextRequest) {
  console.log('Generating Agora token...');

  // Verify required environment variables are set
  if (!APP_ID || !APP_CERTIFICATE) {
    console.error('Agora credentials are not set');
    return NextResponse.json(
      { error: 'Agora credentials are not set' },
      { status: 500 },
    );
  }

  // Get query parameters (if any)
  const { searchParams } = new URL(request.url);
  const uidStr = searchParams.get('uid') || '0';
  const uid = parseInt(uidStr);

  // Use provided channel name or generate new one
  const channelName = searchParams.get('channel') || generateChannelName();

  // Calculate token expiration time
  const expirationTime =
    Math.floor(Date.now() / 1000) + EXPIRATION_TIME_IN_SECONDS;

  try {
    // Generate the token using Agora's Token Builder SDK (RTC + RTM for text streaming)
    console.log(
      'Building RTC+RTM token with UID:',
      uid,
      'Channel:',
      channelName,
    );
    const token = RtcTokenBuilder.buildTokenWithRtm(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      RtcRole.PUBLISHER, // User can publish audio/video
      expirationTime,
      expirationTime,
    );

    console.log('Token generated successfully (RTC + RTM)');
    // Return the token and session information to the client
    return NextResponse.json({
      token,
      uid: uid.toString(),
      channel: channelName,
    });
  } catch (error) {
    console.error('Error generating Agora token:', error);
    return NextResponse.json(
      { error: 'Failed to generate Agora token', details: error },
      { status: 500 },
    );
  }
}
```

This route handles token generation for our application, so let's recap the important features:

- Generates a unique channel names using timestamps and random strings to avoid collisions
- Generates a secure token using the App ID and Certificate
- Accepts url parameters for refreshing tokens using an existing channel name and user ID

> **Note:** This route is loading the APP_ID and APP_CERTIFICATE from the environment variables, so make sure to set them in your `.env.local` file.

### Updating the Landing Page to Request Tokens

With the token route setup, let's update the landing page, to handle all token fetching logic. First, we'll need to create a new type definition for the token data, so we can use it in our component.

Create a file at `types/conversation.ts`:

```bash
touch types/conversation.ts
```

Add the following code:

```typescript
// Types for Agora token data
export interface AgoraTokenData {
  token: string;
  uid: string;
  channel: string;
  agentId?: string;
}
```

Open the `components/LandingPage.tsx` file, update the react imports, add the new import statement for the `AgoraTokenData` type, and update the entire `LandingPage()` function.

We'll use Suspense, because the Agora React SDK is dynamically loaded, and the conversation component needs some time to load, so it'll be good to show a loading state till its ready.

```typescript
'use client';

import { useState, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import type {
  AgoraTokenData,
  ClientStartRequest,
  AgentResponse,
} from '../types/conversation';

// Dynamically import the ConversationComponent with ssr disabled
const ConversationComponent = dynamic(() => import('./ConversationComponent'), {
  ssr: false,
});

// Dynamically import AgoraRTC and AgoraRTCProvider
const AgoraProvider = dynamic(
  async () => {
    const { AgoraRTCProvider, default: AgoraRTC } = await import('agora-rtc-react');
    return {
      default: ({ children }: { children: React.ReactNode }) => {
        const client = useMemo(
          () => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }),
          []
        );
        return <AgoraRTCProvider client={client}>{children}</AgoraRTCProvider>;
      },
    };
  },
  { ssr: false }
);

export default function LandingPage() {
  // Manage conversation state
  const [showConversation, setShowConversation] = useState(false);
  // Manage loading state, while the agent token is generated
  const [isLoading, setIsLoading] = useState(false);
  // Manage error state
  const [error, setError] = useState<string | null>(null);
  // Store the token data for the conversation
  const [agoraData, setAgoraData] = useState<AgoraTokenData | null>(null);
  const [agentJoinError, setAgentJoinError] = useState(false);

  const handleStartConversation = async () => {
    setIsLoading(true);
    setError(null);
    setAgentJoinError(false);

    try {
      // Step 1: Request a token from our API
      console.log('Fetching Agora token...');
      const agoraResponse = await fetch('/api/generate-agora-token');
      const responseData = await agoraResponse.json();
      console.log('Agora API response:', responseData);

      if (!agoraResponse.ok) {
        throw new Error(
          `Failed to generate Agora token: ${JSON.stringify(responseData)}`
        );
      }

      // Step 2: Invite the AI agent to join the channel
      const startRequest: ClientStartRequest = {
        requester_id: responseData.uid,
        channel_name: responseData.channel,
      };

      try {
        const response = await fetch('/api/invite-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(startRequest),
        });

        if (!response.ok) {
          setAgentJoinError(true);
        } else {
          const agentData: AgentResponse = await response.json();
          setAgoraData({
            ...responseData,
            agentId: agentData.agent_id,
          });
        }
      } catch (err) {
        console.error('Failed to start conversation with agent:', err);
        setAgentJoinError(true);
      }

      // Show the conversation UI even if agent join fails
      setShowConversation(true);
    } catch (err) {
      setError('Failed to start conversation. Please try again.');
      console.error('Error starting conversation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenWillExpire = async (uid: string) => {
    try {
      // Request a new token using the channel name and uid
      const response = await fetch(
        `/api/generate-agora-token?channel=${agoraData?.channel}&uid=${uid}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error('Failed to generate new token');
      }

      return data.token;
    } catch (error) {
      console.error('Error renewing token:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white relative overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="z-10 text-center">
          <h1 className="text-4xl font-bold mb-6">Speak with Agent</h1>
          {!showConversation && (
            <p className="text-lg mb-14">
              Experience the power of Agora's Conversational AI Engine.
            </p>
          )}
          {!showConversation ? (
            <>
              <button
                onClick={handleStartConversation}
                disabled={isLoading}
                className="px-8 py-3 bg-black text-white font-bold rounded-full border-2 border-[#00c2ff] backdrop-blur-sm
                hover:bg-[#00c2ff] hover:text-black transition-all duration-300 shadow-lg hover:shadow-[#00c2ff]/20
                disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              >
                {isLoading ? 'Starting...' : 'Try it now!'}
              </button>
              {error && <p className="mt-4 text-destructive">{error}</p>}
            </>
          ) : agoraData ? (
            <>
              {agentJoinError && (
                <div className="mb-4 p-3 bg-destructive/20 rounded-lg text-destructive">
                  Failed to connect with AI agent. The conversation may not work
                  as expected.
                </div>
              )}
              <Suspense fallback={<div>Loading conversation...</div>}>
                <AgoraProvider>
                  <ConversationComponent
                    agoraData={agoraData}
                    onTokenWillExpire={handleTokenWillExpire}
                    onEndConversation={async () => {
                      if (agoraData?.agentId) {
                        try {
                          console.log('Stopping agent:', agoraData.agentId);
                          const response = await fetch('/api/stop-conversation', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ agent_id: agoraData.agentId }),
                          });

                          if (!response.ok) {
                            console.error('Failed to stop agent:', await response.text());
                          } else {
                            console.log('Agent stopped successfully');
                          }
                        } catch (error) {
                          console.error('Error stopping agent:', error);
                        }
                      }
                      setShowConversation(false);
                    }}
                  />
                </AgoraProvider>
              </Suspense>
            </>
          ) : (
            <p>Failed to load conversation data.</p>
          )}
        </div>
      </div>
      <footer className="fixed bottom-0 left-0 py-4 pl-4 md:py-6 md:pl-6 z-40">
        <div className="flex items-center justify-start space-x-2 text-gray-400">
          <span className="text-sm font-light uppercase">Powered by</span>
          <a
            href="https://agora.io/en/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-300 transition-colors"
            aria-label="Visit Agora's website"
          >
            <img
              src="/agora-logo-rgb-blue.svg"
              alt="Agora"
              className="h-6 w-auto hover:opacity-80 transition-opacity translate-y-1"
            />
            <span className="sr-only">Agora</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
```

> Don't worry about any errors or warnings on the ConversationComponent for now, we'll fix them in the next step.

### Updating the Conversation Component to Use Tokens

Now that we have token and channel name, lets create some props so we can pass them from the `LandingPage` to the `ConversationComponent`.

Open the `types/conversation.ts` file and add the following `interface`:

```typescript
// Props for our conversation component
export interface ConversationComponentProps {
  agoraData: AgoraTokenData;
  onTokenWillExpire: (uid: string) => Promise<string>;
  onEndConversation: () => void;
}
```

Open the `ConversationComponent.tsx` file and update it to import and use the props we just created to join the channel. We'll also add the token-expiry event handler to handle token renewal, and a button to leave the conversation.

```typescript
// Previous imports remain the same as before...
import type { ConversationComponentProps } from '../types/conversation'; // Import the new props

// Update the component to accept the new props
export default function ConversationComponent({
  agoraData,
  onTokenWillExpire,
  onEndConversation,
}: ConversationComponentProps) {
  // The previous declarations remain the same as before
  const [joinedUID, setJoinedUID] = useState<UID>(0); // New: After joining the channel we'll store the uid for renewing the token

  // Update the useJoin hook to use the token and channel name from the props
  const { isConnected: joinSuccess } = useJoin(
    {
      appid: process.env.NEXT_PUBLIC_AGORA_APP_ID!,
      channel: agoraData.channel, // Using the channel name received from the token response
      token: agoraData.token, // Using the token we received
      uid: parseInt(agoraData.uid), // Using uid 0 to join the channel, so Agora's system will create and return a uid for us
    },
    true
  );

  // Set the actualUID to the Agora generated uid once the user joins the channel
  useEffect(() => {
    if (joinSuccess && client) {
      const uid = client.uid;
      setJoinedUID(uid as UID);
      console.log('Join successful, using UID:', uid);
    }
  }, [joinSuccess, client]);

  /*
  Existing code remains the same as before:
  // Publish local microphone track
  // Handle remote user events
  // Handle remote user left event
*/

  // New: Add listener for connection state changes
  useClientEvent(client, 'connection-state-change', (curState, prevState) => {
    console.log(`Connection state changed from ${prevState} to ${curState}`);
  });

  // Add token renewal handler to avoid disconnections
  const handleTokenWillExpire = useCallback(async () => {
    if (!onTokenWillExpire || !joinedUID) return;
    try {
      // Request a new token from our API
      const newToken = await onTokenWillExpire(joinedUID.toString());
      await client?.renewToken(newToken);
      console.log('Successfully renewed Agora token');
    } catch (error) {
      console.error('Failed to renew Agora token:', error);
    }
  }, [client, onTokenWillExpire, joinedUID]);

  // New: Add listener for token privilege will expire event
  useClientEvent(client, 'token-privilege-will-expire', handleTokenWillExpire);

  /*
  Existing code remains the same as before:
  // Toggle microphone
  // Cleanup on unmount
*/

  //update the return statement to include new UI elements for leaving the conversation
  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-white">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <button
          onClick={onEndConversation}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          End Conversation
        </button>
      </div>

      {/* Display remote users */}
      <div className="mb-4">
        <h2 className="text-xl mb-2 text-white">Remote Users:</h2>
        {remoteUsers.length > 0 ? (
          remoteUsers.map((user) => (
            <div
              key={user.uid}
              className="p-2 bg-gray-700 rounded mb-2 text-white"
            >
              <RemoteUser user={user} />
            </div>
          ))
        ) : (
          <p className="text-gray-400">No remote users connected</p>
        )}
      </div>

      {/* Microphone control */}
      <button
        onClick={toggleMicrophone}
        className={`px-4 py-2 rounded ${
          isEnabled ? 'bg-green-500' : 'bg-red-500'
        } text-white`}
      >
        Microphone: {isEnabled ? 'On' : 'Off'}
      </button>
    </div>
  );
}
```

### Quick Test

Now that we have our basic RTC functionality and token generation working, let's test the application.

1. Run the application using `pnpm run dev`
2. Open the application in your browser, using the url `http://localhost:3000`
3. Click on the "Start Conversation" button
4. You should see the connection status change to "Connected"

## Add Agora's Conversational AI Engine

Now that we have the basic RTC functionality working, let's integrate Agora's Conversational AI service. In this next section we'll:

1. Create an API route for inviting the AI agent to our channel
2. Configure Agora Start Request, including our choice of LLM endpoint and TTS provider
3. Create a route for stopping the conversation

### Types Setup

Add the types needed for the agent invitation API to `types/conversation.ts`:

```typescript
// Types for the agent invitation API
export interface ClientStartRequest {
  requester_id: string;
  channel_name: string;
}

export interface AgentResponse {
  agent_id: string;
  create_ts: number;
  state: string;
}
```

### Invite Agent Route

The `agora-agent-server-sdk` simplifies agent creation by handling token generation and the Agora REST API internally. Create the route file at `app/api/invite-agent/route.ts`:

```bash
mkdir app/api/invite-agent
touch app/api/invite-agent/route.ts
```

Add the following code:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  AgoraClient,
  Agent,
  Area,
  ExpiresIn,
  OpenAI,
  ElevenLabsTTS,
  DeepgramSTT,
} from 'agora-agent-server-sdk';
import { ClientStartRequest, AgentResponse } from '@/types/conversation';

// System prompt that defines the agent's personality and behavior
const ADA_PROMPT = `You are **Ada**, a developer advocate AI from **Agora**. You help developers understand and build with Agora's Conversational AI platform. Respond concisely and naturally as if in a spoken conversation.`;

// First thing the agent says when a user joins the channel.
const GREETING = `Hi there! I'm Ada, your virtual assistant from Agora. What kind of project do you have in mind?`;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Set these in .env.local (see env vars reference at end of guide)
const appId =
  process.env.NEXT_PUBLIC_AGORA_APP_ID || requireEnv('NEXT_AGORA_APP_ID');
const appCertificate = requireEnv('NEXT_AGORA_APP_CERTIFICATE');
// Must match NEXT_PUBLIC_AGENT_UID on the client
const agentUid = process.env.NEXT_PUBLIC_AGENT_UID || 'Agent';
// Any OpenAI-compatible endpoint (OpenAI, Azure, Groq, etc.)
const llmUrl = requireEnv('NEXT_LLM_URL');
const llmApiKey = requireEnv('NEXT_LLM_API_KEY');
const deepgramApiKey = requireEnv('NEXT_DEEPGRAM_API_KEY');
const elevenLabsApiKey = requireEnv('NEXT_ELEVENLABS_API_KEY');
// Find your voice at https://elevenlabs.io/app/voice-lab
const ELEVENLABS_VOICE_ID = 'cgSgspJ2msm6clMCkdW9';

export async function POST(request: NextRequest) {
  try {
    const body: ClientStartRequest = await request.json();
    const { requester_id, channel_name } = body;

    if (!channel_name || !requester_id) {
      return NextResponse.json(
        { error: 'channel_name and requester_id are required' },
        { status: 400 },
      );
    }

    // Authenticates API calls to the Agora Conversational AI service
    const client = new AgoraClient({
      area: Area.US,
      appId,
      appCertificate,
    });

    const agent = new Agent({
      name: `conversation-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      instructions: ADA_PROMPT,
      greeting: GREETING,
      failureMessage: 'Please wait a moment.',
      maxHistory: 50,
      // VAD: how long to wait after user stops speaking before end of turn
      turnDetection: {
        type: 'agora_vad',
        silence_duration_ms: 480,
        threshold: 0.5,
        interrupt_duration_ms: 160,
        prefix_padding_ms: 300,
      },
      // RTM needed for transcript events; enable_tools for MCP
      advancedFeatures: { enable_rtm: true, enable_tools: true },
    })
      .withStt(
        new DeepgramSTT({
          apiKey: deepgramApiKey,
          model: 'nova-3',
          language: 'en',
        }),
      )
      .withLlm(
        new OpenAI({
          url: llmUrl,
          apiKey: llmApiKey,
          model: 'gpt-4o',
          greetingMessage: GREETING,
          failureMessage: 'Please wait a moment.',
          maxHistory: 15,
          params: { max_tokens: 1024, temperature: 0.7, top_p: 0.95 },
        }),
      )
      .withTts(
        new ElevenLabsTTS({
          key: elevenLabsApiKey,
          modelId: 'eleven_flash_v2_5',
          voiceId: ELEVENLABS_VOICE_ID,
        }),
      );

    // remoteUids restricts the agent to only process audio from this user
    const session = agent.createSession(client, {
      channel: channel_name,
      agentUid,
      remoteUids: [requester_id],
      idleTimeout: 30,
      expiresIn: ExpiresIn.hours(1),
    });

    const agentId = await session.start();

    return NextResponse.json({
      agent_id: agentId,
      create_ts: Math.floor(Date.now() / 1000),
      state: 'RUNNING',
    } as AgentResponse);
  } catch (error) {
    console.error('Error starting conversation:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start conversation',
      },
      { status: 500 },
    );
  }
}
```

The SDK supports multiple STT, LLM, and TTS providers. This example uses Deepgram for speech-to-text, OpenAI for the LLM, and ElevenLabs for text-to-speech. You can swap these for other vendors supported by the SDK.

> **Note:** Set all required environment variables in your `.env.local` file. See the environment variables reference at the end of this guide.

### Stop Conversation Route

After the agent joins the conversation, we need a way to remove them. The `stop-conversation` route uses the `agora-agent-server-sdk` to stop the agent.

Create a file at `app/api/stop-conversation/route.ts`:

```bash
mkdir app/api/stop-conversation
touch app/api/stop-conversation/route.ts
```

Add the following code:

```typescript
import { NextResponse } from 'next/server';
import { AgoraClient, Area } from 'agora-agent-server-sdk';
import { StopConversationRequest } from '@/types/conversation';

export async function POST(request: Request) {
  try {
    const body: StopConversationRequest = await request.json();
    const { agent_id } = body;

    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 },
      );
    }

    const appId =
      process.env.NEXT_PUBLIC_AGORA_APP_ID || process.env.NEXT_AGORA_APP_ID;
    const appCertificate = process.env.NEXT_AGORA_APP_CERTIFICATE;
    if (!appId || !appCertificate) {
      throw new Error(
        'Missing Agora configuration. Set NEXT_PUBLIC_AGORA_APP_ID and NEXT_AGORA_APP_CERTIFICATE.',
      );
    }

    const client = new AgoraClient({
      area: Area.US,
      appId,
      appCertificate,
    });
    await client.stopAgent(agent_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error stopping conversation:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to stop conversation',
      },
      { status: 500 },
    );
  }
}
```

Add `StopConversationRequest` to your `types/conversation.ts`:

```typescript
export interface StopConversationRequest {
  agent_id: string;
}
```

## Update the Client to Start and Stop the AI Agent

The landing page flow (inviting the agent and handling `onEndConversation` with the stop-conversation API) is already covered in the "Updating the Landing Page to Request Tokens" section above. When the user clicks "Try it now!", the app fetches a token, invites the AI agent, and shows the conversation. The `onEndConversation` callback stops the agent via the API before hiding the conversation.

### Creating a Microphone Button Component

The microphone button is an essential element of any audio-first UI. Create a button component with audio visualization that allows users to control their microphone.

Create a file at `components/MicrophoneButton.tsx`:

```bash
touch components/MicrophoneButton.tsx
```

Add the following code (includes audio visualization bars and unpublish/publish for proper track management):

```typescript
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-react';
import { Mic, MicOff } from 'lucide-react';

interface AudioBar {
  height: number;
}

interface MicrophoneButtonProps {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  localMicrophoneTrack: IMicrophoneAudioTrack | null;
}

export function MicrophoneButton({
  isEnabled,
  setIsEnabled,
  localMicrophoneTrack,
}: MicrophoneButtonProps) {
  const [audioData, setAudioData] = useState<AudioBar[]>(Array(5).fill({ height: 0 }));
  const client = useRTCClient();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (localMicrophoneTrack && isEnabled) {
      setupAudioAnalyser();
    } else {
      cleanupAudioAnalyser();
    }
    return () => cleanupAudioAnalyser();
  }, [localMicrophoneTrack, isEnabled]);

  const setupAudioAnalyser = async () => {
    if (!localMicrophoneTrack) return;
    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      analyserRef.current.smoothingTimeConstant = 0.5;
      const mediaStream = localMicrophoneTrack.getMediaStreamTrack();
      const source = audioContextRef.current.createMediaStreamSource(new MediaStream([mediaStream]));
      source.connect(analyserRef.current);
      updateAudioData();
    } catch (error) {
      console.error('Error setting up audio analyser:', error);
    }
  };

  const cleanupAudioAnalyser = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioData(Array(5).fill({ height: 0 }));
  };

  const updateAudioData = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const segmentSize = Math.floor(dataArray.length / 5);
    const newAudioData = Array(5).fill(0).map((_, index) => {
      const start = index * segmentSize;
      const end = start + segmentSize;
      const average = dataArray.slice(start, end).reduce((a, b) => a + b, 0) / segmentSize;
      const scaledHeight = Math.min(60, (average / 255) * 100 * 1.2);
      return { height: Math.pow(scaledHeight / 60, 0.7) * 60 };
    });
    setAudioData(newAudioData);
    animationFrameRef.current = requestAnimationFrame(updateAudioData);
  };

  const toggleMicrophone = async () => {
    if (localMicrophoneTrack) {
      const newState = !isEnabled;
      try {
        await localMicrophoneTrack.setEnabled(newState);
        if (!newState) {
          await client.unpublish(localMicrophoneTrack);
        } else {
          await client.publish(localMicrophoneTrack);
        }
        setIsEnabled(newState);
        console.log('Microphone state updated successfully');
      } catch (error) {
        console.error('Failed to toggle microphone:', error);
        localMicrophoneTrack.setEnabled(isEnabled);
      }
    }
  };

  return (
    <button
      onClick={toggleMicrophone}
      className="group relative w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-300"
      style={{
        backgroundColor: 'transparent',
        border: `2px solid ${isEnabled ? '#A0FAFF' : '#DE344A'}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = isEnabled ? '#A0FAFF' : '#DE344A';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      aria-label={isEnabled ? 'Mute microphone' : 'Unmute microphone'}
    >
      <div className="absolute inset-0 flex items-center justify-center gap-1">
        {audioData.map((bar, index) => (
          <div
            key={index}
            className="w-1 rounded-full transition-all duration-100 group-hover:!bg-black"
            style={{
              height: `${bar.height}%`,
              backgroundColor: isEnabled ? '#A0FAFF' : '#DE344A',
              transform: `scaleY(${Math.max(0.1, bar.height / 100)})`,
              transformOrigin: 'center',
            }}
          />
        ))}
      </div>
      <div className="relative z-10 group-hover:text-black transition-colors duration-300">
        {isEnabled ? (
          <Mic size={24} style={{ color: '#A0FAFF' }} className="group-hover:!text-black transition-colors duration-300" />
        ) : (
          <MicOff size={24} style={{ color: '#DE344A' }} className="group-hover:!text-black transition-colors duration-300" />
        )}
      </div>
    </button>
  );
}
```

### Creating a Microphone Selector Component (Optional)

When users have multiple microphones, a device selector improves the experience. Create `components/MicrophoneSelector.tsx`:

```bash
touch components/MicrophoneSelector.tsx
```

The component uses `AgoraRTC.getMicrophones()` to list devices, shows a dropdown when multiple devices exist, and supports hot-swap when devices are plugged/unplugged. It only renders when `devices.length > 1`. See the implementation in `components/MicrophoneSelector.tsx` for the full code using shadcn `DropdownMenu` and `Button`.

### Updating the Conversation Component

Update the conversation component to include the microphone button, optional microphone selector, and End Conversation control:

```typescript
// Previous imports remain the same as before...
import { MicrophoneButton } from './MicrophoneButton';
import { MicrophoneSelector } from './MicrophoneSelector';
import { AudioVisualizer } from './AudioVisualizer';
import ConvoTextStream from './ConvoTextStream';
import type { ConversationComponentProps } from '../types/conversation';

export default function ConversationComponent({
  agoraData,
  onTokenWillExpire,
  onEndConversation,
}: ConversationComponentProps) {
  // ... state: isEnabled, joinedUID, agentUID, isAgentConnected, isConnecting,
  //     messageList, currentInProgressMessage (from agora-client-toolkit - see TEXT_STREAMING_GUIDE) ...

  // Handle remote user events - ie when AI agent joins/leaves
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

  return (
    <div className="flex flex-col gap-6 p-4 h-full">
      {/* Connection Status - End Conversation always visible */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={onEndConversation}
          className="px-4 py-2 bg-transparent text-red-500 rounded-full border border-red-500 backdrop-blur-sm
          hover:bg-red-500 hover:text-black transition-all duration-300 shadow-lg hover:shadow-red-500/20 text-sm font-medium"
        >
          End Conversation
        </button>
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>

      {/* Remote Users with Audio Visualizer */}
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

      {/* Conversation Text Stream component - see TEXT_STREAMING_GUIDE.md for setup */}
      <ConvoTextStream
        messageList={messageList}
        currentInProgressMessage={currentInProgressMessage}
        agentUID={agentUID}
      />
    </div>
  );
}
```

The agent is invited by the landing page when the user clicks "Try it now!". For text streaming (transcriptions), the app uses the `agora-client-toolkit` with RTM—see [TEXT_STREAMING_GUIDE.md](./TEXT_STREAMING_GUIDE.md) for setup. When using RTM, the token renewal handler must also renew the RTM token. The `onEndConversation` callback (passed from the landing page) stops the agent via the API before hiding the conversation.

## Audio Visualization (Optional)

Let's add an audio visualization to give visual feedback to the user when the AI agent is speaking. Here's an example of an audio visualizer component, that takes the Agora audio track as input for the animation.

Create a file at `components/AudioVisualizer.tsx`:

```bash
touch components/AudioVisualizer.tsx
```

Add the following code:

```typescript
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ILocalAudioTrack, IRemoteAudioTrack } from 'agora-rtc-react';

interface AudioVisualizerProps {
  track: ILocalAudioTrack | IRemoteAudioTrack | undefined;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ track }) => {
  const [isVisualizing, setIsVisualizing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);

  const animate = () => {
    if (!analyserRef.current) {
      return;
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Define frequency ranges for different bars to create a more appealing visualization
    const frequencyRanges = [
      [24, 31], // Highest (bar 0, 8)
      [16, 23], // Mid-high (bar 1, 7)
      [8, 15], // Mid (bar 2, 6)
      [4, 7], // Low-mid (bar 3, 5)
      [0, 3], // Lowest (bar 4 - center)
    ];

    barsRef.current.forEach((bar, index) => {
      if (!bar) {
        return;
      }

      // Use symmetrical ranges for the 9 bars
      const rangeIndex = index < 5 ? index : 8 - index;
      const [start, end] = frequencyRanges[rangeIndex];

      // Calculate average energy in this frequency range
      let sum = 0;
      for (let i = start; i <= end; i++) {
        sum += dataArray[i];
      }
      let average = sum / (end - start + 1);

      // Apply different multipliers to create a more appealing shape
      const multipliers = [0.7, 0.8, 0.85, 0.9, 0.95];
      const multiplierIndex = index < 5 ? index : 8 - index;
      average *= multipliers[multiplierIndex];

      // Scale and limit the height
      const height = Math.min((average / 255) * 100, 100);
      bar.style.height = `${height}px`;
    });

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (!track) {
      return;
    }

    const startVisualizer = async () => {
      try {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 64; // Keep this small for performance

        // Get the audio track from Agora
        const mediaStreamTrack = track.getMediaStreamTrack();
        const stream = new MediaStream([mediaStreamTrack]);

        // Connect it to our analyzer
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        setIsVisualizing(true);
        animate();
      } catch (error) {
        console.error('Error starting visualizer:', error);
      }
    };

    startVisualizer();

    // Clean up when component unmounts or track changes
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [track]);

  return (
    <div className="w-full h-40 rounded-lg overflow-hidden flex items-center justify-center relative">
      <div className="flex items-center space-x-2 h-[100px] relative z-10">
        {/* Create 9 bars for the visualizer */}
        {[...Array(9)].map((_, index) => (
          <div
            key={index}
            ref={(el) => {
              barsRef.current[index] = el;
            }}
            className="w-3 bg-gradient-to-t from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-75"
            style={{
              height: '2px',
              minHeight: '2px',
              background: 'linear-gradient(to top, #3b82f6, #8b5cf6, #ec4899)',
            }}
          />
        ))}
      </div>
    </div>
  );
};
```

The visualizer works by:

1. Taking an audio track from the Agora SDK through the `track` prop

2. Extracting frequency data from the audio stream using the Web Audio API

3. Rendering visual bars that respond to different frequency ranges in the audio

To use this visualizer with the remote user's audio track, we need to update how we render the `RemoteUser` in the `ConversationComponent`:

```typescript
// Inside the remoteUsers.map in ConversationComponent.tsx:
{
  remoteUsers.map((user) => (
    <div key={user.uid} className="mb-4">
      {/* Add the audio visualizer for the remote user */}
      <AudioVisualizer track={user.audioTrack} />
      <p className="text-center text-sm text-gray-400 mb-2">
        {user.uid.toString() === agentUID ? 'AI Agent' : `User: ${user.uid}`}
      </p>
      <RemoteUser user={user} />
    </div>
  ));
}
```

### Integrating the Audio Visualizer

To integrate/wire-in the audio visualizer with our conversation component, we need to:

1. Import the AudioVisualizer component
2. Pass the appropriate audio track to it
3. Position it in our UI

Update your `ConversationComponent.tsx` to include the audio visualizer:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { AudioVisualizer } from './AudioVisualizer';
import type {
  ConversationComponentProps,
  ClientStartRequest,
  StopConversationRequest,
} from '../types/conversation';

// Rest of the component as before...

// Then in the render method:
return (
  <div className="flex flex-col gap-6 p-4 h-full relative">
    {/* Connection Status */}
    {/* ... */}

    {/* Remote Users Section with Audio Visualizer */}
    <div className="flex-1">
      {remoteUsers.map((user) => (
        <div key={user.uid} className="mb-8 p-4 bg-gray-800/30 rounded-lg">
          <p className="text-center text-sm text-gray-400 mb-2">
            {user.uid.toString() === agentUID
              ? 'AI Agent'
              : `User: ${user.uid}`}
          </p>

          {/* The AudioVisualizer receives the remote user's audio track */}
          <AudioVisualizer track={user.audioTrack} />

          {/* The RemoteUser component handles playing the audio */}
          <RemoteUser user={user} />
        </div>
      ))}

      {remoteUsers.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          {isConnected
            ? 'Waiting for AI agent to join...'
            : 'Connecting to channel...'}
        </div>
      )}
    </div>

    {/* Microphone Control */}
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
      <MicrophoneButton
        isEnabled={isEnabled}
        setIsEnabled={setIsEnabled}
        localMicrophoneTrack={localMicrophoneTrack}
      />
    </div>
  </div>
);
```

This creates a responsive visualization that makes it clear when the AI agent is speaking, which improves the user experience through visual feedback alongside the audio.

The microphone button (with audio visualization) helps users understand if their microphone is working, when they're speaking loudly enough, and when background noise might affect audio quality.

## Testing

Now that we have all the components in place, let's finish by testing the application.

### Starting the Development Server

To start the development server:

```bash
pnpm run dev
```

> **Note:** Make sure your `.env` file is properly configured with all the necessary credentials. There is a complete list of environment variables at the end of this guide.

If your application is running correctly, you should see output like:

```
Server is running on port 3000
```

Open your browser to `http://localhost:3000` and test.

### Common Issues and Solutions

- **Agent not joining**:
  - Verify your Agora Conversational AI credentials
  - Check console for specific error messages
  - Ensure your TTS configuration is valid

- **Audio not working**:
  - Check browser permissions for microphone access
  - Verify the microphone is enabled in the app
  - Check if audio tracks are properly published

- **Token errors**:
  - Verify App ID and App Certificate are correct
  - Ensure token renewal logic is working
  - Check for proper error handling in token-related functions

- **Channel connection issues**:
  - Check network connectivity
  - Verify Agora service status
  - Ensure proper cleanup when leaving channels

## Customizations

Agora Conversational AI Engine supports a number of customizations.

### Customizing the Agent

In the invite-agent route, the `instructions` prop shapes how the AI agent responds. Modify the `ADA_PROMPT` constant to customize the agent's personality:

```typescript
// In app/api/invite-agent/route.ts
const ADA_PROMPT = `You are a friendly and helpful assistant named Alex. Your personality is warm, patient, and slightly humorous...`;
```

Update the `greeting` to control the initial message the agent speaks when joining the channel:

```typescript
const GREETING = `Hello! How can I assist you today?`;
```

### Customizing the Voice

The SDK supports multiple TTS providers. This guide uses ElevenLabs. Choose a voice from the [ElevenLabs Voice Library](https://elevenlabs.io/voice-library) and set `voiceId` in the `ElevenLabsTTS` config. For Microsoft Azure TTS, use `MicrosoftTTS` from the SDK instead.

### Fine-tuning Voice Activity Detection

Adjust `turnDetection` in the Agent config to optimize conversation flow:

```typescript
// In app/api/invite-agent/route.ts
turnDetection: {
  type: 'agora_vad',
  silence_duration_ms: 600,      // How long to wait after silence to end turn
  threshold: 0.6,                // Sensitivity to background noise
  interrupt_duration_ms: 200,    // How quickly interruptions are detected
  prefix_padding_ms: 400,        // How much audio to capture before speech is detected
},
```

# Complete Environment Variables Reference

Here's a complete list of environment variables for your `.env.local` file (SDK-based implementation):

```
# Agora Configuration
NEXT_PUBLIC_AGORA_APP_ID=
NEXT_AGORA_APP_ID=
NEXT_AGORA_APP_CERTIFICATE=
NEXT_PUBLIC_AGENT_UID=Agent

# LLM Configuration (OpenAI or compatible)
NEXT_LLM_URL=https://api.openai.com/v1/chat/completions
NEXT_LLM_API_KEY=

# STT - Deepgram
NEXT_DEEPGRAM_API_KEY=

# TTS - ElevenLabs
NEXT_ELEVENLABS_API_KEY=
```

## Next Steps

Congratulations! You've built an Express server that integrates with Agora's Conversational AI Engine. Take this microservice and integrateit with your existing Agora backends.

For more information about [Agora's Convesational AI Engine](https://www.agora.io/en/products/conversational-ai-engine/) check out the [official documenation](https://docs.agora.io/en/).

Happy building!
