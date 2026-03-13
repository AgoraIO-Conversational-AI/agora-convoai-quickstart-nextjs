import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { randomUUID } from 'crypto';

/**
 * OpenAI-compatible Chat Completions endpoint backed by Vercel AI SDK.
 *
 * Agora's Conversational AI Engine calls this as its "custom LLM" — sending
 * standard OpenAI chat completion requests and expecting OpenAI SSE chunks back.
 *
 * Extension point: add RAG retrieval, tool calls, guards, etc. before/after
 * the streamText call.
 */
export async function POST(request: NextRequest) {
  // ── Config ────────────────────────────────────────────────────────────────
  const apiKey = process.env.NEXT_LLM_API_KEY;
  const llmUrl = process.env.NEXT_LLM_URL;
  // Model is pinned here — change this to switch models without other config changes.
  // Never use body.model; that would allow callers to route to arbitrary models.
  const modelId = 'gpt-4o';

  if (!apiKey || !llmUrl) {
    return NextResponse.json(
      { error: 'NEXT_LLM_API_KEY and NEXT_LLM_URL must be set' },
      { status: 500 }
    );
  }

  // @ai-sdk/openai needs a base URL, not the full /chat/completions path
  const baseURL = llmUrl.replace(/\/chat\/completions\/?$/, '');

  let body: {
    messages?: Array<{ role: string; content: unknown }>;
    model?: string;
    stream?: boolean;
    [key: string]: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const openai = createOpenAI({ apiKey, baseURL });

  const result = streamText({
    // modelId is always sourced from the environment — body.model is ignored
    model: openai(modelId),
    messages: (body.messages ?? []) as Parameters<typeof streamText>[0]['messages'],
  });

  const encoder = new TextEncoder();
  const id = `chatcmpl-${randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const model = body.model ?? modelId;

  const sseChunk = (delta: Record<string, unknown>, finishReason: string | null = null) =>
    encoder.encode(
      `data: ${JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
      })}\n\n`
    );

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Role-only first chunk (OpenAI convention)
        controller.enqueue(sseChunk({ role: 'assistant', content: '' }));

        for await (const chunk of result.textStream) {
          controller.enqueue(sseChunk({ content: chunk }));
        }

        controller.enqueue(sseChunk({}, 'stop'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        console.error('[custom-llm] Stream error:', err);
        controller.error(err);
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
