# Conversational AI: Dev Advocate Agent Demo

A Next.js web application demonstrating real-time conversational AI capabilities using Agora's Real-Time Engagement SDKs. This demo showcases voice-first interactions with live transcriptions, multi-device audio input support, and an Agent ready to help you with your Agora build.

## Overview

This application demonstrates how to build a production-ready conversational AI interface with:
- **Real-time voice conversations** with AI agents powered by Agora's Conversational AI Engine
- **RTM-based messaging** for reliable real-time transcriptions and agent state updates
- **Live text transcriptions** with streaming message updates and visual status indicators
- **Advanced audio controls** including device selection and visual feedback
- **Modern UX patterns** like smart auto-scrolling, mobile responsiveness, and accessibility features
- **Flexible backend integration** supporting multiple LLM providers (OpenAI, Anthropic, etc.) and TTS via ElevenLabs
- **Official Agora toolkit** integration for robust conversation management

## Guides and Documentation

- [Guide.md](./DOCS/GUIDE.md) - Complete step-by-step guide on how to build this application from scratch.
- [User Interaction Diagram](./DOCS/User-Interaction-Diagram.md) - Visual diagram showing how the application interacts with different services.
- [Text Streaming Guide](./DOCS/TEXT_STREAMING_GUIDE.md) - Deep dive into implementing real-time conversation transcriptions.
- [Microphone Selector Implementation](./DOCS/MICROPHONE_SELECTOR_IMPLEMENTATION.md) - Guide for adding device selection functionality.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 16.x or higher)
- [pnpm](https://pnpm.io/) (version 8.x or higher)

You must have an Agora account and a project to use this application.

- [Agora Account](https://console.agora.io/)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/AgoraIO-Community/conversational-ai-nextjs-client
cd conversational-ai-nextjs-client
```

2. Install dependencies:

```bash
pnpm install
```

3. Create a `.env.local` file in the root directory and add your environment variables:

```bash
cp .env.local.example .env.local
```

The following environment variables are required:

### Agora

- `NEXT_PUBLIC_AGORA_APP_ID` - Your Agora App ID
- `NEXT_AGORA_APP_CERTIFICATE` - Your Agora App Certificate
- `NEXT_PUBLIC_AGENT_UID` - UID assigned to the AI agent in the RTC channel

### LLM

- `NEXT_LLM_URL` - Any OpenAI-compatible endpoint (OpenAI, Azure, Groq, etc.)
- `NEXT_LLM_API_KEY` - LLM API key

### ASR

- `NEXT_DEEPGRAM_API_KEY` - Deepgram API key

### TTS

- `NEXT_ELEVENLABS_API_KEY` - ElevenLabs API key

Non-sensitive settings (model names, voice ID, language, etc.) are set directly in [`app/api/invite-agent/route.ts`](app/api/invite-agent/route.ts) — edit them there.

4. Run the development server:

```bash
pnpm dev
```

5. Open your browser and navigate to `http://localhost:3000` to see the application in action.

## Deployment to Vercel

This project is configured for quick deployments to Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAgoraIO-Community%2Fconversational-ai-nextjs-client&project-name=conversational-ai-nextjs-client&repository-name=conversational-ai-nextjs-client&env=NEXT_PUBLIC_AGORA_APP_ID,NEXT_AGORA_APP_CERTIFICATE,NEXT_PUBLIC_AGENT_UID,NEXT_LLM_URL,NEXT_LLM_API_KEY,NEXT_DEEPGRAM_API_KEY,NEXT_ELEVENLABS_API_KEY&envDescription=API%20keys%20and%20credentials%20needed%20to%20run%20the%20app&envLink=https://github.com/AgoraIO-Community/conversational-ai-nextjs-client%23prerequisites&demo-title=Conversational%20AI%20Demo&demo-description=A%20Next.js-based%20web-app%20for%20conversational%20AI%20agents&demo-image=https://raw.githubusercontent.com/AgoraIO-Community/conversational-ai-nextjs-client/main/.github/assets/Conversation-Ai-Client.gif&defaultValues=NEXT_LLM_URL=https://api.openai.com/v1/chat/completions)

This will:

1. Clone the repository to your GitHub account
2. Create a new project on Vercel
3. Prompt you to fill in the required environment variables:
   - **Required**: Agora credentials (`NEXT_PUBLIC_AGORA_APP_ID`, `NEXT_AGORA_APP_CERTIFICATE`, `NEXT_PUBLIC_AGENT_UID`)
   - **Required**: LLM endpoint and API key (`NEXT_LLM_URL`, `NEXT_LLM_API_KEY`)
   - **Required**: Deepgram API key (`NEXT_DEEPGRAM_API_KEY`) and ElevenLabs API key (`NEXT_ELEVENLABS_API_KEY`)
4. Deploy the application automatically

## Features

### Audio Input Control
- **Microphone Toggle**: Easy-to-use button to enable/disable your microphone
- **Device Selection**: Choose from multiple microphone inputs with the microphone selector dropdown
- **Hot-Swap Support**: Automatically detects when devices are plugged in/unplugged
- **Audio Visualization**: Real-time visual feedback showing microphone input levels

### Real-Time Text Streaming
- **Live Transcriptions**: See what you say and the AI's responses in real-time as text
- **Message Status Indicators**: Visual feedback for in-progress, completed, and interrupted messages
- **Smart Auto-Scroll**: Automatically scrolls to new messages while preserving scroll position when reviewing history
- **Mobile-Responsive Chat UI**: Collapsible chat window that adapts to different screen sizes
- **Desktop Auto-Open**: Chat window automatically opens on first message (desktop only)
- **Message Persistence**: Full conversation history maintained throughout the session

### AI Conversation Engine
- **Custom LLM Integration**: Connect your preferred LLM (OpenAI, Anthropic, etc.)
- **ElevenLabs TTS**: High-quality voice synthesis with ElevenLabs
- **Modern Turn Detection**: Advanced turn-taking with configurable interrupt behavior
- **RTM Data Channel**: Reliable message delivery with metrics and error reporting
- **Token Management**: Automatic token renewal for both RTC and RTM to prevent disconnections
- **Agent Lifecycle**: Agent is invited when you click "Try it now!"; End Conversation button stops the agent and closes the session
- **Official Toolkit**: Uses Agora's ConversationalAIAPI for robust conversation management

### User Experience
- **Audio Visualizations**: Animated frequency bars for both user and AI audio
- **Connection Status**: Real-time connection indicators
- **Error Handling**: Graceful error messages and recovery options
- **Accessibility**: ARIA labels and keyboard-friendly controls

## Voice Options

### ElevenLabs

Browse and select voices at: https://elevenlabs.io/app/voice-lab

Set your chosen voice ID in the `ELEVENLABS_VOICE_ID` constant in [`app/api/invite-agent/route.ts`](app/api/invite-agent/route.ts).

## Key Components

The application is built with a modular component architecture:

### Core Components

- **`LandingPage.tsx`**: Entry point that invites the agent when you click "Try it now!" and manages the conversation lifecycle with proper agent cleanup on end
- **`ConversationComponent.tsx`**: Main conversation container handling RTC and RTM connections, audio/text streaming, and the End Conversation flow
- **`MicrophoneButton.tsx`**: Interactive button with built-in audio visualization for microphone control
- **`MicrophoneSelector.tsx`**: Dropdown component for selecting audio input devices with hot-swap support
- **`ConvoTextStream.tsx`**: Real-time text transcription display with smart scrolling and message management
- **`AudioVisualizer.tsx`**: Visual feedback component showing audio frequency data for remote users

### Utilities

- **`lib/conversational-ai-api/`**: Official Agora ConversationalAIAPI toolkit for managing RTC/RTM conversations
  - `index.ts`: Main ConversationalAIAPI class with event handling
  - `type.ts`: TypeScript type definitions for the toolkit
  - `utils/`: Event helpers, logging, and transcript rendering
- **`lib/utils.ts`**: Helper functions including markdown rendering for chat messages
- **`types/conversation.ts`**: TypeScript type definitions for conversation data structures

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## API Endpoints

The application provides the following API endpoints:

### Generate Agora Token

- **Endpoint**: `/api/generate-agora-token`
- **Method**: GET
- **Query Parameters**:
  - `uid` (optional) - User ID (defaults to 0)
  - `channel` (optional) - Channel name (auto-generated if not provided)
- **Response**: Returns token (with RTC + RTM privileges), uid, and channel information

### Invite Agent

- **Endpoint**: `/api/invite-agent`
- **Method**: POST
- **Body**:

```typescript
{
  requester_id: string;
  channel_name: string;
  input_modalities?: string[];
  output_modalities?: string[];
}
```

### Stop Conversation

- **Endpoint**: `/api/stop-conversation`
- **Method**: POST
- **Body**:

```typescript
{
  agent_id: string;
}
```

## Technical Implementation Details

### Text Streaming Architecture

The text streaming feature uses Agora's official ConversationalAIAPI toolkit with RTM for reliable real-time transcriptions:

1. **RTM Client** establishes a real-time messaging connection alongside RTC for audio
2. **ConversationalAIAPI** (`lib/conversational-ai-api/`) processes incoming RTM messages and manages conversation state
3. **Event Subscriptions** handle transcript updates, agent state changes, metrics, and errors
4. **ConversationComponent** manages message state and updates, separating in-progress messages from completed ones
5. **ConvoTextStream** renders the UI with smart scrolling and visual indicators for message status

Key features:
- **Dual RTC + RTM tokens** for secure access to both audio and messaging channels
- **Audio PTS metadata** enabled for accurate transcription timing synchronization
- **Modern turn detection** with configurable interrupt behavior (replaces deprecated VAD)
- **Agent metrics and error reporting** via RTM data channel
- **Proper resource cleanup** when conversations end

### Microphone Device Management

The MicrophoneSelector component provides:

- **Device enumeration** via `AgoraRTC.getMicrophones()`
- **Hot-swap detection** through `AgoraRTC.onMicrophoneChanged` callbacks
- **Seamless switching** using `localMicrophoneTrack.setDevice(deviceId)`
- **Automatic fallback** when the current device is disconnected

### Audio Visualization

Both the MicrophoneButton and AudioVisualizer components use the Web Audio API:

- Creates an `AudioContext` and `AnalyserNode`
- Connects to the Agora audio track's MediaStream
- Uses `getByteFrequencyData()` to extract frequency information
- Animates visual bars using `requestAnimationFrame` for smooth 60fps updates

## Architecture

This application uses a dual-channel architecture for optimal performance:

### RTC + RTM Integration
- **RTC (Real-Time Communication)**: Handles high-quality audio streaming between users and AI agents
- **RTM (Real-Time Messaging)**: Delivers transcriptions, agent state updates, metrics, and error messages
- **Dual Token Authentication**: Single token provides secure access to both RTC and RTM services
- **Audio PTS Metadata**: Enables precise synchronization between audio playback and transcription display

### Conversation Management
- **ConversationalAIAPI Toolkit**: Official Agora toolkit managing the complete conversation lifecycle
- **Event-Driven Architecture**: Real-time updates for transcripts, agent state changes, and system events
- **Turn Detection**: Modern voice activity detection with configurable interrupt behavior
- **Resource Cleanup**: Automatic cleanup of RTC, RTM, and agent resources when conversations end

### Benefits
- Reliable message delivery through dedicated RTM channel
- Access to real-time agent metrics and error reporting
- Better timing synchronization for natural conversation flow
- Proper resource management preventing memory leaks
- Modern API patterns following Agora best practices
