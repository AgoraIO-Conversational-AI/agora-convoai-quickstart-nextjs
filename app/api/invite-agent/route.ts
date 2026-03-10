import { NextRequest, NextResponse } from 'next/server';
import {
  AgoraClient,
  Agent,
  Area,
  ExpiresIn,
  OpenAI,
  MicrosoftTTS,
  ElevenLabsTTS,
  AresSTT,
  DeepgramSTT,
  MicrosoftSTT,
} from 'agora-agent-server-sdk';
import type { BaseSTT, BaseTTS } from 'agora-agent-server-sdk';
import { ClientStartRequest, AgentResponse } from '@/types/conversation';

const ADA_PROMPT = `You are **Ada**, a technical developer advocate and virtual assistant from **Agora**. You help builders deeply understand Agora's **voice-first AI stack** and guide them from idea to execution — whether they're prototyping a demo, designing production workflows, or evaluating alternatives. You don't just provide answers — you **empathize with developers**, ask thoughtful questions, and help them discover what's possible. You're technically credible, but human. You advocate for Agora's strengths: its **global SDRTN**, ultra-low latency infrastructure, and ability to orchestrate complex **voice-AI pipelines** with interruptible, context-aware, real-time interaction. Your job is to scope what they want to build, recommend the right approach, and guide them to next steps (docs, samples, demos, or a solutions handoff). You aim to make every dev feel like they're building with the best tools — and that **voice is the future interface**.

# Persona & Tone
- Think like a **developer advocate** — be technical, but also empowering. Help users understand why Agora's approach is powerful and how they can build quickly.
- Be curious: Ask good questions to uncover what users are really trying to build. Be excited by cool use cases.
- Don't shy away from sharing what makes Agora special: SDRTN, cascading workflows, agent orchestration, etc.
- Balance empathy and authority. You're not a support agent — you're a peer who builds things too.
- Friendly, concise, and technically credible. Avoid fluff.
- Default to practical guidance and actionable steps. Use plain English.

# Core Behavior Guidelines
- **Clarify before answering**: When asked for info that will require a detailed response, respond with 1–2 clarifying questions to better understand what they're trying to do. Only provide a detailed answer if they clarify.
- **Keep it short by default**: Give brief, focused replies (2–4 sentences max). Expand only if the user asks for more.
- **Max 2 back-to-back questions**: Never ask more than 2 questions in a row. Balance inquiry with helpful replies or a suggestion.
- **Don't assume too much**: If a question is vague ("How does it work?"), ask what aspect they want to focus on (e.g., setup, latency, architecture).
- **Always aim to guide, not lecture**: Your job is to scope and guide, not teach everything at once.`;

const GREETING = `Hi there! I'm Ada, your virtual assistant from Agora. I'm here to help you explore our voice AI offerings and understand what you're looking to build. What kind of project do you have in mind?`;

function buildStt(): BaseSTT {
  const vendor = process.env.NEXT_ASR_VENDOR || 'ares';
  if (vendor === 'soniox') {
    throw new Error(
      'NEXT_ASR_VENDOR=soniox is not supported with Agent builder; use ares, deepgram, or microsoft.',
    );
  }
  if (vendor === 'ares') return new AresSTT({ language: 'en-US' });
  if (vendor === 'deepgram') {
    if (!process.env.NEXT_DEEPGRAM_API_KEY)
      throw new Error('NEXT_DEEPGRAM_API_KEY is required');
    return new DeepgramSTT({
      apiKey: process.env.NEXT_DEEPGRAM_API_KEY,
      model: process.env.NEXT_DEEPGRAM_MODEL || 'nova-3',
      language: process.env.NEXT_DEEPGRAM_LANGUAGE || 'en',
    });
  }
  if (vendor === 'microsoft') {
    if (
      !process.env.NEXT_MICROSOFT_STT_KEY ||
      !process.env.NEXT_MICROSOFT_STT_REGION
    ) {
      throw new Error(
        'NEXT_MICROSOFT_STT_KEY and NEXT_MICROSOFT_STT_REGION are required',
      );
    }
    return new MicrosoftSTT({
      key: process.env.NEXT_MICROSOFT_STT_KEY,
      region: process.env.NEXT_MICROSOFT_STT_REGION,
      language: 'en-US',
    });
  }
  throw new Error(`Unsupported ASR vendor: ${vendor}`);
}

function buildTts(): BaseTTS {
  const vendor = process.env.NEXT_TTS_VENDOR || 'microsoft';
  if (vendor === 'microsoft') {
    if (
      !process.env.NEXT_MICROSOFT_TTS_KEY ||
      !process.env.NEXT_MICROSOFT_TTS_REGION ||
      !process.env.NEXT_MICROSOFT_TTS_VOICE_NAME
    ) {
      throw new Error('Missing Microsoft TTS environment variables');
    }
    return new MicrosoftTTS({
      key: process.env.NEXT_MICROSOFT_TTS_KEY,
      region: process.env.NEXT_MICROSOFT_TTS_REGION,
      voiceName: process.env.NEXT_MICROSOFT_TTS_VOICE_NAME,
    });
  }
  if (vendor === 'elevenlabs') {
    if (
      !process.env.NEXT_ELEVENLABS_API_KEY ||
      !process.env.NEXT_ELEVENLABS_VOICE_ID ||
      !process.env.NEXT_ELEVENLABS_MODEL_ID
    ) {
      throw new Error('Missing ElevenLabs environment variables');
    }
    return new ElevenLabsTTS({
      key: process.env.NEXT_ELEVENLABS_API_KEY,
      modelId: process.env.NEXT_ELEVENLABS_MODEL_ID,
      voiceId: process.env.NEXT_ELEVENLABS_VOICE_ID,
    });
  }
  throw new Error(`Unsupported TTS vendor: ${vendor}`);
}

export async function POST(request: NextRequest) {
  try {
    const appId =
      process.env.NEXT_PUBLIC_AGORA_APP_ID || process.env.NEXT_AGORA_APP_ID;
    const appCertificate = process.env.NEXT_AGORA_APP_CERTIFICATE;
    const agentUid = process.env.NEXT_PUBLIC_AGENT_UID || 'Agent';

    if (!appId || !appCertificate) {
      throw new Error(
        'Missing Agora configuration. Set NEXT_PUBLIC_AGORA_APP_ID and NEXT_AGORA_APP_CERTIFICATE.',
      );
    }

    const llmModel = process.env.NEXT_LLM_MODEL || 'gpt-4o';
    const useCustomLlm = process.env.NEXT_CUSTOM_LLM === 'true';
    let resolvedLlmUrl: string;
    let resolvedApiKey: string;

    if (useCustomLlm) {
      const rawCustomUrl = process.env.NEXT_CUSTOM_LLM_URL;
      if (!rawCustomUrl) {
        return NextResponse.json(
          {
            error: 'NEXT_CUSTOM_LLM_URL must be set when NEXT_CUSTOM_LLM=true.',
          },
          { status: 500 },
        );
      }
      const base = rawCustomUrl.replace(/\/+$/, '');
      resolvedLlmUrl = base.endsWith('/api/chat/completions')
        ? base
        : `${base}/api/chat/completions`;
      resolvedApiKey = process.env.NEXT_CUSTOM_LLM_SECRET ?? '';
    } else {
      const llmUrl = process.env.NEXT_LLM_URL;
      const llmApiKey = process.env.NEXT_LLM_API_KEY;
      if (!llmUrl || !llmApiKey) {
        throw new Error(
          'Missing LLM configuration. Set NEXT_LLM_URL and NEXT_LLM_API_KEY.',
        );
      }
      resolvedLlmUrl = llmUrl;
      resolvedApiKey = llmApiKey;
    }

    const body: ClientStartRequest = await request.json();
    const { requester_id, channel_name } = body;

    if (!channel_name) {
      return NextResponse.json(
        { error: 'channel_name is required' },
        { status: 400 },
      );
    }

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
      turnDetection: {
        type: 'agora_vad',
        silence_duration_ms: 480,
        threshold: 0.5,
        interrupt_duration_ms: 160,
        prefix_padding_ms: 300,
      },
      advancedFeatures: { enable_rtm: true },
    })
      .withLlm(
        new OpenAI({
          url: resolvedLlmUrl,
          apiKey: resolvedApiKey,
          model: llmModel,
          greetingMessage: GREETING,
          failureMessage: 'Please wait a moment.',
          maxHistory: 10,
          params: { max_tokens: 1024, temperature: 0.7, top_p: 0.95 },
        }),
      )
      .withTts(buildTts())
      .withStt(buildStt());

    const session = agent.createSession(client, {
      channel: channel_name,
      agentUid,
      remoteUids: requester_id ? [requester_id] : [],
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
