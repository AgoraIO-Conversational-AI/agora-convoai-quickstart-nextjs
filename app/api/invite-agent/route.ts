import { NextRequest, NextResponse } from 'next/server';
import {
  AgoraClient,
  Agent,
  Area,
  ExpiresIn,
  OpenAI,
  ElevenLabsTTS,
  DeepgramSTT,
} from 'agent-server-sdk-ts';
import { ClientStartRequest, AgentResponse } from '@/types/conversation';

// System prompt that defines the agent's personality and behavior.
// Swap this out to change what the agent talks about.
const ADA_PROMPT = `You are **Ada**, a developer advocate AI from **Agora**. You help developers understand and build with Agora's Conversational AI platform.

# What Agora Actually Is
Agora is a real-time communications company. The product you represent is the **Agora Conversational AI Engine** — it lets developers add voice AI agents to any app by connecting ASR, LLM, and TTS into a real-time pipeline over Agora's SD-RTN (Software Defined Real-Time Network). Key facts:
- The product is called the **Conversational AI Engine** (not "Chorus", not "Harmony", not any other name you might invent)
- It runs a full ASR → LLM → TTS pipeline with sub-500ms latency
- It supports Deepgram, Microsoft, and others for ASR; OpenAI, Anthropic, and others for LLM; ElevenLabs, Microsoft, and others for TTS
- Agora's SD-RTN is its global real-time network infrastructure — not "SDRTN"
- MCP in this context means **Model Context Protocol** (Anthropic's open standard for connecting AI models to tools/data), not "multi-channel processing"
- Agora does not have a product called Chorus, Harmony, or any similar name — do not invent product names

# Honesty Rule
If you don't know a specific fact about Agora, say so plainly and suggest checking docs.agora.io. Never invent product names, feature names, or capabilities.

# Persona & Tone
- Friendly, technically credible, concise. You're a peer who builds things, not a support agent.
- Plain English. No marketing fluff.

# Core Behavior Guidelines
- **Default to brief**: This is a voice conversation. Keep most replies to 1–2 sentences. Only go longer if the user explicitly asks for detail or the answer genuinely requires it.
- **Never list or enumerate**: No bullet points, no numbered steps. Say the single most important thing.
- **Clarify before answering**: For anything complex, ask one focused question first.
- **Ask at most one question per turn**: Never stack questions.
- **Guide, don't lecture**: Unlock the next step, not everything at once.`;

// First thing the agent says when a user joins the channel.
const GREETING = `Hi there! I'm Ada, your virtual assistant from Agora. How can I help?`;

// ---------------------------------------------------------------------------
// Validate env vars once at module load — misconfiguration surfaces on startup
// rather than on the first user request.
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// API keys — set these in .env.local (see env.local.example)
const appId =
  process.env.NEXT_PUBLIC_AGORA_APP_ID || requireEnv('NEXT_AGORA_APP_ID');
const appCertificate = requireEnv('NEXT_AGORA_APP_CERTIFICATE');
// agentUid identifies the AI in the RTC channel — must match NEXT_PUBLIC_AGENT_UID on the client
const agentUid = process.env.NEXT_PUBLIC_AGENT_UID || 'Agent';
// Any OpenAI-compatible endpoint works here (OpenAI, Azure, Groq, etc.)
const llmUrl = requireEnv('NEXT_LLM_URL');
const llmApiKey = requireEnv('NEXT_LLM_API_KEY');
const deepgramApiKey = requireEnv('NEXT_DEEPGRAM_API_KEY');
const elevenLabsApiKey = requireEnv('NEXT_ELEVENLABS_API_KEY');

// Voice ID for ElevenLabs — find yours at https://elevenlabs.io/app/voice-lab
const ELEVENLABS_VOICE_ID = 'cgSgspJ2msm6clMCkdW9'; // ElevenLabs Default voice - Jessica (Playful, Joyful, Warm)

export async function POST(request: NextRequest) {
  try {
    // --- 1. Parse request ---

    const body: ClientStartRequest = await request.json();
    const { requester_id, channel_name } = body;

    if (!channel_name || !requester_id) {
      return NextResponse.json(
        { error: 'channel_name and requester_id are required' },
        { status: 400 },
      );
    }

    // --- 3. Build and start the agent ---

    // AgoraClient authenticates API calls to the Agora Conversational AI service
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
      // VAD controls how long the agent waits after the user stops speaking
      // before treating it as the end of a turn
      turnDetection: {
        type: 'agora_vad',
        silence_duration_ms: 480,
        threshold: 0.5,
        interrupt_duration_ms: 160,
        prefix_padding_ms: 300,
      },
      // RTM is required for transcript events in the browser client.
      // enable_tools is required for MCP tool invocation.
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
